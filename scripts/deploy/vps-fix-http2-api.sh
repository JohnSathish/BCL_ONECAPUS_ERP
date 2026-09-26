#!/usr/bin/env bash
# Recover ERP/pay after deploy when browsers show ERR_HTTP2_PROTOCOL_ERROR /
# ERR_CONNECTION_CLOSED on /api/v1/* (upstream dropped while HTTP/2 multiplexed).
#
# Run on VPS:
#   cd /opt/nep-erp && bash scripts/deploy/vps-fix-http2-api.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib-erp-net.sh"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

echo "=== Fix HTTP/2 / API connection drops ==="
echo "Time: $(date -Is)"
echo "Commit: $(git log -1 --oneline)"

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "--- Ensure nginx.conf is current ---"
if [[ -f /etc/letsencrypt/live/donboscocollege.ac.in/fullchain.pem ]] \
  && [[ -f nginx/nginx.combined-dbc.ssl.conf ]] \
  && docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
else
  cp nginx/nginx.ssl.conf nginx/nginx.conf
fi
"${COMPOSE[@]}" run --rm --no-deps nginx nginx -t

echo "--- Restart API + web + nginx (fresh upstream sockets) ---"
"${COMPOSE[@]}" up -d --force-recreate --no-deps api
"${COMPOSE[@]}" up -d --wait --wait-timeout 180 api
"${COMPOSE[@]}" up -d --force-recreate --no-deps web
"${COMPOSE[@]}" up -d --force-recreate --no-deps nginx

ERP_NET="$(pick_erp_docker_net "$("${COMPOSE[@]}" ps -q nginx 2>/dev/null | head -1 || true)" "$(basename "$APP_DIR")_default")"
if docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  docker network connect "${ERP_NET}" donboscocollege-web 2>/dev/null || true
fi

sleep 3
HOST="${NEXT_PUBLIC_LOGIN_HOST:-erp.donboscocollege.ac.in}"

echo "--- Health probes ---"
curl -sf "https://${HOST}/api/health/live" | head -c 240 || echo "API live probe FAILED"
echo
curl -sf -o /dev/null -w "erp_login:%{http_code}\n" "https://${HOST}/login" || echo "erp_login:fail"
curl -sf -o /dev/null -w "pay_home:%{http_code}\n" "https://pay.donboscocollege.ac.in/" || echo "pay_home:fail"
curl -sf -o /dev/null -w "pay_challenge:%{http_code}\n" \
  -H "X-Login-Host: pay.donboscocollege.ac.in" \
  "https://pay.donboscocollege.ac.in/api/v1/public/fees/challenge" || echo "pay_challenge:fail"

echo
echo "Done. Hard-refresh the browser (Ctrl+Shift+R). If Cloudflare is enabled, also purge cache"
echo "for erp/pay, or temporarily disable 'HTTP/2 to Origin' under Network."
echo "=== Fix finished ==="
