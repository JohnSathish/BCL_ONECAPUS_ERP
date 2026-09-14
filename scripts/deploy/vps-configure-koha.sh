#!/usr/bin/env bash
# Standalone Koha ILS on the college VPS.
# No ERP / Bosco Connect / Library I/O integration — own DB, own containers, own URLs.
#
# Prerequisites:
#   1. DNS A records (same VPS IP):
#        koha.donboscocollege.ac.in
#        staff.koha.donboscocollege.ac.in
#   2. Dump on the VPS, e.g. /opt/nep-erp/koha/library-2026-09-14.sql
#   3. koha/.env from koha/env.example (strong passwords)
#
#   cd /opt/nep-erp
#   git fetch origin master && git reset --hard origin/master
#   KOHA_SQL_DUMP=/opt/nep-erp/koha/library-2026-09-14.sql bash scripts/deploy/vps-configure-koha.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
KOHA_DIR="${APP_DIR}/koha"
EMAIL="${SSL_EMAIL:-admin@donboscocollege.ac.in}"
OPAC_HOST="koha.donboscocollege.ac.in"
STAFF_HOST="staff.koha.donboscocollege.ac.in"
# Nginx on this VPS owns :80/:443. Reload only — do not recreate ERP api/web.
NGINX_COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)
COMPOSE_KOHA=(docker compose --project-name dbc-koha --env-file "${KOHA_DIR}/.env" -f "${KOHA_DIR}/docker-compose.yml")

cd "$APP_DIR"

echo "=== Standalone Koha ILS (${OPAC_HOST}) ==="

if [[ ! -f "${KOHA_DIR}/docker-compose.yml" ]]; then
  echo "ERROR: missing ${KOHA_DIR}/docker-compose.yml — git pull origin master first." >&2
  exit 1
fi

if [[ ! -f "${KOHA_DIR}/.env" ]]; then
  echo "ERROR: missing ${KOHA_DIR}/.env"
  echo "  cp ${KOHA_DIR}/env.example ${KOHA_DIR}/.env"
  echo "  nano ${KOHA_DIR}/.env"
  exit 1
fi

mkdir -p "${KOHA_DIR}/backups" certbot/www/.well-known/acme-challenge nginx/extra-sites.d

echo "Pulling Koha from Docker Hub (no zip upload)…"
"${COMPOSE_KOHA[@]}" pull

echo "Starting dedicated Koha stack (dbc-koha)…"
"${COMPOSE_KOHA[@]}" up -d

echo "Waiting for Koha MySQL…"
for _ in $(seq 1 40); do
  if docker exec koha-db mysqladmin ping -h127.0.0.1 --silent >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

DUMP="${KOHA_SQL_DUMP:-}"
if [[ -z "$DUMP" ]]; then
  if [[ -f "${KOHA_DIR}/library-2026-09-14.sql" ]]; then
    DUMP="${KOHA_DIR}/library-2026-09-14.sql"
  else
    DUMP="$(ls -1t "${KOHA_DIR}"/library-*.sql 2>/dev/null | head -1 || true)"
  fi
fi
if [[ -z "$DUMP" ]]; then
  if [[ -f "${KOHA_DIR}/backups/koha.sql.gz" ]]; then
    DUMP="${KOHA_DIR}/backups/koha.sql.gz"
  elif [[ -f "${KOHA_DIR}/backups/koha.sql" ]]; then
    DUMP="${KOHA_DIR}/backups/koha.sql"
  fi
fi

if [[ -n "${DUMP}" && -f "$DUMP" ]]; then
  echo "Restoring Koha dump: ${DUMP}"
  set -a
  # shellcheck disable=SC1090
  source "${KOHA_DIR}/.env"
  set +a
  DB_NAME="${KOHA_DB_NAME:-koha_library}"
  docker exec koha-db mysql -uroot -p"${KOHA_DB_ROOT_PASSWORD}" -e "DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci; GRANT ALL ON \`${DB_NAME}\`.* TO '${KOHA_DB_USER:-koha_library}'@'%'; FLUSH PRIVILEGES;"
  if [[ "$DUMP" == *.gz ]]; then
    gzip -dc "$DUMP" | docker exec -i koha-db mysql -uroot -p"${KOHA_DB_ROOT_PASSWORD}"
  else
    docker exec -i koha-db mysql -uroot -p"${KOHA_DB_ROOT_PASSWORD}" < "$DUMP"
  fi
  docker exec koha-db mysql -uroot -p"${KOHA_DB_ROOT_PASSWORD}" "$DB_NAME" -e \
    "UPDATE systempreferences SET value='https://${OPAC_HOST}' WHERE variable='OPACBaseURL';
     UPDATE systempreferences SET value='https://${STAFF_HOST}' WHERE variable='staffClientBaseURL';"
  echo "Dump restored. Restarting Koha…"
  "${COMPOSE_KOHA[@]}" restart koha
  sleep 8
  docker exec koha-web bash -lc 'koha-rebuild-zebra -f -v $(ls /etc/koha/sites 2>/dev/null | head -1) || true' || true
else
  echo "No Koha SQL dump found."
  echo "Upload library-2026-09-14.sql then re-run with KOHA_SQL_DUMP=..."
fi

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update -qq
  apt-get install -y -qq certbot
fi

CERT_DOMAINS=(-d "${OPAC_HOST}")
if getent hosts "${STAFF_HOST}" >/dev/null 2>&1; then
  CERT_DOMAINS+=(-d "${STAFF_HOST}")
  echo "TLS certificate for ${OPAC_HOST} + ${STAFF_HOST}"
else
  echo "No DNS yet for ${STAFF_HOST} — certificate for OPAC only."
  echo "Add an A record ${STAFF_HOST} → this VPS, then re-run this script."
fi
certbot certonly \
  --webroot -w "${APP_DIR}/certbot/www" \
  --cert-name "${OPAC_HOST}" \
  "${CERT_DOMAINS[@]}" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive \
  --expand || {
    echo "WARN: certbot failed. Point DNS at this VPS, then re-run."
  }

TEMPLATE="${APP_DIR}/scripts/deploy/templates/koha-dbc-nginx.conf.template"
TARGET="${APP_DIR}/nginx/extra-sites.d/koha-dbc.conf"
if [[ ! -f "/etc/letsencrypt/live/${OPAC_HOST}/fullchain.pem" ]]; then
  echo "ERROR: no certificate at /etc/letsencrypt/live/${OPAC_HOST}"
  exit 1
fi
cp "$TEMPLATE" "$TARGET"
echo "Wrote ${TARGET}"

"${NGINX_COMPOSE[@]}" exec -T nginx nginx -t
"${NGINX_COMPOSE[@]}" exec -T nginx nginx -s reload || true

echo
echo "--- Checks ---"
for url in "https://${OPAC_HOST}/" "https://${STAFF_HOST}/"; do
  code="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 20 "$url" || echo 000)"
  echo "  ${code}  ${url}"
done

echo
echo "Koha OPAC:  https://${OPAC_HOST}/"
echo "Koha staff: https://${STAFF_HOST}/"
echo "This ILS does not use Bosco Connect login, students, or Library I/O."
