#!/usr/bin/env bash
# One-shot live fix:
#  1) Expand ERP SSL cert to cover pay/alumni/transient/source (CERT_COMMON_NAME_INVALID)
#  2) Apply combined nginx SSL config
#  3) Rebuild ERP web so BCL logo + favicon go live
#
# Run on VPS:
#   cd /opt/nep-erp && git pull origin master && bash scripts/deploy/vps-fix-branding-ssl.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

echo "=== Fix branding + subdomain SSL ==="
echo "Commit: $(git log -1 --oneline)"

echo
echo "--- 1) Expand SSL for portal subdomains ---"
bash scripts/deploy/vps-configure-subdomains.sh

echo
echo "--- 2) Rebuild ERP web (BCL logo + favicon) ---"
"${COMPOSE[@]}" build web
"${COMPOSE[@]}" up -d web

echo
echo "--- 3) Ensure combined nginx is active ---"
if [[ -f nginx/nginx.combined-dbc.ssl.conf ]]; then
  cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
  "${COMPOSE[@]}" exec -T nginx nginx -t
  "${COMPOSE[@]}" up -d nginx
  "${COMPOSE[@]}" exec -T nginx nginx -s reload || true
fi

echo
echo "--- 4) Smoke checks ---"
for path in \
  /branding/basecode-labs-logo.png \
  /favicon.png \
  /login
do
  code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 20 "https://erp.donboscocollege.ac.in${path}" || echo 000)
  echo "https://erp.donboscocollege.ac.in${path} -> ${code}"
done

echo
for h in pay.donboscocollege.ac.in alumni.donboscocollege.ac.in transient.donboscocollege.ac.in source.donboscocollege.ac.in; do
  san=$(echo | openssl s_client -servername "$h" -connect "${h}:443" 2>/dev/null \
    | openssl x509 -noout -ext subjectAltName 2>/dev/null | tr '\n' ' ' || true)
  covered="no"
  if echo "$san" | grep -q "DNS:${h}"; then covered="yes"; fi
  echo "${h} SAN covered=${covered}"
done

echo
echo "Done. Hard-refresh the browser (Ctrl+Shift+R) on https://erp.donboscocollege.ac.in/login"
