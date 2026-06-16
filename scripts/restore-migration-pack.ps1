# Restores a migration pack on a new development machine.
# Usage: .\scripts\restore-migration-pack.ps1 [-PackDir "E:\Projects\1505NEWERP\_migration-pack\LATEST"]

param(
  [string]$PackDir = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

if (-not $PackDir) {
  $PackDir = Join-Path $ProjectRoot "_migration-pack\LATEST"
}
if (-not (Test-Path $PackDir)) {
  Write-Error "Pack not found: $PackDir. Run create-migration-pack.ps1 on the old machine first."
}

Write-Host "Restoring from: $PackDir"

# 1) Start infrastructure
Set-Location $ProjectRoot
npm run dev:infra

$pgContainer = docker ps --format "{{.Names}}" | Select-String "1505newerp-postgres" | Select-Object -First 1
if (-not $pgContainer) {
  Write-Error "Postgres container not running after dev:infra"
}

# 2) Restore database
$sql = Join-Path $PackDir "database\nep_erp_full.sql"
$dump = Join-Path $PackDir "database\nep_erp_full.dump"
if (Test-Path $dump) {
  Write-Host "Restoring database from custom dump..."
  docker cp $dump "${pgContainer}:/tmp/nep_erp_restore.dump"
  docker exec $pgContainer pg_restore -U nep -d nep_erp --clean --if-exists --no-owner --no-acl /tmp/nep_erp_restore.dump 2>&1
} elseif (Test-Path $sql) {
  Write-Host "Restoring database from SQL (may take a few minutes)..."
  cmd /c "type `"$sql`" | docker exec -i $pgContainer psql -U nep -d nep_erp" 2>&1
} else {
  Write-Warning "No database backup found in pack. Run npm run db:migrate && npm run db:seed instead."
}

# 3) Restore file assets
$restorePairs = @(
  @("$PackDir\files\uploads", "$ProjectRoot\apps\api\uploads"),
  @("$PackDir\files\storage", "$ProjectRoot\apps\api\storage"),
  @("$PackDir\files\backups", "$ProjectRoot\backups")
)
foreach ($pair in $restorePairs) {
  if (Test-Path $pair[0]) {
    New-Item -ItemType Directory -Force -Path $pair[1] | Out-Null
    robocopy $pair[0] $pair[1] /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  }
}

# 4) Restore env files
$apiEnv = Join-Path $PackDir "config\api.env"
$webEnv = Join-Path $PackDir "config\web.env.local"
if (Test-Path $apiEnv) { Copy-Item $apiEnv "$ProjectRoot\apps\api\.env" -Force }
if (Test-Path $webEnv) { Copy-Item $webEnv "$ProjectRoot\apps\web\.env.local" -Force }
if (-not (Test-Path "$ProjectRoot\apps\api\.env")) {
  Copy-Item "$ProjectRoot\apps\api\.env.example" "$ProjectRoot\apps\api\.env"
}
if (-not (Test-Path "$ProjectRoot\apps\web\.env.local")) {
  Copy-Item "$ProjectRoot\apps\web\.env.example" "$ProjectRoot\apps\web\.env.local"
}

# 5) Restore prisma migrations into repo if present
$migPack = Join-Path $PackDir "prisma-migrations"
$migDest = "$ProjectRoot\apps\api\prisma\migrations"
if ((Test-Path $migPack) -and (Get-ChildItem $migPack -ErrorAction SilentlyContinue)) {
  New-Item -ItemType Directory -Force -Path $migDest | Out-Null
  robocopy $migPack $migDest /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
}

# 6) Optional: restore Cursor chat to new machine path
$chatPack = Join-Path $PackDir "cursor-chat\agent-transcripts"
if (Test-Path $chatPack) {
  $chatDest = "$env:USERPROFILE\.cursor\projects\e-Projects-1505NEWERP\agent-transcripts"
  New-Item -ItemType Directory -Force -Path $chatDest | Out-Null
  robocopy $chatPack $chatDest /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  Write-Host "Cursor chat restored to: $chatDest"
}

Write-Host ""
Write-Host "Next steps:"
Write-Host "  npm install"
Write-Host "  npm run db:generate"
Write-Host "  npm run dev"
Write-Host "  Open http://localhost:3000 — login demo / admin@demo.edu / Admin@123"
