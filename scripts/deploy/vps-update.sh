#!/usr/bin/env bash
# Quick production update — pull latest code, rebuild web+api, restart stack.
# Run on VPS: bash scripts/deploy/vps-update.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "=== NEP ERP — quick update ==="
git pull origin master

if [[ -f /etc/letsencrypt/live/erp.donboscocollege.ac.in/fullchain.pem ]]; then
  echo "Applying HTTPS nginx config…"
  cp nginx/nginx.ssl.conf nginx/nginx.conf
fi

echo "Rebuilding web + api (required after frontend/auth fixes)…"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db build --no-cache web api

echo "Restarting services…"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db up -d api web worker nginx

echo "Fixing upload volume permissions…"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db exec -u root api \
  chown -R nestjs:nodejs /data/uploads /data/storage /data/backups 2>/dev/null || true

echo
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db ps
echo
curl -sf "https://${NEXT_PUBLIC_LOGIN_HOST:-erp.donboscocollege.ac.in}/api/health/live" | head -c 200
echo
echo "=== Update complete — hard-refresh browser (Ctrl+Shift+R) and log in at /login ==="
