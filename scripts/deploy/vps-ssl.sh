#!/usr/bin/env bash
# Obtain Let's Encrypt certificates and enable HTTPS on the VPS nginx container.
# Run on server: bash scripts/deploy/vps-ssl.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
DOMAIN="${SSL_DOMAIN:-erp.donboscocollege.ac.in}"
EXTRA_DOMAINS="${SSL_EXTRA_DOMAINS:-admissions.donboscocollege.ac.in,library.donboscocollege.ac.in}"
EMAIL="${SSL_EMAIL:-admin@donboscocollege.ac.in}"

cd "$APP_DIR"

echo "=== NEP ERP — SSL setup for ${DOMAIN} ==="

if ! command -v certbot >/dev/null 2>&1; then
  echo "Installing certbot…"
  apt-get update -qq
  apt-get install -y -qq certbot
fi

mkdir -p certbot/www
mkdir -p /etc/letsencrypt

if [[ ! -f nginx/nginx.conf.bak.pre-ssl ]]; then
  cp nginx/nginx.conf nginx/nginx.conf.bak.pre-ssl
fi

# Step 1: temporary nginx — only serves ACME challenge on port 80
cat > nginx/nginx.conf << 'EOF'
worker_processes auto;
events { worker_connections 1024; }
http {
  server {
    listen 80;
    server_name erp.donboscocollege.ac.in admissions.donboscocollege.ac.in library.donboscocollege.ac.in;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'ok'; add_header Content-Type text/plain; }
  }
}
EOF

docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db up -d nginx

DOMAIN_ARGS=(-d "$DOMAIN")
IFS=',' read -ra EXTRA <<< "$EXTRA_DOMAINS"
for d in "${EXTRA[@]}"; do
  d="$(echo "$d" | xargs)"
  [[ -n "$d" ]] && DOMAIN_ARGS+=(-d "$d")
done

EXPAND_FLAG=()
if [[ -f "/etc/letsencrypt/renewal/${DOMAIN}.conf" ]]; then
  echo "Existing certificate found for ${DOMAIN} — will expand if needed."
  EXPAND_FLAG=(--expand)
fi

echo "Requesting Let's Encrypt certificate…"
certbot certonly \
  --webroot -w "${APP_DIR}/certbot/www" \
  "${DOMAIN_ARGS[@]}" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  "${EXPAND_FLAG[@]}"

# Step 2: switch to full SSL nginx config
cp nginx/nginx.ssl.conf nginx/nginx.conf
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db up -d nginx

echo
echo "=== SSL enabled ==="
curl -sI "https://${DOMAIN}/api/health/live" | head -5 || true
echo
echo "Update .env:"
echo "  WEB_ORIGIN=https://${DOMAIN}"
echo "Then restart api + web:"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db up -d api web"
echo
echo "Auto-renew (add to crontab):"
echo "  0 3 * * * certbot renew --quiet --webroot -w ${APP_DIR}/certbot/www && docker compose -f ${APP_DIR}/docker-compose.yml -f ${APP_DIR}/docker-compose.prod.yml --profile local-db exec nginx nginx -s reload"
