#!/usr/bin/env bash
# Restore platform unique indexes after a partial pg_restore (fixes seed 42P10).
# Usage: bash scripts/deploy/vps-repair-db-indexes.sh
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

PGUSER="${POSTGRES_USER:-nep}"
PGDB="${POSTGRES_DB:-nep_erp}"

echo "=== Repair platform unique indexes ==="
echo "Database: ${PGDB} (user: ${PGUSER})"
echo

echo "[1/2] Pending migrations…"
"${COMPOSE[@]}" run --rm api npm run db:migrate
echo

echo "[2/2] Platform unique indexes…"
"${COMPOSE[@]}" exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "${PGUSER}" -d "${PGDB}" \
  < scripts/deploy/repair-platform-unique-indexes.sql

echo
echo "Indexes repaired. Next:"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db run --rm \\"
echo "    -v \"\${APP_DIR}/apps/api/scripts:/app/apps/api/scripts:ro\" \\"
echo "    -v \"\${APP_DIR}/apps/api/prisma:/app/apps/api/prisma:ro\" \\"
echo "    api npx tsx scripts/seed-rbac-only.ts admin@donboscocollege.ac.in"
