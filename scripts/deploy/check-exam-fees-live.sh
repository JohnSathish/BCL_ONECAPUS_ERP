#!/usr/bin/env bash
set -euo pipefail
cd /opt/nep-erp
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

echo "=== API live ==="
"${COMPOSE[@]}" exec -T api wget -qO- http://127.0.0.1:3001/api/health/live || true
echo

echo "=== exam_fee_masters table ==="
"${COMPOSE[@]}" exec -T postgres psql -U "${POSTGRES_USER:-nep}" -d "${POSTGRES_DB:-nep_erp}" -c \
  "SELECT to_regclass('finance.exam_fee_masters') AS exam_fee_masters, to_regclass('finance.exam_fee_sessions') AS exam_fee_sessions;"

echo "=== exam-fees permissions ==="
"${COMPOSE[@]}" exec -T postgres psql -U "${POSTGRES_USER:-nep}" -d "${POSTGRES_DB:-nep_erp}" -c \
  "SELECT slug FROM public.permissions WHERE slug LIKE 'exam-fees%' ORDER BY slug;"

echo "=== git HEAD ==="
git rev-parse --short HEAD
git log -1 --oneline
