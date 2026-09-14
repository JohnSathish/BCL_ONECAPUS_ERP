#!/bin/bash
set -euo pipefail
HOST="${INOUT_DB_HOST:-db}"
ROOT_PW="${KOHA_DB_ROOT_PASSWORD:?}"
USER="${KOHA_DB_USER:-koha_library}"
INOUT_DB="${INOUT_DB_NAME:-koha_inout}"
KOHA_DB="${KOHA_DB_NAME:-koha_library}"

echo "Waiting for MySQL at ${HOST}…"
for _ in $(seq 1 40); do
  if mysqladmin ping -h"${HOST}" -uroot -p"${ROOT_PW}" --silent >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

mysql -h"${HOST}" -uroot -p"${ROOT_PW}" -e "CREATE DATABASE IF NOT EXISTS \`${INOUT_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; GRANT ALL ON \`${INOUT_DB}\`.* TO '${USER}'@'%'; GRANT SELECT ON \`${KOHA_DB}\`.* TO '${USER}'@'%'; FLUSH PRIVILEGES;"

TABLES="$(mysql -h"${HOST}" -uroot -p"${ROOT_PW}" -N -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='${INOUT_DB}'")"
if [[ "${TABLES}" == "0" ]]; then
  echo "Loading In/Out schema…"
  mysql -h"${HOST}" -uroot -p"${ROOT_PW}" "${INOUT_DB}" < /schema.sql
else
  echo "In/Out database ${INOUT_DB} already has tables — skip schema load."
fi
echo "In/Out DB ready."
