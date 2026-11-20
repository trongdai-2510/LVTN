$ErrorActionPreference = 'Stop'

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$apiDirectory = Join-Path $workspaceRoot 'api'
$runtimeDirectory = Join-Path $workspaceRoot 'tmp\qa-runtime'
$envPath = Join-Path $apiDirectory '.env'

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
  if (Test-Path -LiteralPath (Join-Path $preferred 'pg_dump.exe')) {
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

function Invoke-PostgresCommand {
  param(
    [string]$Executable,
    [string[]]$Arguments,
    [string]$FailureMessage
  )

  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

function Read-Scalar {
  param(
    [string]$Psql,
    [string]$Database,
    [string]$Query
  )

  $output = & $Psql `
    --host $env:DATABASE_HOST `
    --port $env:DATABASE_PORT `
    --username $env:DATABASE_USER `
    --dbname $Database `
    --tuples-only `
    --no-align `
    --command $Query
  if ($LASTEXITCODE -ne 0) {
    throw 'Database verification query failed.'
  }
  return ($output | Select-Object -Last 1).Trim()
}

Import-DotEnv -Path $envPath
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null

$sourceDatabase = $env:DATABASE_NAME
$runStamp = Get-Date -Format 'yyyyMMddHHmmss'
$qaDatabase = "${sourceDatabase}_migqa_${runStamp}"
if ($qaDatabase -notmatch '^[A-Za-z0-9_]+_migqa_[0-9]{14}$' -or $qaDatabase -eq $sourceDatabase) {
  throw "Refusing unsafe migration QA database name: $qaDatabase"
}

$postgresBin = Resolve-PostgresBin
$createdb = Join-Path $postgresBin 'createdb.exe'
$dropdb = Join-Path $postgresBin 'dropdb.exe'
$pgDump = Join-Path $postgresBin 'pg_dump.exe'
$pgRestore = Join-Path $postgresBin 'pg_restore.exe'
$psql = Join-Path $postgresBin 'psql.exe'
$dumpPath = Join-Path $runtimeDirectory "$qaDatabase.dump"
$env:PGPASSWORD = $env:DATABASE_PASSWORD
$databaseCreated = $false

try {
  Invoke-PostgresCommand -Executable $createdb -Arguments @(
    '--host', $env:DATABASE_HOST,
    '--port', $env:DATABASE_PORT,
    '--username', $env:DATABASE_USER,
    $qaDatabase
  ) -FailureMessage 'Failed to create migration QA database.'
  $databaseCreated = $true

  Invoke-PostgresCommand -Executable $pgDump -Arguments @(
    '--host', $env:DATABASE_HOST,
    '--port', $env:DATABASE_PORT,
    '--username', $env:DATABASE_USER,
    '--format', 'custom',
    '--file', $dumpPath,
    $sourceDatabase
  ) -FailureMessage 'Failed to snapshot the local source database.'

  Invoke-PostgresCommand -Executable $pgRestore -Arguments @(
    '--host', $env:DATABASE_HOST,
    '--port', $env:DATABASE_PORT,
    '--username', $env:DATABASE_USER,
    '--dbname', $qaDatabase,
    '--no-owner',
    '--no-privileges',
    $dumpPath
  ) -FailureMessage 'Failed to restore the migration QA database.'

  $env:DATABASE_NAME = $qaDatabase
  Push-Location $apiDirectory
  try {
    & npm.cmd run migrate:latest
    if ($LASTEXITCODE -ne 0) {
      throw 'Initial quote migration failed.'
    }

    $columnQuery = @"
SELECT COUNT(*)
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'quote_request' AND column_name IN ('project_name', 'project_context', 'project_requirements'))
    OR
    (table_name = 'quote_item' AND column_name IN ('quantity_raw', 'quantity_unit', 'quantity_state'))
  );
"@
    if ((Read-Scalar -Psql $psql -Database $qaDatabase -Query $columnQuery) -ne '6') {
      throw 'Quote migration did not create all six additive columns.'
    }

    & npm.cmd run migrate:rollback
    if ($LASTEXITCODE -ne 0) {
      throw 'Quote migration rollback failed.'
    }
    if ((Read-Scalar -Psql $psql -Database $qaDatabase -Query $columnQuery) -ne '0') {
      throw 'Quote migration rollback left additive columns behind.'
    }

    & npm.cmd run migrate:latest
    if ($LASTEXITCODE -ne 0) {
      throw 'Quote migration could not be applied again after rollback.'
    }

    $constraintQuery = @"
SELECT COUNT(*)
FROM pg_constraint
WHERE conname IN (
  'quote_request_project_requirements_array',
  'quote_item_quantity_state_check',
  'quote_item_quantity_interpretation_check'
);
"@
    if ((Read-Scalar -Psql $psql -Database $qaDatabase -Query $constraintQuery) -ne '3') {
      throw 'Quote migration did not restore all critical constraints.'
    }

    Write-Host 'PASS Quote migration up/down/up: 6 columns and 3 critical constraints verified.'
  } finally {
    Pop-Location
  }
} finally {
  $env:DATABASE_NAME = $sourceDatabase
  if ($databaseCreated) {
    Invoke-PostgresCommand -Executable $dropdb -Arguments @(
      '--host', $env:DATABASE_HOST,
      '--port', $env:DATABASE_PORT,
      '--username', $env:DATABASE_USER,
      '--if-exists',
      '--force',
      $qaDatabase
    ) -FailureMessage 'Failed to remove migration QA database.'
  }

  $resolvedDump = [System.IO.Path]::GetFullPath($dumpPath)
  $resolvedRuntime = [System.IO.Path]::GetFullPath($runtimeDirectory)
  if (
    $resolvedDump.StartsWith($resolvedRuntime, [System.StringComparison]::OrdinalIgnoreCase) -and
    (Test-Path -LiteralPath $resolvedDump)
  ) {
    Remove-Item -LiteralPath $resolvedDump -Force
  }
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
