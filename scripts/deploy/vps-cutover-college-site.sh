#!/usr/bin/env bash
# Cut over https://donboscocollege.ac.in from the legacy /opt/donboscocollege app
# to OneCampus college-web in /opt/nep-erp, then optionally delete the old folder.
#
# Prerequisites:
#   - Full backup already downloaded (user confirmed)
#   - DNS for donboscocollege.ac.in + www → this VPS
#   - /opt/nep-erp checked out with latest code
#
# Usage on VPS:
#   cd /opt/nep-erp
#   git pull
#   bash scripts/deploy/vps-cutover-college-site.sh
#   bash scripts/deploy/vps-cutover-college-site.sh --delete-old   # after smoke tests pass
#
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
OLD_APP_DIR="${OLD_APP_DIR:-/opt/donboscocollege}"
LEGACY_NAME="donboscocollege-web-legacy"
DELETE_OLD=0
EMAIL="${SSL_EMAIL:-admin@donboscocollege.ac.in}"

for arg in "$@"; do
  case "$arg" in
    --delete-old) DELETE_OLD=1 ;;
    --help|-h)
      sed -n '1,20p' "$0"
      exit 0
      ;;
  esac
done

cd "$APP_DIR"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

echo "=== DBC college-web cutover ==="
echo "Time: $(date -Is)"
echo "ERP dir: $APP_DIR"
echo "Old dir: $OLD_APP_DIR"
echo

require_file() {
  [[ -f "$1" ]] || { echo "ERROR: missing $1"; exit 1; }
}

require_file "nginx/nginx.combined-dbc.ssl.conf"
require_file "apps/college-web/Dockerfile"
require_file "docker-compose.prod.yml"

if [[ ! -f .env ]]; then
  echo "ERROR: missing $APP_DIR/.env"
  exit 1
fi

# Ensure college env keys exist (non-destructive append if absent).
python3 - <<'PY'
from pathlib import Path
path = Path(".env")
text = path.read_text(encoding="utf-8")
updates = {
    "COLLEGE_SITE_URL": "https://donboscocollege.ac.in",
    "COLLEGE_TENANT_SLUG": "demo",
    "COLLEGE_CMS_HOST": "donboscocollege.ac.in",
    "NEXT_PUBLIC_ERP_LOGIN_URL": "https://erp.donboscocollege.ac.in",
    "WEBSITE_REVALIDATE_WEBHOOK_URL": "http://donboscocollege-web:3000/api/revalidate",
    "COLLEGE_CONTACT_RECIPIENT": "info@donboscocollege.ac.in",
}
lines = text.splitlines()
seen = set()
out = []
for line in lines:
    if not line or line.lstrip().startswith("#") or "=" not in line:
        out.append(line)
        continue
    key = line.split("=", 1)[0].strip()
    if key in updates:
        out.append(f"{key}={updates[key]}")
        seen.add(key)
    else:
        out.append(line)
for key, value in updates.items():
    if key not in seen:
        out.append(f"{key}={value}")
if "REVALIDATE_SECRET=" not in text:
    import secrets
    out.append(f"REVALIDATE_SECRET={secrets.token_urlsafe(32)}")
    print("Added REVALIDATE_SECRET")
path.write_text("\n".join(out) + "\n", encoding="utf-8")
print("Env college keys ensured")
PY

echo "--- Step 1: park the legacy college container ---"
if docker ps -a --format '{{.Names}}' | grep -qx 'donboscocollege-web'; then
  IMAGE="$(docker inspect -f '{{.Config.Image}}' donboscocollege-web 2>/dev/null || true)"
  echo "Current donboscocollege-web image: ${IMAGE}"
  # Only rename if it is NOT already the compose-built nep-erp college image.
  if [[ "$IMAGE" == *"nep-erp-college-web"* ]] || docker inspect donboscocollege-web --format '{{index .Config.Labels "com.docker.compose.project"}}' 2>/dev/null | grep -qi 'nep-erp'; then
    echo "donboscocollege-web already looks like the ERP compose service — will rebuild in place."
  else
    docker stop donboscocollege-web >/dev/null 2>&1 || true
    if docker ps -a --format '{{.Names}}' | grep -qx "$LEGACY_NAME"; then
      docker rm -f "$LEGACY_NAME" >/dev/null 2>&1 || true
    fi
    docker rename donboscocollege-web "$LEGACY_NAME"
    echo "Renamed old container → ${LEGACY_NAME}"
    docker commit "$LEGACY_NAME" "dbc-legacy-apex:pre-cutover" >/dev/null 2>&1 || true
  fi
else
  echo "No running donboscocollege-web container found."
fi

# Free host port 3002 if the legacy container still binds it.
if docker ps -a --format '{{.Names}}' | grep -qx "$LEGACY_NAME"; then
  docker stop "$LEGACY_NAME" >/dev/null 2>&1 || true
fi

echo "--- Step 2: build + start OneCampus college-web ---"
"${COMPOSE[@]}" build college-web
"${COMPOSE[@]}" up -d api college-web nginx

ERP_NET="$("${COMPOSE[@]}" ps -q nginx | xargs -r docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' | head -1 || true)"
ERP_NET="${ERP_NET:-nep-erp_default}"
docker network connect "$ERP_NET" donboscocollege-web 2>/dev/null || true
echo "Attached donboscocollege-web to ${ERP_NET}"

echo "Waiting for college-web upstream…"
for i in $(seq 1 30); do
  if docker run --rm --network "$ERP_NET" curlimages/curl:8.5.0 \
    -sf -m 8 "http://donboscocollege-web:3000/" -o /dev/null; then
    echo "Upstream OK"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "ERROR: college-web upstream not responding"
    docker logs donboscocollege-web --tail 80 || true
    exit 1
  fi
  sleep 2
done

echo "--- Step 3: ensure apex SSL (donboscocollege.ac.in + www) ---"
mkdir -p certbot/www
if [[ ! -f /etc/letsencrypt/live/donboscocollege.ac.in/fullchain.pem ]]; then
  echo "Requesting apex certificate…"
  # Temporary ACME responder on port 80 if needed — use existing nginx ACME locations when possible.
  certbot certonly \
    --webroot -w "${APP_DIR}/certbot/www" \
    -d donboscocollege.ac.in -d www.donboscocollege.ac.in \
    --email "$EMAIL" \
    --agree-tos --no-eff-email --non-interactive \
    || echo "WARN: certbot apex request failed — check DNS + port 80"
fi

if [[ ! -f /etc/letsencrypt/live/donboscocollege.ac.in/fullchain.pem ]]; then
  echo "ERROR: missing /etc/letsencrypt/live/donboscocollege.ac.in/fullchain.pem"
  exit 1
fi

echo "--- Step 4: activate combined nginx ---"
cp nginx/nginx.conf "nginx/nginx.conf.bak.cutover.$(date +%Y%m%d%H%M%S)" || true
cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
"${COMPOSE[@]}" run --rm --no-deps nginx nginx -t
"${COMPOSE[@]}" up -d nginx
docker network connect "$ERP_NET" donboscocollege-web 2>/dev/null || true
"${COMPOSE[@]}" exec -T nginx nginx -s reload || true

echo "--- Step 5: register college tenant domains ---"
"${COMPOSE[@]}" exec -T api npx tsx scripts/ensure-college-domain.ts || true

echo "--- Step 6: smoke tests ---"
fail=0
check() {
  local url="$1" expect="$2" label="$3"
  local code
  code=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 20 "$url" || echo 000)
  echo "$label  $url -> $code (expect $expect)"
  if [[ "$code" != "$expect" && "$code" != "301" && "$code" != "302" && "$code" != "308" ]]; then
    # Allow 200 or redirect for homepage; health/visitors must be 200.
    if [[ "$expect" == "200" && "$code" != "200" ]]; then
      fail=1
    fi
  fi
}

check "https://donboscocollege.ac.in/" "200" "college_home"
check "https://www.donboscocollege.ac.in/" "301" "www_redirect"
check "https://donboscocollege.ac.in/api/visitors" "200" "college_visitors"
check "https://donboscocollege.ac.in/api/health/live" "200" "college_api_health"
check "https://erp.donboscocollege.ac.in/api/health/live" "200" "erp_health"

# Fingerprint: new site should NOT use the old hero phrase.
HOME_HTML=$(curl -sk --max-time 25 "https://donboscocollege.ac.in/" || true)
if echo "$HOME_HTML" | grep -q "Empowering Minds"; then
  echo "WARN: homepage still looks like the OLD site (found 'Empowering Minds')."
  fail=1
fi
if echo "$HOME_HTML" | grep -qi "In Pursuit of Excellence\|BaseCode\|FYUG"; then
  echo "OK: homepage content looks like the new OneCampus college-web."
fi

if [[ "$fail" -ne 0 ]]; then
  echo
  echo "Smoke tests reported issues. NOT deleting /opt/donboscocollege."
  echo "Inspect: docker logs donboscocollege-web --tail 100"
  echo "Rollback tip: docker stop donboscocollege-web; docker rename ${LEGACY_NAME} donboscocollege-web; docker start donboscocollege-web"
  exit 1
fi

echo
echo "=== Cutover succeeded ==="

if [[ "$DELETE_OLD" -eq 1 ]]; then
  echo "--- Deleting old website folder ${OLD_APP_DIR} ---"
  if [[ -d "$OLD_APP_DIR" ]]; then
    du -sh "$OLD_APP_DIR" || true
    rm -rf "$OLD_APP_DIR"
    echo "Deleted ${OLD_APP_DIR}"
  else
    echo "Old folder already absent."
  fi
  if docker ps -a --format '{{.Names}}' | grep -qx "$LEGACY_NAME"; then
    docker rm -f "$LEGACY_NAME" >/dev/null 2>&1 || true
    echo "Removed legacy container ${LEGACY_NAME}"
  fi
  docker image prune -f >/dev/null 2>&1 || true
  df -h / | tail -1
else
  echo "Old folder kept at ${OLD_APP_DIR}"
  echo "After you confirm the live site for a day, free disk with:"
  echo "  bash scripts/deploy/vps-cutover-college-site.sh --delete-old"
fi

echo
echo "Live: https://donboscocollege.ac.in/"
echo "ERP : https://erp.donboscocollege.ac.in/"
