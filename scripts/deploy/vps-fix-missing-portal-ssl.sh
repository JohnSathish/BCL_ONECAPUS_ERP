#!/usr/bin/env bash
# Fix pay/alumni/transient/source SSL when erp/admissions/library/career already work.
# Root cause is usually: ERP cert missing those SANs, and/or nginx serving the
# college apex cert as the SSL default for unmatched SNI.
#
# Run on VPS:
#   cd /opt/nep-erp && git pull origin master && bash scripts/deploy/vps-fix-missing-portal-ssl.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
EMAIL="${SSL_EMAIL:-admin@donboscocollege.ac.in}"
CERT_NAME="${SSL_PRIMARY_CERT_NAME:-erp.donboscocollege.ac.in}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

HOSTS=(
  erp.donboscocollege.ac.in
  admissions.donboscocollege.ac.in
  library.donboscocollege.ac.in
  career.donboscocollege.ac.in
  pay.donboscocollege.ac.in
  alumni.donboscocollege.ac.in
  transient.donboscocollege.ac.in
  source.donboscocollege.ac.in
)

MISSING_HOSTS=(
  pay.donboscocollege.ac.in
  alumni.donboscocollege.ac.in
  transient.donboscocollege.ac.in
  source.donboscocollege.ac.in
)

cd "$APP_DIR"

echo "=== Fix missing portal SSL names ==="
echo "Commit: $(git log -1 --oneline)"

CERT_PATH="/etc/letsencrypt/live/${CERT_NAME}/fullchain.pem"
if [[ ! -f "$CERT_PATH" ]]; then
  echo "ERROR: missing ${CERT_PATH}"
  exit 1
fi

echo
echo "--- Disk certificate SANs (${CERT_NAME}) ---"
openssl x509 -in "$CERT_PATH" -noout -ext subjectAltName 2>/dev/null \
  || openssl x509 -in "$CERT_PATH" -noout -text | grep -A2 'Subject Alternative Name'

echo
echo "--- Served certificate CN / SAN coverage (before) ---"
for h in "${MISSING_HOSTS[@]}"; do
  cn=$(echo | openssl s_client -servername "$h" -connect "${h}:443" 2>/dev/null \
    | openssl x509 -noout -subject 2>/dev/null | sed 's/^subject=//' || echo '?')
  san=$(echo | openssl s_client -servername "$h" -connect "${h}:443" 2>/dev/null \
    | openssl x509 -noout -text 2>/dev/null | grep -oE 'DNS:[^,[:space:]]+' | tr '\n' ' ' || true)
  covered=no
  echo "$san" | grep -q "DNS:${h}" && covered=yes
  echo "${h}"
  echo "  served subject: ${cn}"
  echo "  served SANs:    ${san}"
  echo "  covered:        ${covered}"
done

echo
echo "--- Who owns :80 / :443 ---"
ss -lptn 'sport = :80' || netstat -lptn | grep ':80 ' || true
ss -lptn 'sport = :443' || netstat -lptn | grep ':443 ' || true

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq certbot
fi

mkdir -p certbot/www/.well-known/acme-challenge
PROBE="nep-acme-probe-$(date +%s)"
echo "ok-${PROBE}" > "certbot/www/.well-known/acme-challenge/${PROBE}"

# ACME-only HTTP so every hostname validates against the same webroot.
cat > nginx/nginx.acme-temp.conf <<'EOF'
worker_processes auto;
events { worker_connections 1024; }
http {
  server {
    listen 80 default_server;
    server_name _;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'acme-ready\n'; add_header Content-Type text/plain; }
  }
}
EOF

cp nginx/nginx.conf "nginx/nginx.conf.bak.pay-ssl.$(date +%Y%m%d%H%M%S)" || true
cp nginx/nginx.acme-temp.conf nginx/nginx.conf
"${COMPOSE[@]}" up -d --force-recreate nginx
sleep 3

echo
echo "--- HTTP-01 reachability probe ---"
HTTP_FAIL=0
for h in "${MISSING_HOSTS[@]}"; do
  body=$(curl -4 -sS --max-time 15 "http://${h}/.well-known/acme-challenge/${PROBE}" || true)
  if [[ "$body" == "ok-${PROBE}" ]]; then
    echo "OK  http://${h}/.well-known/acme-challenge/..."
  else
    echo "FAIL http://${h}/.well-known/acme-challenge/... (got: ${body:0:80})"
    HTTP_FAIL=1
  fi
done
rm -f "certbot/www/.well-known/acme-challenge/${PROBE}"

if [[ "$HTTP_FAIL" -ne 0 ]]; then
  echo
  echo "ERROR: Let's Encrypt cannot validate the missing hosts over HTTP :80."
  echo "Fix DNS / firewall / stop any CyberPanel site stealing those hostnames on port 80,"
  echo "then re-run this script."
  # Restore SSL nginx even on failure so the site is not left on ACME-only.
  if [[ -f nginx/nginx.combined-dbc.ssl.conf ]]; then
    cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
    "${COMPOSE[@]}" up -d nginx || true
  fi
  exit 1
fi

DOMAIN_ARGS=()
for h in "${HOSTS[@]}"; do
  DOMAIN_ARGS+=(-d "$h")
done

echo
echo "--- Force-renew ERP certificate with all portal names ---"
certbot certonly \
  --webroot -w "${APP_DIR}/certbot/www" \
  --cert-name "${CERT_NAME}" \
  "${DOMAIN_ARGS[@]}" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  --expand \
  --force-renewal \
  --preferred-challenges http

echo
echo "--- Disk certificate SANs (after) ---"
openssl x509 -in "$CERT_PATH" -noout -ext subjectAltName 2>/dev/null \
  || openssl x509 -in "$CERT_PATH" -noout -text | grep -A2 'Subject Alternative Name'

MISSING=0
for h in "${HOSTS[@]}"; do
  if ! openssl x509 -in "$CERT_PATH" -noout -text | grep -q "DNS:${h}"; then
    echo "ERROR: ${h} still missing from disk certificate"
    MISSING=1
  fi
done
if [[ "$MISSING" -ne 0 ]]; then
  echo "Certbot finished but SANs are incomplete — not cutting over nginx."
  exit 1
fi

if [[ ! -f nginx/nginx.combined-dbc.ssl.conf ]]; then
  echo "ERROR: missing nginx/nginx.combined-dbc.ssl.conf"
  exit 1
fi

cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf

# Make sure the ERP SSL server is the default SSL vhost so unmatched SNI
# never falls back to the college apex certificate.
python3 - <<'PY'
from pathlib import Path
path = Path("nginx/nginx.conf")
text = path.read_text(encoding="utf-8")
old = "  # ── HTTPS: ERP subdomains (portals + journals) ──\n  server {\n    listen 443 ssl;\n    http2 on;"
new = "  # ── HTTPS: ERP subdomains (portals + journals) ──\n  server {\n    listen 443 ssl default_server;\n    http2 on;"
if old in text:
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print("Patched ERP HTTPS block as default_server")
elif "listen 443 ssl default_server;" in text:
    print("ERP HTTPS default_server already present")
else:
    print("WARN: could not patch default_server automatically — check nginx.conf")
PY

"${COMPOSE[@]}" exec -T nginx nginx -t
"${COMPOSE[@]}" up -d --force-recreate nginx
sleep 2
"${COMPOSE[@]}" exec -T nginx nginx -s reload || true

echo
echo "--- Served certificate coverage (after) ---"
FAIL=0
for h in "${HOSTS[@]}"; do
  code=$(curl -4 -sS -o /dev/null -w "%{http_code}" --max-time 20 "https://${h}/" || echo 000)
  san=$(echo | openssl s_client -servername "$h" -connect "${h}:443" 2>/dev/null \
    | openssl x509 -noout -text 2>/dev/null | grep -oE 'DNS:[^,[:space:]]+' | tr '\n' ' ' || true)
  covered=no
  echo "$san" | grep -q "DNS:${h}" && covered=yes
  echo "https://${h}/ -> HTTP ${code} | covered=${covered} | ${san}"
  if [[ "$covered" != "yes" ]]; then FAIL=1; fi
done

if [[ "$FAIL" -ne 0 ]]; then
  echo
  echo "ERROR: still serving a cert without the required names."
  echo "Inspect nginx server_name blocks:"
  "${COMPOSE[@]}" exec -T nginx nginx -T 2>/dev/null | grep -E 'listen|server_name|ssl_certificate' | head -80 || true
  exit 1
fi

echo
echo "SUCCESS: all portal hostnames have valid SSL."
