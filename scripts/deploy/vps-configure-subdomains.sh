#!/usr/bin/env bash
# Expand SSL + nginx for all DBC portal/journal subdomains and register tenant domains.
# Fixes NET::ERR_CERT_COMMON_NAME_INVALID when hosts share the VPS IP but are missing
# from the erp.donboscocollege.ac.in Let's Encrypt certificate.
#
# Run on VPS:
#   cd /opt/nep-erp && git pull && bash scripts/deploy/vps-configure-subdomains.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
EMAIL="${SSL_EMAIL:-admin@donboscocollege.ac.in}"
PRIMARY_CERT_NAME="${SSL_PRIMARY_CERT_NAME:-erp.donboscocollege.ac.in}"
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

cd "$APP_DIR"

echo "=== Configure DBC portal subdomains (SSL expand + nginx) ==="

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq certbot
fi

mkdir -p certbot/www

# Brief ACME-only HTTP config so certbot can validate every hostname on :80.
cat > nginx/nginx.acme-temp.conf <<'EOF'
worker_processes auto;
events { worker_connections 1024; }
http {
  server {
    listen 80 default_server;
    server_name _;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'ok'; add_header Content-Type text/plain; }
  }
}
EOF

cp nginx/nginx.conf "nginx/nginx.conf.bak.subdomains.$(date +%Y%m%d%H%M%S)" || true
cp nginx/nginx.acme-temp.conf nginx/nginx.conf
"${COMPOSE[@]}" up -d nginx
sleep 2

DOMAIN_ARGS=()
for h in "${HOSTS[@]}"; do
  DOMAIN_ARGS+=(-d "$h")
done

echo "Expanding Let's Encrypt certificate: ${PRIMARY_CERT_NAME}"
echo "Names: ${HOSTS[*]}"
certbot certonly \
  --webroot -w "${APP_DIR}/certbot/www" \
  --cert-name "${PRIMARY_CERT_NAME}" \
  "${DOMAIN_ARGS[@]}" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  --expand

CERT_PATH="/etc/letsencrypt/live/${PRIMARY_CERT_NAME}/fullchain.pem"
if [[ ! -f "$CERT_PATH" ]]; then
  echo "ERROR: missing ${CERT_PATH}"
  exit 1
fi

echo "Certificate SANs after expand:"
openssl x509 -in "$CERT_PATH" -noout -ext subjectAltName || openssl x509 -in "$CERT_PATH" -noout -text | grep -A1 'Subject Alternative Name'

MISSING=0
for h in "${HOSTS[@]}"; do
  if ! openssl x509 -in "$CERT_PATH" -noout -text | grep -q "DNS:${h}"; then
    echo "ERROR: ${h} is still missing from certificate SANs"
    MISSING=1
  fi
done
if [[ "$MISSING" -ne 0 ]]; then
  echo "Aborting nginx cutover — certificate does not cover all hosts."
  exit 1
fi

if [[ ! -f nginx/nginx.combined-dbc.ssl.conf ]]; then
  echo "ERROR: missing nginx/nginx.combined-dbc.ssl.conf"
  exit 1
fi

cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
"${COMPOSE[@]}" exec -T nginx nginx -t
"${COMPOSE[@]}" up -d nginx
"${COMPOSE[@]}" exec -T nginx nginx -s reload || true

# Register tenant domains inside API container (best-effort).
if "${COMPOSE[@]}" ps --status running --services 2>/dev/null | grep -qx api; then
  echo "Registering tenant domains…"
  "${COMPOSE[@]}" exec -T api \
    npx tsx scripts/ensure-pay-portal.ts --tenant=demo || true
  "${COMPOSE[@]}" exec -T api \
    npx tsx scripts/ensure-alumni-portal.ts --tenant=demo || true
  "${COMPOSE[@]}" exec -T api \
    npx tsx scripts/ensure-career-portal.ts --tenant=demo || true
  "${COMPOSE[@]}" exec -T api \
    npx tsx scripts/ensure-journals-portal.ts --tenant=demo || true
fi

# Patch production .env CORS / portal origins if file exists.
if [[ -f .env ]]; then
  python3 - <<'PY'
from pathlib import Path
env_path = Path(".env")
text = env_path.read_text(encoding="utf-8")
wanted_cors = (
    "https://donboscocollege.ac.in,"
    "https://www.donboscocollege.ac.in,"
    "https://admissions.donboscocollege.ac.in,"
    "https://library.donboscocollege.ac.in,"
    "https://career.donboscocollege.ac.in,"
    "https://pay.donboscocollege.ac.in,"
    "https://alumni.donboscocollege.ac.in,"
    "https://transient.donboscocollege.ac.in,"
    "https://source.donboscocollege.ac.in"
)
updates = {
    "CORS_EXTRA_ORIGINS": wanted_cors,
    "PAY_PORTAL_ORIGIN": "https://pay.donboscocollege.ac.in",
    "ADMISSIONS_PORTAL_ORIGIN": "https://admissions.donboscocollege.ac.in",
    "CAREERS_PUBLIC_URL": "https://career.donboscocollege.ac.in",
    "NEXT_PUBLIC_CAREER_HOST": "career.donboscocollege.ac.in",
    "NEXT_PUBLIC_ALUMNI_URL": "https://alumni.donboscocollege.ac.in",
    "NEXT_PUBLIC_JOURNALS_URL": "https://transient.donboscocollege.ac.in",
}
lines = text.splitlines()
keys_seen = set()
out = []
for line in lines:
    if not line or line.lstrip().startswith("#") or "=" not in line:
        out.append(line)
        continue
    key, _, _ = line.partition("=")
    key = key.strip()
    if key in updates:
        out.append(f"{key}={updates[key]}")
        keys_seen.add(key)
    else:
        out.append(line)
for key, value in updates.items():
    if key not in keys_seen:
        out.append(f"{key}={value}")
env_path.write_text("\n".join(out) + "\n", encoding="utf-8")
print("Updated .env portal/CORS settings")
PY
  "${COMPOSE[@]}" up -d api web || true
fi

echo
echo "=== Smoke checks (TLS must verify without -k) ==="
FAIL=0
for h in "${HOSTS[@]}"; do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "https://${h}/" || echo "000")
  san=$(echo | openssl s_client -servername "$h" -connect "${h}:443" 2>/dev/null \
    | openssl x509 -noout -ext subjectAltName 2>/dev/null | tr '\n' ' ' || true)
  covered="no"
  if echo "$san" | grep -q "DNS:${h}"; then covered="yes"; fi
  echo "https://${h}/ -> HTTP ${code} | SAN covered=${covered}"
  if [[ "$covered" != "yes" ]]; then FAIL=1; fi
done

if [[ "$FAIL" -ne 0 ]]; then
  echo
  echo "ERROR: one or more hosts still serve a certificate that does not include their name."
  exit 1
fi

echo
echo "Done. Expected portals:"
echo "  erp         -> /login"
echo "  admissions  -> admissions portal"
echo "  library     -> library desk"
echo "  career      -> careers portal"
echo "  pay         -> fee collection portal"
echo "  alumni      -> alumni portal"
echo "  transient   -> Transient journal"
echo "  source      -> Source journal"
