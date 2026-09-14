#!/bin/sh
set -eu
cat >/etc/apache2/conf-enabled/inout-secrets.conf <<EOF
SetEnv INOUT_DB_HOST "${INOUT_DB_HOST:-db}"
SetEnv INOUT_DB_NAME "${INOUT_DB_NAME:-koha_inout}"
SetEnv KOHA_DB_NAME "${KOHA_DB_NAME:-koha_library}"
SetEnv KOHA_DB_USER "${KOHA_DB_USER:-koha_library}"
SetEnv KOHA_DB_PASSWORD "${KOHA_DB_PASSWORD:-}"
EOF
exec apache2-foreground
