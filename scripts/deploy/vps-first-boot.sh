#!/usr/bin/env bash
# One-time Ubuntu 24.04 VPS setup for Don Bosco College ERP.
# Run as root on the Hostinger VPS:
#   curl -fsSL ... | bash
#   OR: bash scripts/deploy/vps-first-boot.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
DOMAIN_ERP="${DOMAIN_ERP:-erp.donboscocollege.ac.in}"

echo "=== NEP ERP — VPS first boot ==="
echo "App directory: $APP_DIR"
echo "Primary domain: $DOMAIN_ERP"
echo

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (ssh root@82.25.110.120)" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git ufw openssl

# Docker Engine + Compose plugin
if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker…"
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# Firewall
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo "Firewall: SSH + HTTP + HTTPS allowed"

mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  if [[ -f scripts/deploy/production.env.example ]]; then
    cp scripts/deploy/production.env.example .env
  else
    echo "Place production.env.example at $APP_DIR/scripts/deploy/ and re-run" >&2
    exit 1
  fi
  DB_PASS="$(openssl rand -hex 16)"
  JWT_ACCESS="$(openssl rand -hex 32)"
  JWT_REFRESH="$(openssl rand -hex 32)"
  sed -i "s/CHANGE_ME_DB_PASSWORD/$DB_PASS/g" .env
  sed -i "s/CHANGE_ME_64_CHAR_RANDOM_ACCESS_SECRET_MIN_32_CHARS/$JWT_ACCESS/" .env
  sed -i "s/CHANGE_ME_64_CHAR_RANDOM_REFRESH_SECRET_MIN_32_CHARS/$JWT_REFRESH/" .env
  echo "Created $APP_DIR/.env with random secrets — back this file up securely."
else
  echo ".env already exists — skipped secret generation"
fi

echo
echo "=== Next steps ==="
echo "1. Upload or git clone the ERP repo into: $APP_DIR"
echo "2. Edit $APP_DIR/.env if needed"
echo "3. Point DNS A records to this server IP (82.25.110.120):"
echo "     erp.donboscocollege.ac.in"
echo "     admissions.donboscocollege.ac.in"
echo "     library.donboscocollege.ac.in"
echo "4. Run: bash scripts/deploy/vps-deploy.sh"
echo
