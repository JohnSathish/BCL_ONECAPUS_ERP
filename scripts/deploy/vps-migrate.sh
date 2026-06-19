#!/usr/bin/env bash
# Apply pending Prisma migrations on the VPS (required after restoring a dump).
# Run on server: bash scripts/deploy/vps-migrate.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "=== NEP ERP — database migrations ==="
"${COMPOSE[@]}" run --rm \
  -e DATABASE_URL="${DATABASE_URL}" \
  -v "${APP_DIR}/apps/api/prisma:/app/apps/api/prisma:ro" \
  api npx --yes prisma@6.19.0 migrate deploy --schema=./prisma/schema.prisma

echo
echo "=== Migrations complete — restart API ==="
"${COMPOSE[@]}" up -d api
echo "Done."
