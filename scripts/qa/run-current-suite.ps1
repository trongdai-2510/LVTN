param(
  [string[]]$OnlyStages = @(),
  [string]$PlaywrightSpec = '',
  [string]$PlaywrightGrep = '',
  [switch]$ProductionRuntime
)

$ErrorActionPreference = 'Stop'

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$apiDirectory = Join-Path $workspaceRoot 'api'
$adminDirectory = Join-Path $workspaceRoot 'admin'
$frontendDirectory = Join-Path $workspaceRoot 'frontend'
$runtimeDirectory = Join-Path $workspaceRoot 'tmp\qa-runtime'
$apiEnvPath = Join-Path $apiDirectory '.env'
$suiteFailures = [System.Collections.Generic.List[string]]::new()

New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null

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

function Resolve-PostgresBin {
  $preferred = 'C:\Program Files\PostgreSQL\18_new\bin'
  if (Test-Path (Join-Path $preferred 'pg_dump.exe')) {
    return $preferred
  }

  $pgDump = Get-ChildItem 'C:\Program Files\PostgreSQL' `
    -Recurse `
    -Filter 'pg_dump.exe' `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $pgDump) {
    throw 'PostgreSQL client tools were not found.'
  }
  return $pgDump.DirectoryName
}

function Assert-PortsAvailable {
  $busy = @(
    Get-NetTCPConnection `
      -State Listen `
      -LocalPort 3000, 3001, 4000 `
      -ErrorAction SilentlyContinue
  )
  if ($busy.Count -gt 0) {
    $details = $busy |
      Sort-Object LocalPort |
      ForEach-Object { "port=$($_.LocalPort),pid=$($_.OwningProcess)" }
    throw "QA requires ports 3000, 3001, and 4000 to be free. Busy: $($details -join '; ')"
  }
}

function Wait-ForHttp {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 90
  )

  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  do {
      try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
        if ($response.StatusCode -lt 500) {
          return
        }
      } catch {
      }

      # Avoid a hot loop when the server is reachable but still returns 5xx
      # while compiling its first route.
      Start-Sleep -Milliseconds 500
  } while ([DateTime]::UtcNow -lt $deadline)

  throw "Timed out waiting for $Url"
}

function Stop-ProcessTree {
  param([System.Diagnostics.Process]$Process)

  if (-not $Process -or $Process.HasExited) {
    return
  }
  & taskkill.exe /PID $Process.Id /T /F *> $null
}

function Copy-NextStandaloneRuntimeAssets {
  param(
    [string]$ApplicationDirectory,
    [switch]$IncludePublicDirectory
  )

  # `next build` leaves static assets next to the standalone server. This local
  # production rehearsal copies them into the portable runtime explicitly.
  # Without this, the standalone server returns HTML but misses CSS and
  # JavaScript chunks, creating false responsive/layout failures.
  $sourceStaticDirectory = Join-Path $ApplicationDirectory '.next\static'
  $standaloneDirectory = Join-Path $ApplicationDirectory '.next\standalone'
  $standaloneNextDirectory = Join-Path $standaloneDirectory '.next'

  foreach ($requiredPath in @($sourceStaticDirectory, $standaloneDirectory)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
      throw "Production QA requires Next standalone runtime assets: $requiredPath"
    }
  }

  New-Item -ItemType Directory -Force -Path $standaloneNextDirectory | Out-Null
  Copy-Item -LiteralPath $sourceStaticDirectory -Destination $standaloneNextDirectory -Recurse -Force

  if ($IncludePublicDirectory) {
    $sourcePublicDirectory = Join-Path $ApplicationDirectory 'public'
    if (-not (Test-Path -LiteralPath $sourcePublicDirectory)) {
      throw "Production QA requires the public asset directory: $sourcePublicDirectory"
    }
    Copy-Item -LiteralPath $sourcePublicDirectory -Destination $standaloneDirectory -Recurse -Force
  }
}

function Invoke-CheckedCommand {
  param(
    [string]$Label,
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$WorkingDirectory,
    [int]$TimeoutSeconds = 900,
    [switch]$Required
  )

  if (
    -not $Required -and
    $OnlyStages.Count -gt 0 -and
    -not ($OnlyStages -contains $Label)
  ) {
    Write-Host "`n=== $Label ==="
    Write-Host "SKIP Stage was not selected by -OnlyStages."
    return
  }

  Write-Host "`n=== $Label ==="
  $stageProcess = Start-Process `
    -FilePath $FilePath `
    -ArgumentList $ArgumentList `
    -WorkingDirectory $WorkingDirectory `
    -NoNewWindow `
    -PassThru
  # Materialize the native handle before a short-lived .cmd wrapper exits;
  # otherwise Windows PowerShell 5 can leave ExitCode unset.
  $null = $stageProcess.Handle
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)

  while (-not $stageProcess.HasExited -and [DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 500
    $stageProcess.Refresh()
  }

  if (-not $stageProcess.HasExited) {
    Stop-ProcessTree -Process $stageProcess
    $message = "$Label timed out after $TimeoutSeconds seconds"
    if ($Required) {
      throw $message
    }
    $script:suiteFailures.Add($message)
    Write-Warning "$message; continuing remaining independent QA stages."
    return
  }

  # Windows can report HasExited before the managed Process object has populated
  # its exit code. WaitForExit synchronizes redirected/native process state.
  $stageProcess.WaitForExit()
  $stageProcess.Refresh()
  if ($stageProcess.ExitCode -ne 0) {
    $message = "$Label (exit code $($stageProcess.ExitCode))"
    if ($Required) {
      throw $message
    }
    $script:suiteFailures.Add($message)
    Write-Warning "$message; continuing remaining independent QA stages."
  }
}

if (-not (Test-Path $apiEnvPath)) {
  throw "Missing API environment file: $apiEnvPath"
}

Import-DotEnv -Path $apiEnvPath
Assert-PortsAvailable

$requiredEnvironmentKeys = @(
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_NAME',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'SUPER_ADMIN_EMAIL',
  'SUPER_ADMIN_PASSWORD'
)
foreach ($key in $requiredEnvironmentKeys) {
  if (-not [Environment]::GetEnvironmentVariable($key, 'Process')) {
    throw "Missing required local QA environment variable $key."
  }
}

$sourceDatabase = $env:DATABASE_NAME
$runStamp = Get-Date -Format 'yyyyMMddHHmmss'
$qaDatabase = "${sourceDatabase}_qa_${runStamp}"
if ($qaDatabase -notmatch '^[A-Za-z0-9_]+_qa_[0-9]{14}$' -or $qaDatabase -eq $sourceDatabase) {
  throw "Refusing unsafe QA database name: $qaDatabase"
}

$postgresBin = Resolve-PostgresBin
$createdb = Join-Path $postgresBin 'createdb.exe'
$dropdb = Join-Path $postgresBin 'dropdb.exe'
$pgDump = Join-Path $postgresBin 'pg_dump.exe'
$pgRestore = Join-Path $postgresBin 'pg_restore.exe'
$vacuumdb = Join-Path $postgresBin 'vacuumdb.exe'
$dumpPath = Join-Path $runtimeDirectory "$qaDatabase.dump"

$env:PGPASSWORD = $env:DATABASE_PASSWORD
$env:API_BASE_URL = 'http://localhost:4000'
$env:NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000'
$env:ADMIN_BASE_URL = 'http://localhost:3001'
$env:FRONTEND_BASE_URL = 'http://localhost:3000'
$env:NEXT_PUBLIC_ADMIN_SITE_URL = $env:ADMIN_BASE_URL
$env:NEXT_PUBLIC_PUBLIC_SITE_URL = $env:FRONTEND_BASE_URL
$env:ADMIN_QA_EMAIL = $env:SUPER_ADMIN_EMAIL
$env:ADMIN_QA_PASSWORD = $env:SUPER_ADMIN_PASSWORD
$env:QA_RUNTIME_DIR = $runtimeDirectory
if ($ProductionRuntime) {
  $qaSecretBytes = New-Object byte[] 32
  $qaRandom = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $qaRandom.GetBytes($qaSecretBytes)
  } finally {
    $qaRandom.Dispose()
  }
  # Production config must fail closed on the deliberately weak local seed
  # password. The copied QA database still uses ADMIN_QA_PASSWORD for login;
  # this random value exists only to exercise the production boot path safely.
  $env:SUPER_ADMIN_PASSWORD = [Convert]::ToBase64String($qaSecretBytes)
  $env:NODE_ENV = 'production'
  $env:LOAD_ENFORCE_SLO = 'true'
  $env:LOAD_RUNTIME_MODE = 'production-build'
  # Local import fixtures remain explicitly scoped to QA-only directories even
  # though the production import reader correctly rejects arbitrary paths.
  $qaImportFixtureDirectory = Join-Path $workspaceRoot 'scripts\qa\fixtures'
  $qaImportGeneratedDirectory = Join-Path $workspaceRoot 'tmp\qa-import'
  $env:IMPORT_INTAKE_ALLOWED_ROOTS = @(
    $qaImportFixtureDirectory,
    $qaImportGeneratedDirectory
  ) -join [System.IO.Path]::PathSeparator
  Remove-Item Env:\NEXT_DIST_DIR -ErrorAction SilentlyContinue

  # Rebuild from the checked source before starting the production runtime.
  # Browser-facing admin calls use the same-origin `/api` path, while
  # the Next rewrite is compiled with the local QA API target. Reusing a locally
  # built bundle can otherwise bake `http://localhost:4000` into the browser and
  # falsely fail production CSP, or leave source changes out of the QA runtime.
  Invoke-CheckedCommand `
    -Label 'Build API production artifact' `
    -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'build') `
    -WorkingDirectory $apiDirectory `
    -TimeoutSeconds 900 `
    -Required

  $env:NEXT_PUBLIC_API_BASE_URL = '/api'
  Invoke-CheckedCommand `
    -Label 'Build admin production artifact' `
    -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'build') `
    -WorkingDirectory $adminDirectory `
    -TimeoutSeconds 900 `
    -Required

  Remove-Item Env:\NEXT_PUBLIC_API_BASE_URL -ErrorAction SilentlyContinue
  Invoke-CheckedCommand `
    -Label 'Build frontend production artifact' `
    -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'build') `
    -WorkingDirectory $frontendDirectory `
    -TimeoutSeconds 900 `
    -Required

  # Test scripts talk to the API directly; the browser bundle above remains
  # same-origin `/api`, matching the production reverse-proxy boundary.
  $env:NEXT_PUBLIC_API_BASE_URL = 'http://localhost:4000'
  foreach ($requiredBuildPath in @(
    (Join-Path $apiDirectory 'dist\main.js'),
    (Join-Path $adminDirectory '.next\BUILD_ID'),
    (Join-Path $frontendDirectory '.next\BUILD_ID')
  )) {
    if (-not (Test-Path -LiteralPath $requiredBuildPath)) {
      throw "Production QA requires a current build artifact: $requiredBuildPath"
    }
  }
  Copy-NextStandaloneRuntimeAssets -ApplicationDirectory $adminDirectory
  Copy-NextStandaloneRuntimeAssets -ApplicationDirectory $frontendDirectory -IncludePublicDirectory
} else {
  $env:LOAD_ENFORCE_SLO = 'false'
  $env:LOAD_RUNTIME_MODE = 'development-watch'
  $env:NEXT_DIST_DIR = '.next-qa'

  # Next dev's incremental cache can retain stale router and HMR manifests.
  # Both Next applications inherit NEXT_DIST_DIR, so validate and clear both
  # dedicated QA directories before either runtime starts.
  foreach ($applicationDirectory in @($adminDirectory, $frontendDirectory)) {
    $applicationRootPath = [System.IO.Path]::GetFullPath($applicationDirectory).TrimEnd([char[]]@('\', '/'))
    $applicationQaDistPath = [System.IO.Path]::GetFullPath(
      (Join-Path $applicationDirectory $env:NEXT_DIST_DIR)
    )
    $applicationQaParentPath = [System.IO.Path]::GetDirectoryName($applicationQaDistPath).TrimEnd([char[]]@('\', '/'))
    if (
      $applicationQaParentPath -ne $applicationRootPath -or
      [System.IO.Path]::GetFileName($applicationQaDistPath) -ne '.next-qa'
    ) {
      throw "Refusing to clear an unsafe QA build path: $applicationQaDistPath"
    }
    if (Test-Path -LiteralPath $applicationQaDistPath) {
      Remove-Item -LiteralPath $applicationQaDistPath -Recurse -Force
    }
  }
}

$apiProcess = $null
$adminProcess = $null
$frontendProcess = $null
$databaseCreated = $false

try {
  Write-Host "Creating isolated QA database $qaDatabase from local source database."
  & $createdb `
    --host $env:DATABASE_HOST `
    --port $env:DATABASE_PORT `
    --username $env:DATABASE_USER `
    $qaDatabase
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create isolated QA database $qaDatabase."
  }
  $databaseCreated = $true

  & $pgDump `
    --host $env:DATABASE_HOST `
    --port $env:DATABASE_PORT `
    --username $env:DATABASE_USER `
    --format custom `
    --no-owner `
    --no-privileges `
    --file $dumpPath `
    $sourceDatabase
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to snapshot source database $sourceDatabase."
  }

  & $pgRestore `
    --host $env:DATABASE_HOST `
    --port $env:DATABASE_PORT `
    --username $env:DATABASE_USER `
    --dbname $qaDatabase `
    --no-owner `
    --no-privileges `
    $dumpPath
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to restore snapshot into $qaDatabase."
  }

  $env:DATABASE_NAME = $qaDatabase

  Invoke-CheckedCommand `
    -Label 'Apply QA database migrations' `
    -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'migrate:latest') `
    -WorkingDirectory $apiDirectory `
    -TimeoutSeconds 180 `
    -Required

  Write-Host "`n=== Refresh restored database optimizer statistics ==="
  & $vacuumdb `
    --host $env:DATABASE_HOST `
    --port $env:DATABASE_PORT `
    --username $env:DATABASE_USER `
    --analyze-in-stages `
    $qaDatabase
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to analyze restored QA database $qaDatabase."
  }

  $apiProcess = Start-Process `
    -FilePath $(if ($ProductionRuntime) { 'node.exe' } else { 'npm.cmd' }) `
    -ArgumentList $(if ($ProductionRuntime) { @('dist/main.js') } else { @('run', 'dev') }) `
    -WorkingDirectory $apiDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $runtimeDirectory 'api.out.log') `
    -RedirectStandardError (Join-Path $runtimeDirectory 'api.err.log') `
    -PassThru

  if ($ProductionRuntime) {
    $env:PORT = '3001'
    $adminProcess = Start-Process `
      -FilePath 'node.exe' `
      -ArgumentList @('.next/standalone/server.js') `
      -WorkingDirectory $adminDirectory `
      -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $runtimeDirectory 'admin.out.log') `
      -RedirectStandardError (Join-Path $runtimeDirectory 'admin.err.log') `
      -PassThru

    $env:PORT = '3000'
    $frontendProcess = Start-Process `
      -FilePath 'node.exe' `
      -ArgumentList @('.next/standalone/server.js') `
      -WorkingDirectory $frontendDirectory `
      -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $runtimeDirectory 'frontend.out.log') `
      -RedirectStandardError (Join-Path $runtimeDirectory 'frontend.err.log') `
      -PassThru
    Remove-Item Env:\PORT -ErrorAction SilentlyContinue
  } else {
    $adminProcess = Start-Process `
      -FilePath 'npm.cmd' `
      -ArgumentList @('run', 'dev:qa') `
      -WorkingDirectory $adminDirectory `
      -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $runtimeDirectory 'admin.out.log') `
      -RedirectStandardError (Join-Path $runtimeDirectory 'admin.err.log') `
      -PassThru

    $frontendProcess = Start-Process `
      -FilePath 'npm.cmd' `
      -ArgumentList @('run', 'dev:qa') `
      -WorkingDirectory $frontendDirectory `
      -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $runtimeDirectory 'frontend.out.log') `
      -RedirectStandardError (Join-Path $runtimeDirectory 'frontend.err.log') `
      -PassThru
  }

  Wait-ForHttp -Url 'http://127.0.0.1:4000/health'
  Wait-ForHttp -Url 'http://127.0.0.1:3001/admin/login'
  # Use a cheap static readiness probe. Polling the data-heavy homepage can
  # generate overlapping RSC fetches and distort the database-pool baseline.
  Wait-ForHttp -Url 'http://127.0.0.1:3000/robots.txt'

  Invoke-CheckedCommand `
    -Label 'API core unit and guardrail tests' `
    -FilePath 'npm.cmd' `
    -ArgumentList @('run', 'test:unit') `
    -WorkingDirectory $apiDirectory

  Invoke-CheckedCommand `
    -Label 'Database integrity audit' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/database-integrity-audit.mjs') `
    -WorkingDirectory $workspaceRoot

  Invoke-CheckedCommand `
    -Label 'Generate system inventory' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/generate-system-inventory.mjs') `
    -WorkingDirectory $workspaceRoot

  Invoke-CheckedCommand `
    -Label 'Import cycle audit' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/importcycleaudit.mjs') `
    -WorkingDirectory $workspaceRoot

  Invoke-CheckedCommand `
    -Label 'Edge-case static audit' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/edge-case-static-audit.mjs') `
    -WorkingDirectory $workspaceRoot

  Invoke-CheckedCommand `
    -Label 'Page-content lifecycle smoke' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/page-content-lifecycle-smoke.mjs') `
    -WorkingDirectory $workspaceRoot

  Invoke-CheckedCommand `
    -Label 'API contract smoke' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/api-contract-smoke.mjs') `
    -WorkingDirectory $workspaceRoot

  Invoke-CheckedCommand `
    -Label 'RBAC and authentication matrix' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/rbac-auth-matrix-smoke.mjs') `
    -WorkingDirectory $workspaceRoot

  Invoke-CheckedCommand `
    -Label 'Audit trail integrity' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/audit-trail-integrity-smoke.mjs') `
    -WorkingDirectory $workspaceRoot

  Invoke-CheckedCommand `
    -Label 'File usage transaction atomicity' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/file-usage-atomicity-smoke.mjs') `
    -WorkingDirectory $workspaceRoot

  Invoke-CheckedCommand `
    -Label 'Product-domain invariant matrix' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/product-domain-invariants-smoke.mjs') `
    -WorkingDirectory $workspaceRoot

  Invoke-CheckedCommand `
    -Label 'Content-domain invariant matrix' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/content-domain-invariants-smoke.mjs') `
    -WorkingDirectory $workspaceRoot

  Invoke-CheckedCommand `
    -Label 'CRM-domain invariant matrix' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/crm-domain-invariants-smoke.mjs') `
    -WorkingDirectory $workspaceRoot

  Invoke-CheckedCommand `
    -Label 'Import-domain invariant matrix' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/import-domain-invariants-smoke.mjs') `
    -WorkingDirectory $workspaceRoot `
    -TimeoutSeconds 900

  Invoke-CheckedCommand `
    -Label 'Admin route smoke' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/admin-route-smoke.mjs') `
    -WorkingDirectory $workspaceRoot `
    -TimeoutSeconds 900

  Invoke-CheckedCommand `
    -Label 'Public UI smoke' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/public-ui-smoke.mjs') `
    -WorkingDirectory $workspaceRoot `
    -TimeoutSeconds 600

  Invoke-CheckedCommand `
    -Label 'End-user smoke' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/end-user-smoke.mjs') `
    -WorkingDirectory $workspaceRoot `
    -TimeoutSeconds 600

  Invoke-CheckedCommand `
    -Label 'Public read load baseline' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/load-reliability-baseline.mjs') `
    -WorkingDirectory $workspaceRoot `
    -TimeoutSeconds 300

  Invoke-CheckedCommand `
    -Label 'Dependency failure recovery rehearsal' `
    -FilePath 'powershell.exe' `
    -ArgumentList @(
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      'scripts/qa/dependency-failure-recovery-rehearsal.ps1'
    ) `
    -WorkingDirectory $workspaceRoot `
    -TimeoutSeconds 240

  $playwrightArguments = @('exec', '--', 'playwright', 'test')
  if ($PlaywrightSpec) {
    $playwrightArguments += $PlaywrightSpec
  }
  if ($PlaywrightGrep) {
    $escapedPlaywrightGrep = $PlaywrightGrep.Replace('"', '\"')
    $playwrightArguments += @('--grep', "`"$escapedPlaywrightGrep`"")
  }

  Invoke-CheckedCommand `
    -Label 'Admin Playwright E2E' `
    -FilePath 'npm.cmd' `
    -ArgumentList $playwrightArguments `
    -WorkingDirectory $adminDirectory `
    -TimeoutSeconds 900

  Invoke-CheckedCommand `
    -Label 'Runtime log hygiene' `
    -FilePath 'node.exe' `
    -ArgumentList @('scripts/qa/runtime-log-audit.mjs') `
    -WorkingDirectory $workspaceRoot

  if ($suiteFailures.Count -gt 0) {
    throw "QA suite completed with failures: $($suiteFailures -join '; ')"
  }
} finally {
  Stop-ProcessTree -Process $frontendProcess
  Stop-ProcessTree -Process $adminProcess
  Stop-ProcessTree -Process $apiProcess

  if ($databaseCreated) {
    if ($qaDatabase -notmatch '^[A-Za-z0-9_]+_qa_[0-9]{14}$' -or $qaDatabase -eq $sourceDatabase) {
      throw "Refusing to remove unsafe QA database target: $qaDatabase"
    }
    Write-Host "Removing isolated QA database $qaDatabase."
    & $dropdb `
      --host $env:DATABASE_HOST `
      --port $env:DATABASE_PORT `
      --username $env:DATABASE_USER `
      --if-exists `
      --force `
      $qaDatabase
  }

  if (Test-Path -LiteralPath $dumpPath) {
    Remove-Item -LiteralPath $dumpPath -Force
  }
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
