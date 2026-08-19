#!/usr/bin/env bash
# Restore SSL + reverse-proxy for extra websites that share the ERP VPS IP.
#
# Docker nginx owns :80/:443 and currently serves the ERP certificate for any
# unmatched hostname (mercydosahouse.com, sacredheartshrinetura.in, turadiocese.in).
# Chrome then shows NET::ERR_CERT_COMMON_NAME_INVALID.
#
# Run on the VPS:
#   cd /opt/nep-erp && git pull origin master && bash scripts/deploy/vps-restore-extra-sites-ssl.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
EMAIL="${SSL_EMAIL:-admin@donboscocollege.ac.in}"
BACKEND_PORT="${EXTRA_SITES_BACKEND_PORT:-}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

SITES=(
  "mercydosahouse.com"
  "sacredheartshrinetura.in"
  "turadiocese.in"
)

cd "$APP_DIR"

echo "=== Restore extra-site SSL on $(hostname -f 2>/dev/null || hostname) ==="
echo "Commit: $(git log -1 --oneline)"

if [[ ! -f nginx/nginx.combined-dbc.ssl.conf ]]; then
  echo "ERROR: missing nginx/nginx.combined-dbc.ssl.conf"
  exit 1
fi

if ! grep -q 'extra-sites.d' nginx/nginx.combined-dbc.ssl.conf; then
  echo "ERROR: combined nginx config has no extra-sites include. git pull first."
  exit 1
fi

if ! grep -q extra-sites.d docker-compose.prod.yml; then
  echo "ERROR: docker-compose.prod.yml is missing extra-sites.d. git pull origin master first."
  exit 1
fi

mkdir -p nginx/extra-sites.d certbot/www/.well-known/acme-challenge /etc/letsencrypt

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq certbot
fi

echo
echo "--- Who owns :80 / :443 ---"
ss -lptn 'sport = :80 or sport = :443' 2>/dev/null || netstat -lptn | grep -E ':80|:443' || true

echo
echo "--- Local HTTP listeners (CyberPanel / OpenLiteSpeed candidates) ---"
ss -lptn 2>/dev/null | grep -E 'lshttpd|openlitespeed|httpd|apache|lsws' || true

ensure_ols_proxy_listener() {
  local conf="/usr/local/lsws/conf/httpd_config.conf"
  [[ -f "$conf" ]] || return 0
  if grep -qE '127\.0\.0\.1:8088|:8088' "$conf"; then
    echo "OpenLiteSpeed already has an :8088 listener"
    return 0
  fi

  echo "Adding OpenLiteSpeed 127.0.0.1:8088 listener so Docker nginx can proxy extra sites"
  local maps=""
  local site vhost
  for site in "${SITES[@]}"; do
    vhost=""
    if [[ -d "/usr/local/lsws/conf/vhosts/${site}" ]]; then
      vhost="$site"
    elif [[ -d "/usr/local/lsws/conf/vhosts/www.${site}" ]]; then
      vhost="www.${site}"
    elif [[ -d "/home/${site}/public_html" ]]; then
      vhost="$site"
    fi
    [[ -n "$vhost" ]] || continue
    maps+="  map                     ${site} ${vhost}"$'\n'
    maps+="  map                     www.${site} ${vhost}"$'\n'
  done
  if [[ -z "$maps" ]]; then
    echo "WARN: no OpenLiteSpeed vhosts found for extra sites; listener maps skipped"
    return 0
  fi

  cp "$conf" "${conf}.bak.extra-sites.$(date +%Y%m%d%H%M%S)"
  cat >> "$conf" <<EOF

listener DockerHTTP {
  address                 127.0.0.1:8088
  secure                  0
${maps}
}
EOF
  if [[ -x /usr/local/lsws/bin/lswsctrl ]]; then
    /usr/local/lsws/bin/lswsctrl restart || true
  elif command -v systemctl >/dev/null 2>&1; then
    systemctl restart lsws || true
  fi
  sleep 2
}

ensure_ols_proxy_listener

detect_backend_port() {
  local domain="$1"
  local port code
  for port in ${BACKEND_PORT:-} 8088 8080 8888 8008 9080; do
    [[ -n "$port" ]] || continue
    code="$(curl -4 -sS -o /tmp/extra-site-body --max-time 4 -w '%{http_code}' \
      -H "Host: ${domain}" "http://127.0.0.1:${port}/" || true)"
    if [[ "$code" =~ ^(200|301|302|303|307|308)$ ]]; then
      echo "$port"
      return 0
    fi
  done
  return 1
}

BACKEND=""
for site in "${SITES[@]}"; do
  if port="$(detect_backend_port "$site")"; then
    BACKEND="$port"
    echo "Detected extra-site backend http://127.0.0.1:${BACKEND} (Host: ${site})"
    break
  fi
done

if [[ -z "$BACKEND" ]]; then
  echo
  echo "ERROR: Could not find CyberPanel/OpenLiteSpeed HTTP backend for extra sites."
  echo "Docker nginx is correctly owning :80/:443, but the original sites must still"
  echo "answer on a local port (usually 8088) so nginx can reverse-proxy them."
  echo
  echo "Fix on this VPS, then re-run:"
  echo "  1. In CyberPanel, keep the websites; do not delete them."
  echo "  2. Make OpenLiteSpeed listen on 127.0.0.1:8088 (this script tries to add that)."
  echo "  3. Or set EXTRA_SITES_BACKEND_PORT=<port> and re-run."
  echo
  echo "Listening ports now:"
  ss -lptn 2>/dev/null | head -80 || true
  exit 1
fi

PROBE="nep-extra-acme-$(date +%s)"
echo "ok-${PROBE}" > "certbot/www/.well-known/acme-challenge/${PROBE}"
"${COMPOSE[@]}" up -d nginx
sleep 3

echo
echo "--- HTTP-01 reachability ---"
HTTP_FAIL=0
for site in "${SITES[@]}"; do
  body="$(curl -4 -sS --max-time 15 "http://${site}/.well-known/acme-challenge/${PROBE}" || true)"
  if [[ "$body" == "ok-${PROBE}" ]]; then
    echo "OK  ${site}"
  else
    echo "FAIL ${site} (got: ${body:0:80})"
    HTTP_FAIL=1
  fi
done
rm -f "certbot/www/.well-known/acme-challenge/${PROBE}"

if [[ "$HTTP_FAIL" -ne 0 ]]; then
  echo "ERROR: Let's Encrypt cannot validate extra hosts over HTTP :80."
  exit 1
fi

echo
echo "--- Issue / reuse Let's Encrypt certificates ---"
for site in "${SITES[@]}"; do
  cert_dir="/etc/letsencrypt/live/${site}"
  if [[ -f "${cert_dir}/fullchain.pem" ]] && openssl x509 -in "${cert_dir}/fullchain.pem" -noout -checkend 2592000 >/dev/null 2>&1; then
    if openssl x509 -in "${cert_dir}/fullchain.pem" -noout -text | grep -q "DNS:${site}"; then
      echo "KEEP ${site} (existing cert still valid)"
      continue
    fi
  fi
  echo "REQUEST ${site} + www.${site}"
  certbot certonly \
    --webroot -w "${APP_DIR}/certbot/www" \
    --cert-name "$site" \
    -d "$site" -d "www.${site}" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --expand \
    --preferred-challenges http
done

echo
echo "--- Write nginx extra-site vhosts ---"
gen="${APP_DIR}/nginx/extra-sites.d/hosted-sites.conf"

{
  echo "# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) by vps-restore-extra-sites-ssl.sh"
  echo "# Backend: host.docker.internal:${BACKEND}"
  echo
  for site in "${SITES[@]}"; do
    cert="/etc/letsencrypt/live/${site}"
    cat <<EOF
server {
  listen 80;
  server_name ${site} www.${site};

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 301 https://\$host\$request_uri;
  }
}

server {
  listen 443 ssl;
  http2 on;
  server_name ${site} www.${site};

  ssl_certificate     ${cert}/fullchain.pem;
  ssl_certificate_key ${cert}/privkey.pem;
  ssl_session_cache   shared:SSL:10m;
  ssl_session_timeout 1d;
  ssl_protocols       TLSv1.2 TLSv1.3;

  client_max_body_size 64m;

  location / {
    proxy_pass         http://host.docker.internal:${BACKEND};
    proxy_http_version 1.1;
    proxy_set_header   Host \$host;
    proxy_set_header   X-Real-IP \$remote_addr;
    proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto https;
    proxy_set_header   X-Forwarded-Host \$host;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
  }
}

EOF
  done
} > "$gen"

cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
"${COMPOSE[@]}" up -d --force-recreate nginx
sleep 4

echo
echo "--- Verify certificates ---"
FAIL=0
for site in "${SITES[@]}"; do
  san="$(echo | openssl s_client -servername "$site" -connect "${site}:443" 2>/dev/null \
    | openssl x509 -noout -text 2>/dev/null | grep -oE 'DNS:[^,[:space:]]+' | tr '\n' ' ' || true)"
  if echo "$san" | grep -q "DNS:${site}"; then
    echo "OK  ${site}  SANs: ${san}"
  else
    echo "FAIL ${site}  SANs: ${san}"
    FAIL=1
  fi
done

if [[ "$FAIL" -ne 0 ]]; then
  echo
  echo "ERROR: one or more extra sites still serve the wrong certificate."
  docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db logs nginx --tail 80 || true
  exit 1
fi

echo
echo "=== Extra-site SSL restored ==="
echo "Open these without the Chrome warning:"
for site in "${SITES[@]}"; do
  echo "  https://${site}/"
done
echo
echo "College ERP HTTPS was not changed."
