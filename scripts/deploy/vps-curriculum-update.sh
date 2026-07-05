#!/usr/bin/env bash
# Re-apply FYUGP curriculum on production after a code deploy (seed + finalize + verify).
#
# Run on VPS (after vps-update.sh or vps-pull.sh):
#   bash scripts/deploy/vps-curriculum-update.sh
#   bash scripts/deploy/vps-curriculum-update.sh --dry-run
#   TENANT=demo bash scripts/deploy/vps-curriculum-update.sh --skip-seed
#
# Steps:
#   1. FYUGP seed (arts / science / commerce catalogs + shift pools)
#   2. Finalize curriculum (dry-run, then --apply unless --dry-run)
#   3. Verify canonical pools and programme mappings
#
# Take a database backup before running on live data.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

DRY_RUN=0
SKIP_SEED=0
TENANT="${TENANT:-demo}"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-seed) SKIP_SEED=1 ;;
    --help|-h)
      echo "Usage: bash scripts/deploy/vps-curriculum-update.sh [--dry-run] [--skip-seed]"
      echo "  TENANT=demo (default) — tenant slug for finalize/verify scripts"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

api_run() {
  "${COMPOSE[@]}" run --rm \
    -e DATABASE_URL="${DATABASE_URL}" \
    -v "${APP_DIR}/apps/api/prisma:/app/apps/api/prisma:ro" \
    -v "${APP_DIR}/apps/api/src:/app/apps/api/src:ro" \
    -v "${APP_DIR}/apps/api/scripts:/app/apps/api/scripts:ro" \
    api "$@"
}

echo "=== NEP ERP — FYUGP curriculum update ==="
echo "Tenant: ${TENANT}"
echo "Dry run finalize only: $([[ $DRY_RUN -eq 1 ]] && echo yes || echo no)"
echo "Skip seed: $([[ $SKIP_SEED -eq 1 ]] && echo yes || echo no)"
echo

echo "[0/4] Ensuring postgres is up…"
"${COMPOSE[@]}" up -d postgres redis
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-nep}" -d "${POSTGRES_DB:-nep_erp}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

if [[ $SKIP_SEED -eq 0 ]]; then
  echo
  echo "[1/4] Seeding FYUGP curriculum (idempotent upserts)…"
  api_run npx tsx prisma/seed.ts
else
  echo
  echo "[1/4] Skipping seed (--skip-seed)"
fi

echo
echo "[2/4] Finalize curriculum — dry run…"
api_run npx tsx scripts/finalize-fyugp-curriculum.ts --tenant="${TENANT}"

if [[ $DRY_RUN -eq 1 ]]; then
  echo
  echo "[3/4] Skipping finalize --apply (--dry-run)"
else
  echo
  echo "[3/4] Finalize curriculum — apply…"
  api_run npx tsx scripts/finalize-fyugp-curriculum.ts --tenant="${TENANT}" --apply
fi

echo
echo "[4/4] Verify FYUGP curriculum…"
api_run npx tsx scripts/verify-fyugp-curriculum.ts

echo
echo "=== Curriculum update complete ==="
echo "Restart API to clear any in-memory caches:"
echo "  ${COMPOSE[*]} up -d api"
echo
echo "Then hard-refresh the browser (Ctrl+Shift+R) and check:"
echo "  • Academic Engine → Curriculum manager → Major–Minor combinations"
echo "  • Course Catalog / Curriculum Completion / Bulk Import template"
