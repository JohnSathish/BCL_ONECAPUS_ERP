# Fast TPS production configure + deploy from Windows.
# Requires SSH access to the VPS (root@82.25.110.120).
#
# Usage (repo root):
#   .\scripts\deploy\fast-deploy-tps.ps1
#   .\scripts\deploy\fast-deploy-tps.ps1 -SkipPush
#   .\scripts\deploy\fast-deploy-tps.ps1 -SslOnly
param(
  [string]$VpsHost = "82.25.110.120",
  [string]$VpsUser = "root",
  [string]$RemoteDir = "/opt/nep-erp",
  [switch]$SkipPush,
  [switch]$SslOnly
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
    Write-Host "git push to origin failed — fix remotes or use -SkipPush after manual push." -ForegroundColor Red
    exit $LASTEXITCODE
  }
}

$remoteCmd = if ($SslOnly) {
  "cd $RemoteDir && git pull && SKIP_CODE_DEPLOY=1 bash scripts/deploy/vps-configure-tps.sh"
} else {
  "cd $RemoteDir && bash scripts/deploy/vps-configure-tps.sh"
}

Write-Host "Configuring TPS on ${VpsUser}@${VpsHost} ..." -ForegroundColor Cyan
ssh "${VpsUser}@${VpsHost}" $remoteCmd
if ($LASTEXITCODE -ne 0) {
  Write-Host "TPS configure failed (exit $LASTEXITCODE)." -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Applicant: https://admission.turapublicschool.com/" -ForegroundColor Green
Write-Host "Admin:     https://erp.turapublicschool.com/login" -ForegroundColor Green
Write-Host "Verify DBC still up: https://donboscocollege.ac.in/ and https://erp.donboscocollege.ac.in/login" -ForegroundColor DarkGray
