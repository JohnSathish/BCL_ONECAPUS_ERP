#!/usr/bin/env bash
# Apply nginx HTTP/1.1-only ERP vhost + recreate api/web/nginx.
# Fixes dashboard / branding stuck on ERR_HTTP2_PROTOCOL_ERROR.
#
#   cd /opt/nep-erp && git pull origin master && bash scripts/deploy/vps-disable-erp-http2.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib-erp-net.sh"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

echo "=== Disable ERP HTTP/2 + restart gateways ==="
echo "Commit: $(git log -1 --oneline)"

if [[ -f /etc/letsencrypt/live/donboscocollege.ac.in/fullchain.pem ]] \
  && [[ -f nginx/nginx.combined-dbc.ssl.conf ]] \
  && docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
  echo "Using combined ERP + college nginx.conf"
else
  cp nginx/nginx.ssl.conf nginx/nginx.conf
  echo "Using ERP-only nginx.conf"
fi

# Guard: ERP server block must not enable http2
if grep -n "http2 on" nginx/nginx.conf | grep -E "erp\.|pay\.|default_server" >/dev/null 2>&1; then
  echo "WARN: http2 still referenced near ERP hosts — checking full file"
fi
if awk '/server_name/{buf=$0} /http2 on/{print NR":"$0" :: "buf}' nginx/nginx.conf | grep -E "erp\.|pay\." >/dev/null 2>&1; then
  echo "ERROR: http2 on still active for ERP/pay server_name — aborting" >&2
  exit 1
fi

"${COMPOSE[@]}" run --rm --no-deps nginx nginx -t

echo "Recreating api → web → nginx…"
"${COMPOSE[@]}" up -d --force-recreate --no-deps api
"${COMPOSE[@]}" up -d --wait --wait-timeout 180 api
"${COMPOSE[@]}" up -d --force-recreate --no-deps web
"${COMPOSE[@]}" up -d --force-recreate --no-deps nginx

ERP_NET="$(pick_erp_docker_net "$("${COMPOSE[@]}" ps -q nginx 2>/dev/null | head -1 || true)" "$(basename "$APP_DIR")_default")"
if docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  docker network connect "${ERP_NET}" donboscocollege-web 2>/dev/null || true
fi

sleep 4
HOST="${NEXT_PUBLIC_LOGIN_HOST:-erp.donboscocollege.ac.in}"

echo "--- Probes ---"
curl -sI "https://${HOST}/login" | tr -d '\r' | head -n 8 || true
curl -sf "https://${HOST}/api/health/live" | head -c 200 || echo "API health FAILED"
echo
curl -sf -o /dev/null -w "pay:%{http_code}\n" "https://pay.donboscocollege.ac.in/" || echo "pay:fail"

echo
echo "Hard-refresh ERP (Ctrl+Shift+R). Expect HTTP/1.1 in DevTools → Network protocol column."
echo "If Cloudflare sits in front: Network → HTTP/2 to Origin = Off, then purge cache."
echo "=== Done ==="
