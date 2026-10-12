$ErrorActionPreference = 'Stop'

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$apiDirectory = Join-Path $workspaceRoot 'api'
$apiEnvPath = Join-Path $apiDirectory '.env'
$baselinePath = Join-Path $workspaceRoot 'database\ddl\song_thanh_deployment_schema_20260730.sql'
$migrationHistoryPath = Join-Path $workspaceRoot 'database\ddl\song_thanh_deployment_migration_history_20260730.sql'
$outputPath = Join-Path $workspaceRoot 'tmp\qa-artifacts\generated\fresh-schema-restore-rehearsal.md'
$runtimeDirectory = Join-Path $workspaceRoot 'tmp\qa-runtime'

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

function Assert-QaDatabaseName {
  param(
    [string]$Name,
    [string]$SourceName
  )

  if (
    $Name -eq $SourceName -or
    $Name -notmatch '^[A-Za-z0-9_]+_fresh_qa_[0-9]{14}(_restore)?$'
  ) {
    throw "Refusing unsafe QA database target: $Name"
  }
}

function Invoke-NativeChecked {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$FailureMessage
  )

  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

if (-not (Test-Path -LiteralPath $apiEnvPath)) {
  throw "Missing API environment file: $apiEnvPath"
}
if (-not (Test-Path -LiteralPath $baselinePath)) {
  throw "Missing deployment schema snapshot: $baselinePath"
}
if (-not (Test-Path -LiteralPath $migrationHistoryPath)) {
  throw "Missing deployment migration history: $migrationHistoryPath"
}

Import-DotEnv -Path $apiEnvPath

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
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$freshDatabase = "${sourceDatabase}_fresh_qa_${stamp}"
$restoreDatabase = "${freshDatabase}_restore"
Assert-QaDatabaseName -Name $freshDatabase -SourceName $sourceDatabase
Assert-QaDatabaseName -Name $restoreDatabase -SourceName $sourceDatabase

$postgresBin = Resolve-PostgresBin
$createdb = Join-Path $postgresBin 'createdb.exe'
$dropdb = Join-Path $postgresBin 'dropdb.exe'
$psql = Join-Path $postgresBin 'psql.exe'
$pgDump = Join-Path $postgresBin 'pg_dump.exe'
$pgRestore = Join-Path $postgresBin 'pg_restore.exe'
$vacuumdb = Join-Path $postgresBin 'vacuumdb.exe'

New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
$dumpPath = Join-Path $runtimeDirectory "$freshDatabase.dump"
$freshCreated = $false
$restoreCreated = $false
$startedAt = [DateTime]::UtcNow
$env:PGPASSWORD = $env:DATABASE_PASSWORD

$countQuery = @'
SELECT json_build_object(
  'tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'),
  'admin_user', (SELECT count(*) FROM admin_user),
  'admin_role', (SELECT count(*) FROM admin_role),
  'admin_permission', (SELECT count(*) FROM admin_permission),
  'knex_migrations', (SELECT count(*) FROM knex_migrations)
)::text;
'@

try {
  Write-Host "Creating fresh QA database $freshDatabase."
  Invoke-NativeChecked `
    -FilePath $createdb `
    -ArgumentList @(
      '--host', $env:DATABASE_HOST,
      '--port', $env:DATABASE_PORT,
      '--username', $env:DATABASE_USER,
      $freshDatabase
    ) `
    -FailureMessage "Failed to create $freshDatabase."
  $freshCreated = $true

  Write-Host 'Applying deployment schema snapshot to the empty database.'
  Invoke-NativeChecked `
    -FilePath $psql `
    -ArgumentList @(
      '--host', $env:DATABASE_HOST,
      '--port', $env:DATABASE_PORT,
      '--username', $env:DATABASE_USER,
      '--dbname', $freshDatabase,
      '--set', 'ON_ERROR_STOP=1',
      '--file', $baselinePath
    ) `
    -FailureMessage 'Deployment schema snapshot failed on an empty database.'

  Invoke-NativeChecked `
    -FilePath $psql `
    -ArgumentList @(
      '--host', $env:DATABASE_HOST,
      '--port', $env:DATABASE_PORT,
      '--username', $env:DATABASE_USER,
      '--dbname', $freshDatabase,
      '--set', 'ON_ERROR_STOP=1',
      '--file', $migrationHistoryPath
    ) `
    -FailureMessage 'Deployment migration history failed on an empty database.'

  $env:DATABASE_NAME = $freshDatabase
  Write-Host 'Applying API migrations and auth-only bootstrap seed.'
  Push-Location $apiDirectory
  try {
    Invoke-NativeChecked `
      -FilePath 'npm.cmd' `
      -ArgumentList @('run', 'migrate:latest') `
      -FailureMessage 'API migrations failed on fresh physical schema.'
    Invoke-NativeChecked `
      -FilePath 'npm.cmd' `
      -ArgumentList @('run', 'seed:admin') `
      -FailureMessage 'Auth bootstrap seed failed on fresh physical schema.'
    Invoke-NativeChecked `
      -FilePath 'npm.cmd' `
      -ArgumentList @('run', 'seed:admin') `
      -FailureMessage 'Auth bootstrap seed was not idempotent on its second run.'
    Invoke-NativeChecked `
      -FilePath 'npm.cmd' `
      -ArgumentList @('run', 'db:check') `
      -FailureMessage 'Compiled API database check failed on fresh physical schema.'
  } finally {
    Pop-Location
  }
  Invoke-NativeChecked `
    -FilePath $vacuumdb `
    -ArgumentList @(
      '--host', $env:DATABASE_HOST,
      '--port', $env:DATABASE_PORT,
      '--username', $env:DATABASE_USER,
      '--analyze-in-stages',
      $freshDatabase
    ) `
    -FailureMessage 'Optimizer statistics refresh failed on fresh physical schema.'

  $freshCounts = (& $psql `
    --host $env:DATABASE_HOST `
    --port $env:DATABASE_PORT `
    --username $env:DATABASE_USER `
    --dbname $freshDatabase `
    --tuples-only `
    --no-align `
    --command $countQuery).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $freshCounts) {
    throw 'Failed to read fresh database verification counts.'
  }

  Write-Host 'Creating custom-format backup and restoring into a second QA database.'
  Invoke-NativeChecked `
    -FilePath $pgDump `
    -ArgumentList @(
      '--host', $env:DATABASE_HOST,
      '--port', $env:DATABASE_PORT,
      '--username', $env:DATABASE_USER,
      '--dbname', $freshDatabase,
      '--format', 'custom',
      '--no-owner',
      '--no-privileges',
      '--file', $dumpPath
    ) `
    -FailureMessage 'Fresh database backup failed.'

  Invoke-NativeChecked `
    -FilePath $createdb `
    -ArgumentList @(
      '--host', $env:DATABASE_HOST,
      '--port', $env:DATABASE_PORT,
      '--username', $env:DATABASE_USER,
      $restoreDatabase
    ) `
    -FailureMessage "Failed to create $restoreDatabase."
  $restoreCreated = $true

  Invoke-NativeChecked `
    -FilePath $pgRestore `
    -ArgumentList @(
      '--host', $env:DATABASE_HOST,
      '--port', $env:DATABASE_PORT,
      '--username', $env:DATABASE_USER,
      '--dbname', $restoreDatabase,
      '--no-owner',
      '--no-privileges',
      '--exit-on-error',
      '--single-transaction',
      $dumpPath
    ) `
    -FailureMessage 'Backup restore failed.'
  Invoke-NativeChecked `
    -FilePath $vacuumdb `
    -ArgumentList @(
      '--host', $env:DATABASE_HOST,
      '--port', $env:DATABASE_PORT,
      '--username', $env:DATABASE_USER,
      '--analyze-in-stages',
      $restoreDatabase
    ) `
    -FailureMessage 'Optimizer statistics refresh failed after backup restore.'

  $restoreCounts = (& $psql `
    --host $env:DATABASE_HOST `
    --port $env:DATABASE_PORT `
    --username $env:DATABASE_USER `
    --dbname $restoreDatabase `
    --tuples-only `
    --no-align `
    --command $countQuery).Trim()
  if ($LASTEXITCODE -ne 0 -or -not $restoreCounts) {
    throw 'Failed to read restored database verification counts.'
  }
  if ($freshCounts -ne $restoreCounts) {
    throw "Restore verification mismatch.`nFresh: $freshCounts`nRestore: $restoreCounts"
  }

  $duration = [Math]::Round(([DateTime]::UtcNow - $startedAt).TotalSeconds, 2)
  $report = @"
# Song Thanh — Fresh schema and restore rehearsal

- Generated at: $([DateTime]::UtcNow.ToString('o'))
- Result: **PASS**
- Duration: ${duration}s
- Source database used for credentials only: ``$sourceDatabase``
- Fresh QA database: ``$freshDatabase``
- Restore QA database: ``$restoreDatabase``

## Evidence

1. Created a truly empty PostgreSQL database.
2. Applied the versioned deployment schema and its matching Knex migration ledger with ``ON_ERROR_STOP``.
3. Confirmed ``migrate:latest`` sees the snapshot as current and can apply future migrations normally.
4. Ran the auth-only bootstrap seed twice and verified the second run is idempotent; news/demo seeds were not executed.
5. Ran the compiled API ``--db-check`` path.
6. Created a custom-format backup.
7. Restored with ``--exit-on-error --single-transaction`` into a second empty QA database.
8. Refreshed PostgreSQL optimizer statistics after schema creation and after restore.
9. Compared table/auth/migration counts after restore.

Verification snapshot:

```json
$freshCounts
```

Both QA databases and the temporary dump are removed in ``finally`` using a strict
``*_fresh_qa_YYYYMMDDHHMMSS`` whitelist. Production/development data is not mutated.
"@
  New-Item -ItemType Directory -Force -Path (Split-Path $outputPath) | Out-Null
  Set-Content -LiteralPath $outputPath -Value $report -Encoding UTF8
  Write-Host "Fresh schema and restore rehearsal PASS in ${duration}s."
} finally {
  $env:DATABASE_NAME = $sourceDatabase

  if ($restoreCreated) {
    Assert-QaDatabaseName -Name $restoreDatabase -SourceName $sourceDatabase
    & $dropdb `
      --host $env:DATABASE_HOST `
      --port $env:DATABASE_PORT `
      --username $env:DATABASE_USER `
      --if-exists `
      --force `
      $restoreDatabase
  }

  if ($freshCreated) {
    Assert-QaDatabaseName -Name $freshDatabase -SourceName $sourceDatabase
    & $dropdb `
      --host $env:DATABASE_HOST `
      --port $env:DATABASE_PORT `
      --username $env:DATABASE_USER `
      --if-exists `
      --force `
      $freshDatabase
  }

  if (Test-Path -LiteralPath $dumpPath) {
    Remove-Item -LiteralPath $dumpPath -Force
  }
  Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
