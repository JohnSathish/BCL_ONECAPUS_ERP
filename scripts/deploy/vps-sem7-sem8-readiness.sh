#!/usr/bin/env bash
# Sem 7/8 curriculum readiness — verify (and optionally seed) placeholder offerings.
#
# Prerequisites:
#   - ERP updated (vps-update-erp-safe.sh / vps-update.sh)
#   - Migrations applied (includes eligibility_override_reason, previous_college_name)
#   - DB backup recommended before --seed
#
# Usage on VPS:
#   bash scripts/deploy/vps-sem7-sem8-readiness.sh              # verify only
#   bash scripts/deploy/vps-sem7-sem8-readiness.sh --seed       # verify → seed → re-verify
#   bash scripts/deploy/vps-sem7-sem8-readiness.sh --seed --dry-run
#   TENANT=demo bash scripts/deploy/vps-sem7-sem8-readiness.sh --seed
#
# After green verify, smoke manually:
#   1) Admit one Sem 7 lateral with aggregate 70 + marksheet (+ MIGRATION/TC if LATERAL)
#   2) Register Sem 7 (3 Major + 2 Minor)
#   3) Sem 8: Research blocked at 70%; Honours allowed; Research at 80% or override+reason
#
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

SEED=0
DRY_RUN=0
TENANT="${TENANT:-demo}"

for arg in "$@"; do
  case "$arg" in
    --seed) SEED=1 ;;
    --dry-run) DRY_RUN=1 ;;
    --help|-h)
      echo "Usage: bash scripts/deploy/vps-sem7-sem8-readiness.sh [--seed] [--dry-run]"
      echo "  TENANT=demo (default)"
      exit 0
      ;;
    *) echo "Unknown option: $arg (try --help)" >&2; exit 1 ;;
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

echo "=== NEP ERP — Sem 7/8 curriculum readiness ==="
echo "Tenant: ${TENANT}   Seed: $([[ $SEED -eq 1 ]] && echo yes || echo no)   Dry-run: $([[ $DRY_RUN -eq 1 ]] && echo yes || echo no)"
echo
echo "Reminder: ensure migrations are applied (eligibility_override_reason, previous_college_name)."
echo

echo "[0] Ensuring postgres/redis up…"
"${COMPOSE[@]}" up -d postgres redis
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-nep}" -d "${POSTGRES_DB:-nep_erp}" >/dev/null 2>&1; then break; fi
  sleep 2
done

echo "[1] Verify Sem 7/8 offerings…"
VERIFY_OK=0
if api_run sh -c "cd /app/apps/api && npx tsx scripts/verify-sem7-sem8-curriculum.ts --tenant=${TENANT}"; then
  VERIFY_OK=1
fi

if [[ $SEED -eq 1 ]]; then
  echo
  echo "[2] Seed provisional Sem 7/8 catalog…"
  SEED_ARGS=(scripts/seed-sem7-sem8-placeholder-catalog.ts "--tenant=${TENANT}")
  if [[ $DRY_RUN -eq 1 ]]; then
    SEED_ARGS+=(--dry-run)
  fi
  api_run sh -c "cd /app/apps/api && npx tsx ${SEED_ARGS[*]}"

  echo
  echo "[3] Re-verify…"
  if api_run sh -c "cd /app/apps/api && npx tsx scripts/verify-sem7-sem8-curriculum.ts --tenant=${TENANT}"; then
    VERIFY_OK=1
  else
    VERIFY_OK=0
  fi
elif [[ $VERIFY_OK -eq 0 ]]; then
  echo
  echo "Gaps found. Re-run with --seed to create provisional offerings:"
  echo "  bash scripts/deploy/vps-sem7-sem8-readiness.sh --seed"
fi

echo
echo "=== Smoke checklist (manual) ==="
echo "  - One-by-one: Add Student → Current semester 7 → attested aggregate % + Major/Minor"
echo "  - Bulk: Students import → Sem 7 Template"
echo "  - Sem 8 pathway: Research blocked unless aggregate >= 75 (or override + reason)"
echo "  - Sem 7+: marksheet required; LATERAL/MIGRATION also need MIGRATION or TC"
echo "  - Rename provisional titles from NEHU syllabi in Admin → Programs → curriculum"
echo

if [[ $VERIFY_OK -eq 1 ]]; then
  echo "READY — Sem 7/8 curriculum verify passed."
  exit 0
fi

echo "NOT READY — Sem 7/8 curriculum verify failed."
exit 1
