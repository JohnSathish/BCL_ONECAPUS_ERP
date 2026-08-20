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

echo
echo "--- Existing Let's Encrypt live dirs ---"
ls -1 /etc/letsencrypt/live 2>/dev/null || echo "(none)"

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
  local ctrl="/usr/local/lsws/bin/lswsctrl"
  if [[ ! -f "$conf" ]]; then
    echo "WARN: OpenLiteSpeed config not found at $conf"
    return 0
  fi

  echo "Moving OpenLiteSpeed off :80/:443 (Docker nginx owns those) onto 127.0.0.1:8088"
  cp "$conf" "${conf}.bak.docker-bind.$(date +%Y%m%d%H%M%S)"
  sed -i -E 's/^([[:space:]]*address[[:space:]]+)\*:80[[:space:]]*$/\1127.0.0.1:8088/' "$conf"
  sed -i -E 's/^([[:space:]]*address[[:space:]]+)\*:443[[:space:]]*$/\1127.0.0.1:8444/' "$conf"

  if [[ -x "$ctrl" ]]; then
    "$ctrl" restart || "$ctrl" start || true
  fi
  if command -v systemctl >/dev/null 2>&1; then
    systemctl start lsws 2>/dev/null || true
    systemctl start lscpd 2>/dev/null || true
  fi
  sleep 3
  ss -lptn 2>/dev/null | grep -E '8088|lshttpd|openlitespeed' || true
}

ensure_ols_proxy_listener

detect_backend_port() {
  local domain="$1"
  local port code body
  # 8080/8443 are Moodle. 80/443 are Docker nginx.
  for port in ${BACKEND_PORT:-} 8088 13000 13001 13002 13100 14100 8888 8008 9080 8090 7080; do
    [[ -n "$port" ]] || continue
    [[ "$port" == "8080" || "$port" == "8443" ]] && continue
    code="$(curl -4 -sS -o /tmp/extra-site-body --max-time 4 -w '%{http_code}' \
      -H "Host: ${domain}" "http://127.0.0.1:${port}/" || true)"
    body="$(head -c 400 /tmp/extra-site-body 2>/dev/null || true)"
    if echo "$body" | grep -qiE 'moodle|nextjs|journals-portal|Don Bosco College'; then
      continue
    fi
    if [[ "$code" =~ ^(200|301|302|303|307|308)$ ]]; then
      echo "$port"
      return 0
    fi
  done
  return 1
}

cert_ok_for_site() {
  local site="$1"
  local cert_dir="/etc/letsencrypt/live/${site}"
  [[ -f "${cert_dir}/fullchain.pem" ]] || return 1
  openssl x509 -in "${cert_dir}/fullchain.pem" -noout -checkend 2592000 >/dev/null 2>&1 || return 1
  openssl x509 -in "${cert_dir}/fullchain.pem" -noout -text 2>/dev/null | grep -q "DNS:${site}"
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
  BACKEND=8088
  echo
  echo "WARN: no CyberPanel HTTP backend answered yet. Issuing certificates anyway"
  echo "and proxying to 127.0.0.1:${BACKEND} (OpenLiteSpeed DockerHTTP listener)."
  echo "Chrome will stop showing the certificate warning. If a site then shows 502,"
  echo "start OpenLiteSpeed: /usr/local/lsws/bin/lswsctrl start"
  ss -lptn 2>/dev/null | head -40 || true
fi

NEED_ACME=0
echo
echo "--- Certificate coverage ---"
for site in "${SITES[@]}"; do
  if cert_ok_for_site "$site"; then
    echo "KEEP ${site} (existing Let's Encrypt cert is valid)"
  else
    echo "NEED ${site}"
    NEED_ACME=1
  fi
done

if [[ "$NEED_ACME" -eq 1 ]]; then
  echo
  echo "--- Apply ACME-capable nginx, then HTTP-01 ---"
  cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
  "${COMPOSE[@]}" up -d --force-recreate nginx
  sleep 4

  PROBE="nep-extra-acme-$(date +%s)"
  echo "ok-${PROBE}" > "certbot/www/.well-known/acme-challenge/${PROBE}"

  HTTP_FAIL=0
  for site in "${SITES[@]}"; do
    cert_ok_for_site "$site" && continue
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
    echo "ERROR: Let's Encrypt cannot validate missing hosts over HTTP :80."
    exit 1
  fi

  echo
  echo "--- Issue missing certificates ---"
  for site in "${SITES[@]}"; do
    cert_ok_for_site "$site" && continue
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
else
  echo "All extra-site certificates already exist — skipping HTTP-01 / certbot."
fi

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
    proxy_connect_timeout 5s;
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
