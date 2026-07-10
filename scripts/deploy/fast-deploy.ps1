# Fast production deploy from Windows.
# 1) Pushes current branch to origin
# 2) SSHs to VPS and runs scripts/deploy/vps-update.sh (pull + rebuild + migrate + restart)
#
# Usage (from repo root):
#   .\scripts\deploy\fast-deploy.ps1
#
# Options:
#   .\scripts\deploy\fast-deploy.ps1 -SkipPush
#   .\scripts\deploy\fast-deploy.ps1 -VpsHost 82.25.110.120
param(
  [string]$VpsHost = "82.25.110.120",
  [string]$VpsUser = "root",
  [string]$RemoteDir = "/opt/nep-erp",
  [switch]$SkipPush
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $RepoRoot

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Branch: $branch" -ForegroundColor Cyan

if (-not $SkipPush) {
  Write-Host "Pushing to origin/$branch ..." -ForegroundColor Cyan
  git push -u origin HEAD
  if ($LASTEXITCODE -ne 0) {
    Write-Host "git push failed." -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

Write-Host "Deploying on ${VpsUser}@${VpsHost} ($RemoteDir) ..." -ForegroundColor Cyan
ssh "${VpsUser}@${VpsHost}" "cd $RemoteDir && bash scripts/deploy/vps-update.sh"
if ($LASTEXITCODE -ne 0) {
  Write-Host "VPS update failed (exit $LASTEXITCODE)." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Done. Hard-refresh https://erp.donboscocollege.ac.in (Ctrl+Shift+R)." -ForegroundColor Green
Write-Host "Mobile APK (separate): cd apps\mobile; eas build --profile preview --platform android" -ForegroundColor DarkGray
