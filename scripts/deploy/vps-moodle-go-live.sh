#!/usr/bin/env bash
# Full Moodle go-live on VPS: provision containers, install SSO plugin, deploy ERP, smoke test.
# Run on VPS as root/deploy user:
#   cd /opt/nep-erp && git pull origin master && bash scripts/deploy/vps-moodle-go-live.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

echo "=== Moodle go-live orchestration ==="
echo "Time: $(date -Is)"

if [[ ! -f .env ]]; then
  echo "Missing .env — set MOODLE_DB_PASSWORD, MOODLE_ADMIN_PASSWORD, MOODLE_SSO_SECRET, MOODLE_TOKEN_ENCRYPTION_KEY" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

for var in MOODLE_DB_PASSWORD MOODLE_ADMIN_PASSWORD MOODLE_SSO_SECRET MOODLE_TOKEN_ENCRYPTION_KEY; do
  if [[ -z "${!var:-}" ]]; then
    echo "Set ${var} in .env before go-live." >&2
    exit 1
  fi
done

echo "[1/5] ERP safe deploy (migrations, api, web)…"
bash scripts/deploy/vps-update-erp-safe.sh

echo "[2/5] Moodle containers + nginx vhost…"
bash scripts/deploy/vps-provision-moodle.sh

echo "[3/5] Moodle permissions for admin roles…"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db \
  run --rm -e DATABASE_URL="${DATABASE_URL}" api \
  npx --yes tsx scripts/grant-moodle-permissions.ts || true

echo "[4/5] Install ERP SSO auth plugin into Moodle…"
bash scripts/deploy/vps-install-moodle-auth-plugin.sh

echo "[5/5] Smoke test…"
bash scripts/deploy/vps-smoke-moodle.sh

echo "=== Moodle go-live orchestration complete ==="
