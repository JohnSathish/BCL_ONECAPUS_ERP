# Creates a portable migration pack for moving 1505NEWERP to another machine.
# Usage: .\scripts\create-migration-pack.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$date = Get-Date -Format "yyyyMMdd-HHmmss"
$root = Join-Path $ProjectRoot "_migration-pack\$date"

$dirs = @(
  "$root\database",
  "$root\files\uploads",
  "$root\files\storage",
  "$root\files\backups",
  "$root\config",
  "$root\cursor-chat",
  "$root\prisma-migrations"
)
foreach ($d in $dirs) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

Write-Host "Migration pack: $root"

# Database (requires Docker postgres container)
$pgContainer = docker ps --format "{{.Names}}" | Select-String "1505newerp-postgres" | Select-Object -First 1
if (-not $pgContainer) {
  Write-Warning "Postgres container not running. Start with: docker compose up -d postgres"
  exit 1
}

Write-Host "Dumping database from $pgContainer..."
docker exec $pgContainer pg_dump -U nep -d nep_erp --no-owner --no-acl -F p | Set-Content -Encoding utf8 "$root\database\nep_erp_full.sql"
docker exec $pgContainer pg_dump -U nep -d nep_erp --no-owner --no-acl -F c -f /tmp/nep_erp.dump
docker cp "${pgContainer}:/tmp/nep_erp.dump" "$root\database\nep_erp_full.dump"

# Local file assets
$copyPairs = @(
  @("$ProjectRoot\apps\api\uploads", "$root\files\uploads"),
  @("$ProjectRoot\apps\api\storage", "$root\files\storage"),
  @("$ProjectRoot\backups", "$root\files\backups")
)
foreach ($pair in $copyPairs) {
  if (Test-Path $pair[0]) {
    robocopy $pair[0] $pair[1] /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  }
}

# Config (includes secrets — keep pack private)
Copy-Item "$ProjectRoot\apps\api\.env" "$root\config\api.env" -ErrorAction SilentlyContinue
Copy-Item "$ProjectRoot\apps\web\.env.local" "$root\config\web.env.local" -ErrorAction SilentlyContinue
Copy-Item "$ProjectRoot\apps\api\.env.example" "$root\config\api.env.example"
Copy-Item "$ProjectRoot\apps\web\.env.example" "$root\config\web.env.example"

# Prisma migrations
$migSrc = "$ProjectRoot\apps\api\prisma\migrations"
if (Test-Path $migSrc) {
  robocopy $migSrc "$root\prisma-migrations" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
}

# Cursor chat history (optional — path varies by user)
$chatCandidates = @(
  "$env:USERPROFILE\.cursor\projects\e-Projects-1505NEWERP\agent-transcripts",
  "$env:USERPROFILE\.cursor\projects\1505NEWERP\agent-transcripts"
)
foreach ($chatSrc in $chatCandidates) {
  if (Test-Path $chatSrc) {
    robocopy $chatSrc "$root\cursor-chat\agent-transcripts" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    break
  }
}

# Point LATEST symlink (junction on Windows)
$latest = Join-Path $ProjectRoot "_migration-pack\LATEST"
if (Test-Path $latest) { Remove-Item $latest -Recurse -Force -ErrorAction SilentlyContinue }
cmd /c mklink /J `"$latest`" `"$root`" | Out-Null

Write-Host "Pack created at: $root"
Write-Host "Also linked: _migration-pack\LATEST"
Write-Host "Copy the entire project folder (including _migration-pack) to the new system."
