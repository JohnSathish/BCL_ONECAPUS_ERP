#!/usr/bin/env bash
# Restore SSL + reverse-proxy for extra websites that share the ERP VPS IP.
#
# OpenLiteSpeed is not installed on this VPS (no /usr/local/lsws). Extra sites
# are separate Docker apps. Each hostname must proxy to its own published port;
# otherwise sacredheartshrinetura.in shows Mercy Dosa House.
#
# Run on the VPS:
#   cd /opt/nep-erp && git pull origin master && bash scripts/deploy/vps-restore-extra-sites-ssl.sh
# Optional: MERCY_BACKEND_PORT=13000 MERCY_API_BACKEND_PORT=13001 DIOCESE_BACKEND_PORT=13100
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
EMAIL="${SSL_EMAIL:-admin@donboscocollege.ac.in}"
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
echo "--- Docker containers (likely extra-site backends) ---"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null || true
echo "homes: $(ls /home 2>/dev/null | tr '\n' ' ' || echo none)"

cert_ok_for_site() {
  local site="$1"
  local cert_dir="/etc/letsencrypt/live/${site}"
  [[ -f "${cert_dir}/fullchain.pem" ]] || return 1
  openssl x509 -in "${cert_dir}/fullchain.pem" -noout -checkend 2592000 >/dev/null 2>&1 || return 1
  openssl x509 -in "${cert_dir}/fullchain.pem" -noout -text 2>/dev/null | grep -q "DNS:${site}"
}

# docker-website = Mercy Dosa. bcl-diocese-web = Diocese + parish sites
# (sacredheartshrinetura.in is a host on the Diocese app, not a separate container).
OVERRIDE_MERCY_WEB="${MERCY_BACKEND_PORT:-}"
OVERRIDE_MERCY_ADMIN="${MERCY_ADMIN_BACKEND_PORT:-}"
OVERRIDE_MERCY_API="${MERCY_API_BACKEND_PORT:-}"
OVERRIDE_DIOCESE_WEB="${DIOCESE_BACKEND_PORT:-}"
OVERRIDE_DIOCESE_API="${DIOCESE_API_PORT:-}"

MERCY_WEB_PORT=""
MERCY_ADMIN_PORT=""
MERCY_API_PORT=""
DIOCESE_WEB_PORT=""
DIOCESE_API_PORT=""

while read -r name ports; do
  [[ -n "${name:-}" ]] || continue
  lname="$(echo "$name" | tr '[:upper:]' '[:lower:]')"
  hostport="$(echo "$ports" | grep -oE '0\.0\.0\.0:[0-9]+' | head -1 | cut -d: -f2 || true)"
  [[ -n "$hostport" ]] || continue
  case "$hostport" in
    80|443|3000|3001|3002|8080|8443|6379|15432) continue ;;
  esac
  case "$lname" in
    docker-website*|mercy-website*|mercy-web*) MERCY_WEB_PORT="$hostport" ;;
    docker-admin*|mercy-admin*) MERCY_ADMIN_PORT="$hostport" ;;
    docker-api*|mercy-api*) MERCY_API_PORT="$hostport" ;;
    bcl-diocese-web*|diocese-web*) DIOCESE_WEB_PORT="$hostport" ;;
    bcl-diocese-api*|diocese-api*) DIOCESE_API_PORT="$hostport" ;;
  esac
done < <(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null || true)

[[ -n "$OVERRIDE_MERCY_WEB" ]] && MERCY_WEB_PORT="$OVERRIDE_MERCY_WEB"
[[ -n "$OVERRIDE_MERCY_ADMIN" ]] && MERCY_ADMIN_PORT="$OVERRIDE_MERCY_ADMIN"
[[ -n "$OVERRIDE_MERCY_API" ]] && MERCY_API_PORT="$OVERRIDE_MERCY_API"
[[ -n "$OVERRIDE_DIOCESE_WEB" ]] && DIOCESE_WEB_PORT="$OVERRIDE_DIOCESE_WEB"
[[ -n "$OVERRIDE_DIOCESE_API" ]] && DIOCESE_API_PORT="$OVERRIDE_DIOCESE_API"
[[ -n "${SACRED_BACKEND_PORT:-}" ]] && DIOCESE_WEB_PORT="$SACRED_BACKEND_PORT"

declare -A SITE_PORT=()
[[ -n "$MERCY_WEB_PORT" ]] && SITE_PORT[mercydosahouse.com]="$MERCY_WEB_PORT"
[[ -n "$DIOCESE_WEB_PORT" ]] && SITE_PORT[turadiocese.in]="$DIOCESE_WEB_PORT"
[[ -n "$DIOCESE_WEB_PORT" ]] && SITE_PORT[sacredheartshrinetura.in]="$DIOCESE_WEB_PORT"

echo
echo "--- Docker name map ---"
echo "  Mercy web    : ${MERCY_WEB_PORT:-MISSING}"
echo "  Mercy admin  : ${MERCY_ADMIN_PORT:-MISSING}"
echo "  Mercy API    : ${MERCY_API_PORT:-MISSING} (/api on mercydosahouse.com)"
echo "  Diocese web  : ${DIOCESE_WEB_PORT:-MISSING} (also sacredheartshrinetura.in)"
echo "  Diocese API  : ${DIOCESE_API_PORT:-MISSING} (api.turadiocese.in)"

echo
echo "--- Per-site backends ---"
MISSING=0
for site in "${SITES[@]}"; do
  if [[ -n "${SITE_PORT[$site]:-}" ]]; then
    echo "  ${site} -> 127.0.0.1:${SITE_PORT[$site]}"
  else
    echo "  ${site} -> NOT FOUND (will serve 503, not another site)"
    MISSING=1
  fi
done

if [[ "$MISSING" -eq 1 ]]; then
  echo
  echo "WARN: one or more extra sites have no matching app."
  echo "OpenLiteSpeed (/usr/local/lsws) is not on this server — ignore lswsctrl."
  echo "Start the missing Docker site, or re-run with e.g. SACRED_BACKEND_PORT=13001"
  ss -lptn 2>/dev/null | grep -E ':1300|:1310|:1410|:8088' || true
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

proxy_headers() {
  cat <<'EOF'
    proxy_http_version 1.1;
    proxy_set_header   Host $host;
    proxy_set_header   X-Real-IP $remote_addr;
    proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto https;
    proxy_set_header   X-Forwarded-Host $host;
    proxy_connect_timeout 5s;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
EOF
}

emit_vhost() {
  local names="$1"
  local cert="$2"
  local port="$3"
  local api_port="${4:-}"
  local location_block
  if [[ -n "$port" ]]; then
    location_block="  location / {
    proxy_pass         http://host.docker.internal:${port};
$(proxy_headers)
  }"
    if [[ -n "$api_port" ]]; then
      location_block="  location /api {
    proxy_pass         http://host.docker.internal:${api_port};
$(proxy_headers)
  }

${location_block}"
    fi
  else
    location_block='  location / {
    default_type text/plain;
    return 503 "This domain is not mapped to a running app on this server.";
  }'
  fi
  cat <<EOF
server {
  listen 80;
  server_name ${names};

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
  server_name ${names};

  ssl_certificate     ${cert}/fullchain.pem;
  ssl_certificate_key ${cert}/privkey.pem;
  ssl_session_cache   shared:SSL:10m;
  ssl_session_timeout 1d;
  ssl_protocols       TLSv1.2 TLSv1.3;

  client_max_body_size 64m;

${location_block}
}

EOF
}

{
  echo "# Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) by vps-restore-extra-sites-ssl.sh"
  echo "# Mercy docker-website / docker-admin; Diocese bcl-diocese-web + bcl-diocese-api."
  echo
  emit_vhost "mercydosahouse.com www.mercydosahouse.com" \
    /etc/letsencrypt/live/mercydosahouse.com "${MERCY_WEB_PORT:-}" "${MERCY_API_PORT:-}"
  emit_vhost "admin.mercydosahouse.com" \
    /etc/letsencrypt/live/mercydosahouse.com "${MERCY_ADMIN_PORT:-}" "${MERCY_API_PORT:-}"
  emit_vhost "turadiocese.in www.turadiocese.in sacredheart.turadiocese.in" \
    /etc/letsencrypt/live/turadiocese.in "${DIOCESE_WEB_PORT:-}" "${DIOCESE_API_PORT:-}"
  emit_vhost "api.turadiocese.in" \
    /etc/letsencrypt/live/turadiocese.in "${DIOCESE_API_PORT:-}"
  emit_vhost "sacredheartshrinetura.in www.sacredheartshrinetura.in" \
    /etc/letsencrypt/live/sacredheartshrinetura.in "${DIOCESE_WEB_PORT:-}" "${DIOCESE_API_PORT:-}"
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
echo "OpenLiteSpeed/lswsctrl is not used on this server."
echo "  https://mercydosahouse.com/              -> :${MERCY_WEB_PORT:-503}  /api -> :${MERCY_API_PORT:-503}"
echo "  https://admin.mercydosahouse.com/        -> :${MERCY_ADMIN_PORT:-503}"
echo "  https://turadiocese.in/                  -> :${DIOCESE_WEB_PORT:-503}"
echo "  https://sacredheart.turadiocese.in/      -> :${DIOCESE_WEB_PORT:-503}"
echo "  https://sacredheartshrinetura.in/        -> :${DIOCESE_WEB_PORT:-503} (Diocese parish host)"
echo "  https://api.turadiocese.in/              -> :${DIOCESE_API_PORT:-503}"
echo
echo "College ERP HTTPS was not changed."
