#!/usr/bin/env bash
# Deploy ERP only — keep college website (donboscocollege.ac.in) online.
# Prefer this over vps-update.sh when the college site is already healthy.
# Run on VPS: bash scripts/deploy/vps-update-erp-safe.sh
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

resolve_erp_net() {
  local net
  net=$("${COMPOSE[@]}" ps -q nginx 2>/dev/null | xargs -r docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null | head -1 || true)
  if [[ -z "${net}" ]]; then
    net="$(basename "$APP_DIR")_default"
  fi
  echo "${net}"
}

attach_college() {
  local net="$1"
  if docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
    docker network connect "${net}" donboscocollege-web 2>/dev/null || true
  fi
}

probe_college_upstream() {
  local net="$1"
  docker run --rm --network "${net}" curlimages/curl:8.5.0 \
    -sf -m 10 "http://donboscocollege-web:3000/" -o /dev/null
}

echo "=== NEP ERP — safe update (preserve college website) ==="
echo "Time: $(date -Is)"

# Snapshot college health BEFORE deploy
COLLEGE_BEFORE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 https://donboscocollege.ac.in/ || true)"
echo "College site before deploy: HTTP ${COLLEGE_BEFORE}"

if docker ps -a --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  docker start donboscocollege-web >/dev/null 2>&1 || true
fi

ERP_NET="$(resolve_erp_net)"
attach_college "${ERP_NET}"

# Keep combined nginx if college is (or was) working — never switch to ERP-only mid-deploy.
if [[ -f /etc/letsencrypt/live/erp.donboscocollege.ac.in/fullchain.pem ]] \
  && [[ -f /etc/letsencrypt/live/donboscocollege.ac.in/fullchain.pem ]] \
  && [[ -f nginx/nginx.combined-dbc.ssl.conf ]] \
  && docker ps --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  if probe_college_upstream "${ERP_NET}" || [[ "$COLLEGE_BEFORE" =~ ^(200|301|302|303|307|308)$ ]]; then
    echo "Preserving combined ERP + college nginx config."
    cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
  else
    echo "WARN: college upstream weak — still keeping current nginx.conf to avoid flipping configs."
  fi
elif [[ -f /etc/letsencrypt/live/erp.donboscocollege.ac.in/fullchain.pem ]]; then
  # College not available: only then use ERP-only (does not break an already-working college).
  if [[ ! "$COLLEGE_BEFORE" =~ ^(200|301|302|303|307|308)$ ]]; then
    echo "College not healthy before deploy — using ERP-only nginx."
    cp nginx/nginx.ssl.conf nginx/nginx.conf
  fi
fi

echo "Pulling latest code…"
bash scripts/deploy/vps-pull.sh
echo "Deploying commit: $(git log -1 --oneline)"

echo "Validating nginx config…"
"${COMPOSE[@]}" run --rm --no-deps nginx nginx -t

echo "Rebuilding web + api + worker…"
build_ok=0
for attempt in 1 2 3; do
  if "${COMPOSE[@]}" build web api worker; then
    build_ok=1
    break
  fi
  echo "docker compose build failed (attempt ${attempt}/3); retrying in $((attempt * 20))s…"
  sleep $((attempt * 20))
done
if [[ "$build_ok" -ne 1 ]]; then
  echo "docker compose build failed after 3 attempts" >&2
  exit 1
fi

echo "Starting data services…"
"${COMPOSE[@]}" up -d postgres redis

echo "Applying database migrations…"
bash scripts/deploy/vps-migrate.sh

echo "Granting permissions (idempotent)…"
"${COMPOSE[@]}" run --rm -e DATABASE_URL="${DATABASE_URL}" api \
  npx --yes tsx scripts/grant-exam-fees-permissions.ts || true
"${COMPOSE[@]}" run --rm -e DATABASE_URL="${DATABASE_URL}" api \
  npx --yes tsx scripts/grant-profile-verification-permissions.ts || true
"${COMPOSE[@]}" run --rm -e DATABASE_URL="${DATABASE_URL}" api \
  npx --yes tsx scripts/grant-moodle-permissions.ts || true

echo "Starting API…"
"${COMPOSE[@]}" up -d --wait --wait-timeout 180 api

ERP_NET="$(resolve_erp_net)"
attach_college "${ERP_NET}"

echo "Starting web, worker, nginx…"
"${COMPOSE[@]}" up -d web worker nginx

# Critical: nginx recreate drops college network membership
ERP_NET="$(resolve_erp_net)"
attach_college "${ERP_NET}"
sleep 3

# If college container stalled during deploy, nudge it without touching ERP images again
CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 https://donboscocollege.ac.in/ || true)"
if [[ "$CODE" == "502" || "$CODE" == "000" ]]; then
  echo "College returned ${CODE} after nginx recreate — restarting college container + re-attach…"
  docker restart donboscocollege-web 2>/dev/null || true
  sleep 4
  attach_college "${ERP_NET}"
  CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 https://donboscocollege.ac.in/ || true)"
fi

echo "Fixing data volume permissions…"
"${COMPOSE[@]}" exec -u root api \
  chown -R nestjs:nodejs /data/uploads /data/storage /data/backups 2>/dev/null || true
"${COMPOSE[@]}" exec -u root worker \
  chown -R worker:nodejs /data/uploads /data/storage /data/backups 2>/dev/null || true

echo "Fixing data volume permissions…"
"${COMPOSE[@]}" exec -u root api \
  chown -R nestjs:nodejs /data/uploads /data/storage /data/backups 2>/dev/null || true
"${COMPOSE[@]}" exec -u root worker \
  chown -R worker:nodejs /data/uploads /data/storage /data/backups 2>/dev/null || true

HOST="${NEXT_PUBLIC_LOGIN_HOST:-erp.donboscocollege.ac.in}"

wait_for_erp_web() {
  local url="https://${HOST}/login"
  local attempt code
  for attempt in $(seq 1 30); do
    code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 "${url}" || true)"
    if [[ "${code}" =~ ^(200|301|302|303|307|308)$ ]]; then
      echo "${code}"
      return 0
    fi
    if [[ "${attempt}" -lt 30 ]]; then
      echo "ERP web not ready yet (HTTP ${code:-000}), waiting… (${attempt}/30)" >&2
      sleep 3
    fi
  done
  echo "${code:-000}"
  return 1
}

echo
echo "--- Health ---"
curl -sf "https://${HOST}/api/health/live" | head -c 200 || true
echo
echo "college_https: ${CODE:-$(curl -sk -o /dev/null -w '%{http_code}' --max-time 12 https://donboscocollege.ac.in/ || true)}"
ERP_CODE="$(wait_for_erp_web || true)"
echo "erp_https: ${ERP_CODE}"
if [[ ! "${ERP_CODE}" =~ ^(200|301|302|303|307|308)$ ]]; then
  echo "WARN: ERP web still returned HTTP ${ERP_CODE} after wait. Check: docker compose logs web --tail 80"
fi
echo "Deployed: $(git log -1 --oneline)"
echo "=== Safe update complete — hard-refresh ERP (Ctrl+Shift+R) ==="

if [[ "${CODE:-000}" == "502" || "${CODE:-000}" == "000" ]]; then
  echo "WARN: college site still failing. Run: bash scripts/deploy/vps-repair-college-site.sh"
  exit 1
fi
