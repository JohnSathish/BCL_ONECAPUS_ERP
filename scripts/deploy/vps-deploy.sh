#!/usr/bin/env bash
# Build and start the production Docker stack on the VPS.
# Prerequisites: vps-first-boot.sh, repo at /opt/nep-erp, .env configured.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env — copy scripts/deploy/production.env.example and edit" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "=== NEP ERP — production deploy ==="
echo "WEB_ORIGIN=${WEB_ORIGIN:-unset}"
echo

echo "[1/5] Building images (may take 10–20 min on first run)…"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db build

echo "[2/5] Starting postgres + redis…"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db up -d postgres redis

echo "[3/5] Waiting for postgres…"
for i in $(seq 1 60); do
  if docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-nep}" -d "${POSTGRES_DB:-nep_erp}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "[4/5] Running database migrations…"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db run --rm \
  -e DATABASE_URL="${DATABASE_URL}" \
  -v "${APP_DIR}/apps/api/prisma:/app/apps/api/prisma:ro" \
  api npx --yes prisma@6.19.0 migrate deploy --schema=./prisma/schema.prisma

echo "[5/5] Starting full stack…"
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db up -d api web worker nginx

echo
echo "=== Stack started ==="
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db ps
echo
echo "Run bootstrap (registers domains + optional admin):"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db exec api \\"
echo "    npx tsx scripts/production-bootstrap.ts \\"
echo "    --admin-email admin@donboscocollege.ac.in --admin-password '<strong-password>'"
echo
echo "Health check:"
echo "  curl -s http://127.0.0.1/api/health/live"
echo "  curl -s https://${NEXT_PUBLIC_LOGIN_HOST:-erp.donboscocollege.ac.in}/api/health/live"
echo
