#!/usr/bin/env bash
# Repair college website 502 + ensure ERP is on latest master with migrations/permissions.
# Run on VPS: bash scripts/deploy/vps-repair-college-and-erp.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

echo "=== Repair: college website + ERP deploy ==="
echo "Time: $(date -Is)"
echo

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "--- Git ---"
bash scripts/deploy/vps-pull.sh
echo "Expected features require commit >= 8591d2a (Student Feedback) and 7fc2888 (Profile Update Policy)."
echo

echo "--- College website container ---"
if docker ps -a --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  docker start donboscocollege-web 2>/dev/null || true
  sleep 2
  if docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
    echo "donboscocollege-web is running."
  else
    echo "WARN: donboscocollege-web exists but will not start. Check: docker logs donboscocollege-web --tail 80"
  fi
else
  echo "ERROR: container 'donboscocollege-web' not found."
  echo "College site (donboscocollege.ac.in) is proxied to that container by nginx.combined-dbc.ssl.conf."
  echo "Restore/start the college website container, then re-run this script."
fi
echo

echo "--- Attach college web to ERP docker network ---"
ERP_NET=$("${COMPOSE[@]}" ps -q nginx 2>/dev/null | xargs -r docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null | head -1 || true)
if [[ -z "${ERP_NET}" ]]; then
  ERP_NET="$(basename "$APP_DIR")_default"
fi
if docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  if docker network inspect "${ERP_NET}" >/dev/null 2>&1; then
    docker network connect "${ERP_NET}" donboscocollege-web 2>/dev/null || true
    echo "Attached to network: ${ERP_NET}"
  fi
  echo "Probe college upstream from nginx network:"
  docker run --rm --network "${ERP_NET}" curlimages/curl:8.5.0 \
    -sf -m 8 "http://donboscocollege-web:3000/" -o /dev/null \
    && echo "OK: donboscocollege-web:3000 responds" \
    || echo "FAIL: donboscocollege-web:3000 not reachable on ${ERP_NET}"
fi
echo

echo "--- Nginx config (prefer combined only if college upstream is healthy) ---"
COLLEGE_OK=0
if docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web' \
  && [[ -f /etc/letsencrypt/live/donboscocollege.ac.in/fullchain.pem ]] \
  && [[ -f nginx/nginx.combined-dbc.ssl.conf ]]; then
  if docker run --rm --network "${ERP_NET}" curlimages/curl:8.5.0 \
    -sf -m 8 "http://donboscocollege-web:3000/" -o /dev/null; then
    COLLEGE_OK=1
  fi
fi

if [[ -f /etc/letsencrypt/live/erp.donboscocollege.ac.in/fullchain.pem ]]; then
  if [[ "$COLLEGE_OK" -eq 1 ]]; then
    echo "Using combined ERP + college nginx config."
    cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
  else
    echo "College upstream unhealthy — keeping ERP-only nginx.ssl.conf to avoid stale combined 502."
    echo "NOTE: donboscocollege.ac.in will not be served until college container is fixed."
    cp nginx/nginx.ssl.conf nginx/nginx.conf
  fi
fi

"${COMPOSE[@]}" run --rm --no-deps nginx nginx -t

echo "--- Rebuild + migrate + permissions ---"
"${COMPOSE[@]}" build web api worker
"${COMPOSE[@]}" up -d postgres redis
bash scripts/deploy/vps-migrate.sh

"${COMPOSE[@]}" run --rm -e DATABASE_URL="${DATABASE_URL}" api \
  npx --yes tsx scripts/grant-exam-fees-permissions.ts || true
"${COMPOSE[@]}" run --rm -e DATABASE_URL="${DATABASE_URL}" api \
  npx --yes tsx scripts/grant-profile-verification-permissions.ts || true
"${COMPOSE[@]}" run --rm -e DATABASE_URL="${DATABASE_URL}" api \
  npx --yes tsx scripts/seed-rbac-only.ts || true

"${COMPOSE[@]}" up -d --wait --wait-timeout 180 api
"${COMPOSE[@]}" up -d web worker nginx

# Re-attach after nginx recreate
if docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  docker network connect "${ERP_NET}" donboscocollege-web 2>/dev/null || true
fi

echo
echo "--- Health ---"
HOST="${NEXT_PUBLIC_LOGIN_HOST:-erp.donboscocollege.ac.in}"
curl -sf "https://${HOST}/api/health/live" | head -c 200 || true
echo
curl -sf -o /dev/null -w "college_https:%{http_code}\n" "https://donboscocollege.ac.in/" || echo "college_https:fail"
curl -sf -o /dev/null -w "erp_https:%{http_code}\n" "https://${HOST}/login" || echo "erp_https:fail"
echo
echo "Git HEAD: $(git log -1 --oneline)"
echo "After repair: hard-refresh ERP (Ctrl+Shift+R), log out/in, check:"
echo "  IQAC / NAAC → Student Feedback"
echo "  Students → Profile Update Policy"
echo "=== Repair finished ==="
