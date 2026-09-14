#!/usr/bin/env bash
# Join ERP nginx to Koha on a dedicated edge network (not the ERP app network).
# Fixes 504: nginx cannot reach Koha ports published only on 127.0.0.1.
# Does not recreate koha-web (recreate wipes /etc/koha/sites).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
NET="${KOHA_EDGE_NET:-koha_nginx_edge}"
NGINX_COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

cd "$APP_DIR"

docker network create "$NET" >/dev/null 2>&1 || true

connect() {
  local ctn="$1"
  if ! docker inspect "$ctn" >/dev/null 2>&1; then
    echo "WARN: container ${ctn} not running"
    return 0
  fi
  docker network connect "$NET" "$ctn" 2>/dev/null || true
}

connect koha-web
connect koha-inout

NGINX_ID="$("${NGINX_COMPOSE[@]}" ps -q nginx | head -1)"
if [[ -z "$NGINX_ID" ]]; then
  echo "ERROR: ERP nginx container not found" >&2
  exit 1
fi
docker network connect "$NET" "$NGINX_ID" 2>/dev/null || true

CONF="${APP_DIR}/nginx/extra-sites.d/koha-dbc.conf"
if [[ -f "$CONF" ]]; then
  sed -i \
    -e 's#http://host.docker.internal:16080#http://koha-web:8080#g' \
    -e 's#http://host.docker.internal:16081#http://koha-web:8081#g' \
    -e 's#http://host.docker.internal:16082#http://koha-inout:80#g' \
    "$CONF"
fi

"${NGINX_COMPOSE[@]}" exec -T nginx nginx -t
"${NGINX_COMPOSE[@]}" exec -T nginx nginx -s reload

echo "--- From nginx to Koha ---"
"${NGINX_COMPOSE[@]}" exec -T nginx wget -S -O /dev/null --timeout=8 http://koha-web:8080/ 2>&1 | tail -20 || true
echo "OPAC:  https://koha.donboscocollege.ac.in/"
echo "Staff: https://staff.koha.donboscocollege.ac.in/"
