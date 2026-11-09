#!/usr/bin/env bash
# TLS for the campus TV host noticeboard.donboscocollege.ac.in.
# This host must not use the ERP certificate: the ERP app sends / to /login.
# The college apex HSTS policy also requires this name to have its own valid cert.
#
# Run on the VPS:
#   cd /opt/nep-erp && bash scripts/deploy/vps-noticeboard-ssl.sh
# Deploy scripts call it with --cert-only before enabling the combined nginx file.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
EMAIL="${SSL_EMAIL:-admin@donboscocollege.ac.in}"
HOST="noticeboard.donboscocollege.ac.in"
CERT_DIR="/etc/letsencrypt/live/${HOST}"
CERT_PATH="${CERT_DIR}/fullchain.pem"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)
CERT_ONLY=0
if [[ "${1:-}" == "--cert-only" ]]; then
  CERT_ONLY=1
fi

cd "$APP_DIR"

cert_covers_host() {
  [[ -f "$CERT_PATH" ]] && openssl x509 -in "$CERT_PATH" -noout -text | grep -q "DNS:${HOST}"
}

if cert_covers_host; then
  echo "Certificate already covers ${HOST}"
else
  if ! command -v certbot >/dev/null 2>&1; then
    apt-get update -qq
    apt-get install -y -qq certbot
  fi

  mkdir -p certbot/www/.well-known/acme-challenge
  PROBE="nep-noticeboard-$(date +%s)"
  echo "ok-${PROBE}" > "certbot/www/.well-known/acme-challenge/${PROBE}"

  BACKUP="nginx/nginx.conf.bak.noticeboard.$(date +%Y%m%d%H%M%S)"
  if [[ -f nginx/nginx.conf ]]; then
    cp nginx/nginx.conf "$BACKUP"
  fi

  restore_nginx() {
    if [[ -f "$BACKUP" ]]; then
      cp "$BACKUP" nginx/nginx.conf
      "${COMPOSE[@]}" up -d nginx || true
    fi
  }

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

  cp nginx/nginx.acme-temp.conf nginx/nginx.conf
  "${COMPOSE[@]}" up -d --force-recreate nginx
  sleep 3

  body="$(curl -4 -sS --max-time 20 "http://${HOST}/.well-known/acme-challenge/${PROBE}" || true)"
  rm -f "certbot/www/.well-known/acme-challenge/${PROBE}"
  if [[ "$body" != "ok-${PROBE}" ]]; then
    echo "ERROR: Let's Encrypt cannot reach http://${HOST}/.well-known/acme-challenge/" >&2
    echo "Point the DNS A record at this server, then run this script again." >&2
    echo "HTTP body was: ${body:0:120}" >&2
    restore_nginx
    exit 1
  fi

  echo "Issuing certificate for ${HOST}"
  if ! certbot certonly \
    --webroot -w "${APP_DIR}/certbot/www" \
    --cert-name "${HOST}" \
    -d "${HOST}" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --keep-until-expiring \
    --preferred-challenges http; then
    echo "ERROR: certbot failed for ${HOST}" >&2
    restore_nginx
    exit 1
  fi

  if ! cert_covers_host; then
    echo "ERROR: ${CERT_PATH} does not include DNS:${HOST}" >&2
    restore_nginx
    exit 1
  fi

  # Put the previous config back. The caller installs the notice-board vhost
  # only after this certificate is on disk.
  restore_nginx
  echo "Certificate ready: ${CERT_PATH}"
fi

if [[ "$CERT_ONLY" -eq 1 ]]; then
  exit 0
fi

if [[ ! -f nginx/nginx.combined-dbc.ssl.conf ]]; then
  echo "ERROR: missing nginx/nginx.combined-dbc.ssl.conf" >&2
  exit 1
fi

cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
"${COMPOSE[@]}" run --rm --no-deps nginx nginx -t
"${COMPOSE[@]}" up -d --force-recreate nginx
sleep 2

code="$(curl -4 -sS -o /dev/null -w '%{http_code}' --max-time 25 "https://${HOST}/" || echo 000)"
san="$(echo | openssl s_client -servername "$HOST" -connect "${HOST}:443" 2>/dev/null \
  | openssl x509 -noout -text 2>/dev/null | grep -oE 'DNS:[^,[:space:]]+' | tr '\n' ' ' || true)"
echo "https://${HOST}/ -> HTTP ${code}"
echo "Served SANs: ${san}"
if ! echo "$san" | grep -q "DNS:${HOST}"; then
  echo "ERROR: HTTPS is not serving the ${HOST} certificate" >&2
  exit 1
fi
echo "SUCCESS: ${HOST} has its own TLS certificate."
