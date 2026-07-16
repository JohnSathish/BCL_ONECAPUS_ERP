#!/usr/bin/env bash
# Production: fix Sem-4 VTC Stage-II catalog + backfill student VTC tracks.
#
# Why this matters for promotion:
#   Sem-4 VTC wrongly reused Stage-I courses (VTC-24x "– I"). Promotion must
#   continue Desktop Publishing-I → Desktop Publishing-II (VTC-26x), etc.
#   Students also need student_vtc_tracks rows so the engine knows which vocation.
#
# Safe / idempotent. Dry-run first.
#
# Run on VPS AFTER a normal ERP code deploy (so these scripts exist):
#   BACK UP THE DATABASE FIRST.
#   bash scripts/deploy/vps-fix-sem4-vtc.sh --dry-run
#   bash scripts/deploy/vps-fix-sem4-vtc.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

DRY_RUN=0
TENANT="${TENANT:-demo}"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --help|-h)
      echo "Usage: bash scripts/deploy/vps-fix-sem4-vtc.sh [--dry-run]"
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

echo "=== NEP ERP — Sem-4 VTC Stage-II fix + VTC track backfill ==="
echo "Tenant: ${TENANT}   Dry run: $([[ $DRY_RUN -eq 1 ]] && echo yes || echo no)"
echo

echo "[0/3] Ensuring postgres/redis up…"
"${COMPOSE[@]}" up -d postgres redis
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-nep}" -d "${POSTGRES_DB:-nep_erp}" >/dev/null 2>&1; then break; fi
  sleep 2
done

echo
echo "[1/3] Fix Sem-4 VTC Stage-II catalog (create VTC-26x, re-point pools, tag tracks)…"
if [[ $DRY_RUN -eq 1 ]]; then
  api_run npx tsx scripts/fix-sem4-vtc-stage2.ts --tenant="${TENANT}" --dry-run
else
  api_run npx tsx scripts/fix-sem4-vtc-stage2.ts --tenant="${TENANT}"
fi

echo
echo "[2/3] Backfill student_vtc_tracks from Sem-3 VTC choices…"
if [[ $DRY_RUN -eq 1 ]]; then
  api_run npx tsx scripts/backfill-vtc-tracks.ts --tenant="${TENANT}" --dry-run
else
  api_run npx tsx scripts/backfill-vtc-tracks.ts --tenant="${TENANT}"
fi

echo
echo "[3/3] Verify promotion continuity (11 vocations → Stage-II)…"
api_run npx tsx scripts/verify-vtc-continuity.ts --tenant="${TENANT}"

echo
if [[ $DRY_RUN -eq 1 ]]; then
  echo "DRY RUN complete — nothing was written. Re-run without --dry-run to apply."
else
  echo "Done. Sem-4 VTC Stage-II catalog + student tracks are ready for promotion."
fi
