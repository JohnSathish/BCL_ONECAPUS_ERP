#!/usr/bin/env bash
# Repair college website 502 only — does NOT pull code or rebuild ERP.
# Run on VPS: bash scripts/deploy/vps-repair-college-site.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

echo "=== Repair: college website only (no ERP deploy) ==="
echo "Time: $(date -Is)"
echo

resolve_erp_net() {
  local net
  net=$("${COMPOSE[@]}" ps -q nginx 2>/dev/null | xargs -r docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null | head -1 || true)
  if [[ -z "${net}" ]]; then
    net="$(basename "$APP_DIR")_default"
  fi
  echo "${net}"
}

if ! docker ps -a --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  echo "ERROR: container 'donboscocollege-web' not found."
  echo "College site is proxied to that container. Restore it, then re-run."
  exit 1
fi

echo "--- Start / restart college container ---"
docker start donboscocollege-web >/dev/null 2>&1 || true
sleep 2
if ! docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  echo "Start failed — trying restart…"
  docker restart donboscocollege-web >/dev/null 2>&1 || true
  sleep 3
fi

if ! docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  echo "ERROR: donboscocollege-web is not running."
  echo "Logs:"
  docker logs donboscocollege-web --tail 80 || true
  exit 1
fi
echo "donboscocollege-web is running."

ERP_NET="$(resolve_erp_net)"
echo "ERP docker network: ${ERP_NET}"

if docker network inspect "${ERP_NET}" >/dev/null 2>&1; then
  docker network connect "${ERP_NET}" donboscocollege-web 2>/dev/null || true
  echo "Attached college container to ${ERP_NET}"
else
  echo "WARN: network ${ERP_NET} not found"
fi

echo "--- Probe upstream ---"
UPSTREAM_OK=0
if docker run --rm --network "${ERP_NET}" curlimages/curl:8.5.0 \
  -sf -m 10 "http://donboscocollege-web:3000/" -o /dev/null; then
  UPSTREAM_OK=1
  echo "OK: donboscocollege-web:3000 responds"
else
  echo "Upstream not ready — restarting once…"
  docker restart donboscocollege-web >/dev/null 2>&1 || true
  sleep 5
  docker network connect "${ERP_NET}" donboscocollege-web 2>/dev/null || true
  if docker run --rm --network "${ERP_NET}" curlimages/curl:8.5.0 \
    -sf -m 12 "http://donboscocollege-web:3000/" -o /dev/null; then
    UPSTREAM_OK=1
    echo "OK after restart"
  else
    echo "FAIL: upstream still down. Logs:"
    docker logs donboscocollege-web --tail 100 || true
    exit 1
  fi
fi

if [[ ! -f /etc/letsencrypt/live/donboscocollege.ac.in/fullchain.pem ]]; then
  echo "ERROR: missing TLS cert /etc/letsencrypt/live/donboscocollege.ac.in/fullchain.pem"
  exit 1
fi
if [[ ! -f nginx/nginx.combined-dbc.ssl.conf ]]; then
  echo "ERROR: missing nginx/nginx.combined-dbc.ssl.conf"
  exit 1
fi

echo "--- Enable combined ERP + college nginx ---"
cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
"${COMPOSE[@]}" run --rm --no-deps nginx nginx -t
"${COMPOSE[@]}" up -d nginx

# Nginx recreate may drop network attachment
docker network connect "${ERP_NET}" donboscocollege-web 2>/dev/null || true
sleep 2

CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 https://donboscocollege.ac.in/ || true)"
ERP_CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 https://erp.donboscocollege.ac.in/login || true)"
echo "college_https: ${CODE}"
echo "erp_https: ${ERP_CODE}"

if [[ "$CODE" == "502" || "$CODE" == "000" ]]; then
  echo "Still failing — second recovery pass…"
  docker restart donboscocollege-web >/dev/null 2>&1 || true
  sleep 4
  docker network connect "${ERP_NET}" donboscocollege-web 2>/dev/null || true
  CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 https://donboscocollege.ac.in/ || true)"
  echo "college_https after retry: ${CODE}"
fi

if [[ "$CODE" == "502" || "$CODE" == "000" ]]; then
  echo "ERROR: college site still returning ${CODE}"
  echo "Keep ERP online; fix college container before re-enabling combined nginx."
  exit 1
fi

echo "=== College site repair finished ==="
