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
echo "Deploying commit: $(git log -1 --oneline)"

resolve_erp_net() {
  local net
  net=$("${COMPOSE[@]}" ps -q nginx 2>/dev/null | xargs -r docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null | head -1 || true)
  if [[ -z "${net}" ]]; then
    net="$(basename "$APP_DIR")_default"
  fi
  echo "${net}"
}

ensure_college_web() {
  if ! docker ps -a --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
    echo "College container donboscocollege-web not found — ERP-only nginx will be used."
    return 1
  fi
  docker start donboscocollege-web >/dev/null 2>&1 || true
  local net
  net="$(resolve_erp_net)"
  if docker network inspect "${net}" >/dev/null 2>&1; then
    docker network connect "${net}" donboscocollege-web 2>/dev/null || true
  fi
  if docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web' \
    && docker run --rm --network "${net}" curlimages/curl:8.5.0 \
      -sf -m 8 "http://donboscocollege-web:3000/" -o /dev/null; then
    echo "College website upstream healthy on ${net}."
    return 0
  fi
  echo "WARN: donboscocollege-web is not healthy — will not enable combined nginx (prevents 502 on donboscocollege.ac.in)."
  return 1
}

COLLEGE_HEALTHY=0
if [[ -f /etc/letsencrypt/live/erp.donboscocollege.ac.in/fullchain.pem ]]; then
  echo "Applying HTTPS nginx config…"
  if [[ -f nginx/nginx.combined-dbc.ssl.conf ]] \
    && [[ -f /etc/letsencrypt/live/donboscocollege.ac.in/fullchain.pem ]] \
    && ensure_college_web; then
    echo "Using combined ERP + college website nginx config."
    cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
    COLLEGE_HEALTHY=1
  else
    cp nginx/nginx.ssl.conf nginx/nginx.conf
  fi
fi

echo "Validating nginx config…"
"${COMPOSE[@]}" run --rm --no-deps nginx nginx -t

echo "Rebuilding web + api + worker…"
# Use Docker layer cache when possible; npm ci retries are in each Dockerfile .npmrc.
# For a full clean rebuild: COMPOSE build --no-cache web api worker
"${COMPOSE[@]}" build web api worker

echo "Starting data services…"
"${COMPOSE[@]}" up -d postgres redis

echo "Applying database migrations…"
bash scripts/deploy/vps-migrate.sh

echo "Granting examination fee permissions (idempotent)…"
"${COMPOSE[@]}" run --rm \
  -e DATABASE_URL="${DATABASE_URL}" \
  api npx --yes tsx scripts/grant-exam-fees-permissions.ts \
  || echo "WARN: exam-fees permission grant skipped (script missing in image until rebuild)."

echo "Granting student profile verification permissions (idempotent)…"
"${COMPOSE[@]}" run --rm \
  -e DATABASE_URL="${DATABASE_URL}" \
  api npx --yes tsx scripts/grant-profile-verification-permissions.ts \
  || echo "WARN: profile-verification permission grant skipped."

echo "Starting API and waiting until healthy…"
"${COMPOSE[@]}" up -d --wait --wait-timeout 180 api

echo "Starting web, worker, nginx…"
if [[ "$COLLEGE_HEALTHY" -eq 1 ]] || docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  ERP_NET="$(resolve_erp_net)"
  if docker network inspect "${ERP_NET}" >/dev/null 2>&1; then
    docker network connect "${ERP_NET}" donboscocollege-web 2>/dev/null || true
    echo "College website container attached to Docker network: ${ERP_NET}"
  fi
fi
"${COMPOSE[@]}" up -d web worker nginx

# Re-check college site after nginx recreate; recover if 502.
if [[ "$COLLEGE_HEALTHY" -eq 1 ]]; then
  sleep 2
  CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 https://donboscocollege.ac.in/ || true)"
  if [[ "$CODE" == "502" || "$CODE" == "000" ]]; then
    echo "College site returned ${CODE} — restarting donboscocollege-web and re-attaching network…"
    docker restart donboscocollege-web 2>/dev/null || true
    ERP_NET="$(resolve_erp_net)"
    docker network connect "${ERP_NET}" donboscocollege-web 2>/dev/null || true
    sleep 3
    CODE2="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 https://donboscocollege.ac.in/ || true)"
    echo "College site after recovery: HTTP ${CODE2}"
    if [[ "$CODE2" == "502" || "$CODE2" == "000" ]]; then
      echo "WARN: college site still failing — falling back to ERP-only nginx to stop serving broken combined config."
      cp nginx/nginx.ssl.conf nginx/nginx.conf
      "${COMPOSE[@]}" run --rm --no-deps nginx nginx -t
      "${COMPOSE[@]}" up -d nginx
    fi
  else
    echo "College site HTTP ${CODE}"
  fi
fi

echo "Fixing data volume permissions…"
"${COMPOSE[@]}" exec -u root api \
  chown -R nestjs:nodejs /data/uploads /data/storage /data/backups 2>/dev/null || true
"${COMPOSE[@]}" exec -u root worker \
  chown -R worker:nodejs /data/uploads /data/storage /data/backups 2>/dev/null || true

echo
"${COMPOSE[@]}" ps
echo

HOST="${NEXT_PUBLIC_LOGIN_HOST:-erp.donboscocollege.ac.in}"
echo "Health checks:"
curl -sf "https://${HOST}/api/health/live" | head -c 200 || curl -sf "http://localhost/api/health/live" | head -c 200
echo
curl -sf "https://${HOST}/api/health/ready" | head -c 400 || curl -sf "http://localhost/api/health/ready" | head -c 400
echo
echo "Deployed: $(git log -1 --oneline)"
echo "=== Update complete — hard-refresh browser (Ctrl+Shift+R), log out and log in ==="
echo "Check: IQAC → Student Feedback · Students → Profile Update Policy"
