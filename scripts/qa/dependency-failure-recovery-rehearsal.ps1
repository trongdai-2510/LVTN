$ErrorActionPreference = 'Stop'

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$apiDirectory = Join-Path $workspaceRoot 'api'
$frontendDirectory = Join-Path $workspaceRoot 'frontend'
$runtimeDirectory = Join-Path $workspaceRoot 'tmp\qa-runtime'
$outputPath = Join-Path $workspaceRoot 'docs\qa\generated\dependency-failure-recovery-rehearsal.md'
$apiEnvPath = Join-Path $apiDirectory '.env'
$apiPort = 4010
$frontendPort = 3002

function Import-DotEnv {
  param([string]$Path)

  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -notmatch '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
      continue
    }
    $key = $matches[1]
    $value = $matches[2].Trim()
    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    [Environment]::SetEnvironmentVariable($key, $value, 'Process')
  }
}

function Assert-PortAvailable {
  param([int]$Port)
  $listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
  if ($listener) {
    throw "Failure rehearsal requires port $Port to be free."
  }
}

function Stop-ProcessTree {
  param([System.Diagnostics.Process]$Process)
  if (-not $Process -or $Process.HasExited) {
    return
  }
  & taskkill.exe /PID $Process.Id /T /F *> $null
}

function Wait-ForHttp {
  param(
    [System.Net.Http.HttpClient]$Client,
    [string]$Url,
    [int]$TimeoutSeconds = 90
  )

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = $Client.GetAsync($Url).GetAwaiter().GetResult()
      if ([int]$response.StatusCode -lt 500) {
        return
      }
    } catch {
    }
    Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)

  throw "Timed out waiting for $Url"
}

if (-not (Test-Path -LiteralPath $apiEnvPath)) {
  throw "Missing API environment file: $apiEnvPath"
}
if (-not (Test-Path -LiteralPath (Join-Path $apiDirectory 'dist\main.js'))) {
  throw 'API dist/main.js is missing. Run npm run build before the failure rehearsal.'
}

Add-Type -AssemblyName System.Net.Http
Import-DotEnv -Path $apiEnvPath
Assert-PortAvailable -Port $apiPort
Assert-PortAvailable -Port $frontendPort
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null

$client = [System.Net.Http.HttpClient]::new()
$client.Timeout = [TimeSpan]::FromSeconds(20)
$apiProcess = $null
$frontendProcess = $null
$startedAt = [DateTime]::UtcNow

try {
  # Start the compiled API with a deliberately unreachable PostgreSQL port.
  $env:NODE_ENV = 'production'
  $env:PORT = [string]$apiPort
  $env:DATABASE_PORT = '1'
  $env:JWT_ACCESS_SECRET = 'qa-failure-access-secret-abcdefghijklmnopqrstuvwxyz-0123456789'
  $env:JWT_REFRESH_SECRET = 'qa-failure-refresh-secret-abcdefghijklmnopqrstuvwxyz-9876543210'
  $env:SUPER_ADMIN_PASSWORD = 'qa-failure-admin-password'

  $apiProcess = Start-Process `
    -FilePath 'node.exe' `
    -ArgumentList @('dist/main.js') `
    -WorkingDirectory $apiDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $runtimeDirectory 'failure-api.out.log') `
    -RedirectStandardError (Join-Path $runtimeDirectory 'failure-api.err.log') `
    -PassThru

  Wait-ForHttp -Client $client -Url "http://127.0.0.1:$apiPort/health"

  $livenessResponse = $client.GetAsync(
    "http://127.0.0.1:$apiPort/health"
  ).GetAwaiter().GetResult()
  if ([int]$livenessResponse.StatusCode -ne 200) {
    throw "API liveness returned $([int]$livenessResponse.StatusCode)."
  }

  $databaseResponse = $client.GetAsync(
    "http://127.0.0.1:$apiPort/health/db"
  ).GetAwaiter().GetResult()
  $databaseBody = $databaseResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if ([int]$databaseResponse.StatusCode -ne 503) {
    throw "Database readiness returned $([int]$databaseResponse.StatusCode), expected 503."
  }
  if ($databaseBody -notmatch 'DATABASE_UNAVAILABLE') {
    throw 'Database readiness did not return the stable DATABASE_UNAVAILABLE error code.'
  }
  if (
    $databaseBody -match '"stack"' -or
    $databaseBody -match '[A-Za-z]:\\' -or
    $databaseBody -match 'node_modules'
  ) {
    throw 'Database outage response leaked stack or filesystem details.'
  }

  Stop-ProcessTree -Process $apiProcess
  $apiProcess = $null

  # Start the compiled Next.js production build whose server-side API dependency is
  # deliberately unreachable. Public routes must render their controlled
  # fallback instead of exposing a 5xx or internal dependency details.
  $env:NODE_ENV = 'production'
  $env:API_BASE_URL = 'http://127.0.0.1:9'
  $env:NEXT_PUBLIC_API_BASE_URL = ''
  Remove-Item Env:NEXT_DIST_DIR -ErrorAction SilentlyContinue

  $frontendProcess = Start-Process `
    -FilePath 'node.exe' `
    -ArgumentList @(
      'node_modules/next/dist/bin/next',
      'start',
      '--port',
      [string]$frontendPort
    ) `
    -WorkingDirectory $frontendDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $runtimeDirectory 'failure-frontend.out.log') `
    -RedirectStandardError (Join-Path $runtimeDirectory 'failure-frontend.err.log') `
    -PassThru

  Wait-ForHttp -Client $client -Url "http://127.0.0.1:$frontendPort/robots.txt"
  $frontendResponse = $client.GetAsync(
    "http://127.0.0.1:$frontendPort/"
  ).GetAwaiter().GetResult()
  $frontendBody = $frontendResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
  if ([int]$frontendResponse.StatusCode -ne 200) {
    throw "Public homepage returned $([int]$frontendResponse.StatusCode) during API outage."
  }
  $frontendLeakMarkers = @(
    @('ECONNREFUSED', 'connection error'),
    @('127\.0\.0\.1:9', 'internal API origin'),
    @('node_modules', 'dependency filesystem path')
  ) | Where-Object { $frontendBody -match $_[0] } | ForEach-Object { $_[1] }
  if ($frontendLeakMarkers.Count -gt 0) {
    throw "Public API-outage fallback leaked: $($frontendLeakMarkers -join ', ')."
  }

  $duration = [Math]::Round(([DateTime]::UtcNow - $startedAt).TotalSeconds, 2)
  $report = @"
# Song Thanh — Dependency failure recovery rehearsal

- Generated at: $([DateTime]::UtcNow.ToString('o'))
- Result: **PASS**
- Duration: ${duration}s

## Injected failures and observed behavior

| Injection | Expected | Observed |
| --- | --- | --- |
| Compiled API uses an unreachable PostgreSQL port | Liveness remains 200; readiness becomes 503 with stable safe error | PASS |
| PostgreSQL readiness response | No stack, local path or ``node_modules`` leak | PASS |
| Next.js server uses an unreachable API origin | Public homepage renders controlled fallback with HTTP 200 | PASS |
| Public fallback response | No internal origin, connection error or filesystem leak | PASS |

The rehearsal uses dedicated ports $apiPort and $frontendPort and does not mutate
the development database.
"@
  New-Item -ItemType Directory -Force -Path (Split-Path $outputPath) | Out-Null
  Set-Content -LiteralPath $outputPath -Value $report -Encoding UTF8
  Write-Host "Dependency failure recovery rehearsal PASS in ${duration}s."
} finally {
  Stop-ProcessTree -Process $frontendProcess
  Stop-ProcessTree -Process $apiProcess
  $client.Dispose()
}
