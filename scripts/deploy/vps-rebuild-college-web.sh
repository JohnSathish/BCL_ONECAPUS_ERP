#!/usr/bin/env bash
# Rebuild college-web + reload nginx to clear stale Next.js chunk / MIME errors.
# Symptom: console "Refused to execute script ... MIME type ('text/html')"
# Cause: browser cached old HTML after a deploy; missing chunks return HTML 200.
#
# Run on VPS:
#   cd /opt/nep-erp && git pull origin master && bash scripts/deploy/vps-rebuild-college-web.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

echo "=== Rebuild college-web (fix stale chunk MIME errors) ==="
echo "Commit: $(git log -1 --oneline)"

"${COMPOSE[@]}" build --no-cache college-web
"${COMPOSE[@]}" up -d college-web

if [[ -f nginx/nginx.combined-dbc.ssl.conf ]]; then
  cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
  "${COMPOSE[@]}" exec -T nginx nginx -t
  "${COMPOSE[@]}" up -d nginx
  "${COMPOSE[@]}" exec -T nginx nginx -s reload || true
fi

# Ensure college container is on the ERP network
ERP_NET=$("${COMPOSE[@]}" ps -q nginx 2>/dev/null | xargs -r docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null | head -1 || true)
ERP_NET="${ERP_NET:-$(basename "$APP_DIR")_default}"
docker network connect "$ERP_NET" donboscocollege-web 2>/dev/null || true

sleep 3
CODE=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 20 https://donboscocollege.ac.in/ || echo 000)
echo "https://donboscocollege.ac.in/ -> HTTP ${CODE}"

CHUNK=$(curl -sk https://donboscocollege.ac.in/ | grep -oE '/_next/static/chunks/[A-Za-z0-9._-]+\.js' | head -1 || true)
if [[ -n "$CHUNK" ]]; then
  CT=$(curl -sk -I "https://donboscocollege.ac.in${CHUNK}" | tr -d '\r' | awk -F': ' 'tolower($1)=="content-type"{print $2; exit}')
  echo "sample chunk ${CHUNK} -> Content-Type: ${CT}"
fi

echo
echo "Done. On the browser: hard refresh (Ctrl+Shift+R) or clear site cache for donboscocollege.ac.in"
