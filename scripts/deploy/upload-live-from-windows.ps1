# Upload cleaned local database + deploy latest code to live VPS.
#
# Prerequisites:
#   - SSH access: ssh root@82.25.110.120
#   - Dump file at repo root: nep_erp_live_upload.dump
#   - Latest code already pushed: git push origin master
#
# Usage (PowerShell from repo root):
#   .\scripts\deploy\upload-live-from-windows.ps1
#
param(
  [string]$VpsHost = "82.25.110.120",
  [string]$VpsUser = "root",
  [string]$DumpFile = "nep_erp_live_upload.dump",
  [string]$RemoteDir = "/opt/nep-erp"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$DumpPath = Join-Path $RepoRoot $DumpFile

if (-not (Test-Path $DumpPath)) {
  Write-Host "Missing dump: $DumpPath" -ForegroundColor Red
  Write-Host "Create it with:"
  Write-Host "  docker exec 1505newerp-postgres-1 pg_dump -U nep nep_erp -Fc -f /tmp/nep_erp_live_upload.dump"
  Write-Host "  docker cp 1505newerp-postgres-1:/tmp/nep_erp_live_upload.dump $DumpPath"
  exit 1
}

$sizeMb = [math]::Round((Get-Item $DumpPath).Length / 1MB, 2)
Write-Host "Uploading $DumpFile ($sizeMb MB) to ${VpsUser}@${VpsHost}:${RemoteDir}/"
scp $DumpPath "${VpsUser}@${VpsHost}:${RemoteDir}/$DumpFile"

Write-Host "Running restore + deploy on VPS..."
ssh "${VpsUser}@${VpsHost}" @"
set -e
cd $RemoteDir
git pull origin master
bash scripts/deploy/vps-restore-db-and-update.sh $DumpFile
"@

if ($LASTEXITCODE -ne 0) {
  Write-Host "Deploy failed (exit $LASTEXITCODE). SSH to VPS and check logs." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host "Done. Open https://erp.donboscocollege.ac.in and hard-refresh (Ctrl+Shift+R)."
