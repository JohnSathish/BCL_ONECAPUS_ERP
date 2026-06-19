#!/usr/bin/env bash
# Quick production update — pull latest code, rebuild web+api, restart stack.
# Run on VPS: bash scripts/deploy/vps-update.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "=== NEP ERP — quick update ==="
bash scripts/deploy/vps-pull.sh

if [[ -f /etc/letsencrypt/live/erp.donboscocollege.ac.in/fullchain.pem ]]; then
  echo "Applying HTTPS nginx config…"
  cp nginx/nginx.ssl.conf nginx/nginx.conf
fi

echo "Validating nginx config…"
"${COMPOSE[@]}" run --rm --no-deps nginx nginx -t

echo "Rebuilding web + api (required after frontend/auth fixes)…"
"${COMPOSE[@]}" build --no-cache web api

echo "Starting data services…"
"${COMPOSE[@]}" up -d postgres redis

echo "Applying database migrations…"
bash scripts/deploy/vps-migrate.sh

echo "Starting API and waiting until healthy…"
"${COMPOSE[@]}" up -d --wait --wait-timeout 180 api

echo "Starting web, worker, nginx…"
"${COMPOSE[@]}" up -d web worker nginx

echo "Fixing upload volume permissions…"
"${COMPOSE[@]}" exec -u root api \
  chown -R nestjs:nodejs /data/uploads /data/storage /data/backups 2>/dev/null || true

echo
"${COMPOSE[@]}" ps
echo

HOST="${NEXT_PUBLIC_LOGIN_HOST:-erp.donboscocollege.ac.in}"
echo "Health checks:"
curl -sf "https://${HOST}/api/health/live" | head -c 200 || curl -sf "http://localhost/api/health/live" | head -c 200
echo
curl -sf "https://${HOST}/api/health/ready" | head -c 400 || curl -sf "http://localhost/api/health/ready" | head -c 400
echo
echo "=== Update complete — hard-refresh browser (Ctrl+Shift+R) and log in at /login ==="
