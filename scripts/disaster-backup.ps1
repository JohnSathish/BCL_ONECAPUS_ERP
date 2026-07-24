# Full disaster-recovery backup for 1505NEWERP (source + PostgreSQL + uploads + env).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/disaster-backup.ps1

$ErrorActionPreference = 'Stop'
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupParent = Join-Path (Split-Path $ProjectRoot -Parent) '1505NEWERP-disaster-backups'
$Staging = Join-Path $BackupParent "DR-$timestamp"
$ArchivePath = Join-Path $BackupParent "1505NEWERP-DR-$timestamp.tar.gz"

New-Item -ItemType Directory -Path $Staging -Force | Out-Null
Write-Host "Staging backup at $Staging"

# --- Database dump (Docker Postgres on 15432) ---
$dbDir = Join-Path $Staging 'database'
New-Item -ItemType Directory -Path $dbDir -Force | Out-Null
$dbFile = Join-Path $dbDir 'nep_erp.dump'
$pgContainer = '1505newerp-postgres-1'
$containerRunning = docker ps --format '{{.Names}}' 2>$null | Select-String -SimpleMatch $pgContainer
if ($containerRunning) {
  Write-Host "Dumping database from $pgContainer ..."
  docker exec $pgContainer pg_dump -U nep -Fc --no-owner --no-acl -f /tmp/nep_erp_dr.dump nep_erp
  if ($LASTEXITCODE -ne 0) { throw 'docker pg_dump failed' }
  docker cp "${pgContainer}:/tmp/nep_erp_dr.dump" $dbFile
  docker exec $pgContainer rm -f /tmp/nep_erp_dr.dump | Out-Null
  $dbSize = (Get-Item $dbFile).Length
  $dbSizeMb = [math]::Round($dbSize / 1MB, 2)
  Write-Host "Database dump: $dbSizeMb megabytes"
} else {
  Write-Warning "Container $pgContainer not running - trying local pg_dump on port 15432"
  $env:PGPASSWORD = 'nep_dev_password'
  & pg_dump -h 127.0.0.1 -p 15432 -U nep -Fc --no-owner --no-acl -f $dbFile nep_erp
  if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed. Start docker compose postgres first.' }
}

# --- Environment / config ---
$configDir = Join-Path $Staging 'config'
New-Item -ItemType Directory -Path $configDir -Force | Out-Null
$envFiles = @(
  'apps\api\.env',
  'apps\api\.env.example',
  'apps\web\.env.local',
  'apps\web\.env.example',
  'apps\mobile\.env',
  'apps\mobile\.env.example',
  'apps\mobile\.env.production.example',
  'docker-compose.yml',
  'docker-compose.prod.yml',
  'scripts\deploy\production.env.example'
)
foreach ($rel in $envFiles) {
  $src = Join-Path $ProjectRoot $rel
  if (Test-Path $src) {
    $destName = ($rel -replace '[\\/]', '__')
    Copy-Item $src (Join-Path $configDir $destName) -Force
  }
}
git -C $ProjectRoot rev-parse HEAD | Out-File (Join-Path $configDir 'git-commit.txt') -Encoding utf8
git -C $ProjectRoot status --short | Out-File (Join-Path $configDir 'git-status.txt') -Encoding utf8

# --- Local uploads & storage ---
$dataDir = Join-Path $Staging 'data'
New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
foreach ($folder in @('apps\api\storage', 'apps\api\uploads')) {
  $src = Join-Path $ProjectRoot $folder
  if (Test-Path $src) {
    $name = Split-Path $folder -Leaf
    Write-Host "Copying $folder ..."
    robocopy $src (Join-Path $dataDir $name) /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  }
}

# --- Project source (exclude heavy/regenerable dirs) ---
$sourceDir = Join-Path $Staging 'source'
New-Item -ItemType Directory -Path $sourceDir -Force | Out-Null
Write-Host 'Copying project source (excluding node_modules, .next, build caches)...'
$robocopyExcludes = @(
  'node_modules', '.next', 'dist', '.turbo', 'coverage', '.cache',
  'android\.gradle', 'android\app\build', 'android\build', 'ios\Pods',
  '1505NEWERP-disaster-backups'
)
$excludeArgs = $robocopyExcludes | ForEach-Object { '/XD'; $_ }
robocopy $ProjectRoot $sourceDir /E /NFL /NDL /NJH /NJS /nc /ns /np @excludeArgs | Out-Null

# --- Restore instructions ---
Copy-Item (Join-Path $PSScriptRoot 'disaster-backup-RESTORE.md') (Join-Path $Staging 'RESTORE.md') -Force

# --- Create compressed archive ---
Write-Host "Creating archive $ArchivePath ..."
if (Test-Path $ArchivePath) { Remove-Item $ArchivePath -Force }
tar -czf $ArchivePath -C $BackupParent (Split-Path $Staging -Leaf)
$archiveSize = (Get-Item $ArchivePath).Length
$archiveSizeMb = [math]::Round($archiveSize / 1MB, 1)
$archiveSizeGb = [math]::Round($archiveSize / 1GB, 2)
Write-Host ""
Write-Host "=== BACKUP COMPLETE ==="
Write-Host "Archive: $ArchivePath"
Write-Host ('Size: {0} GB ({1} MB)' -f $archiveSizeGb, $archiveSizeMb)
Write-Host "Staging folder kept at: $Staging"
