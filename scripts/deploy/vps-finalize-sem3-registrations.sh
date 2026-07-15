#!/usr/bin/env bash
# Finalize imported-but-"Pending" Sem-3 subject registrations on production.
#
# What it does (idempotent, dry-run first):
#   1. Read-only pre-flight summary of Sem-3 registration/line statuses.
#   2. attach-missing-major-sections.ts — attach the shift-matching section to
#      any draft line left without one (e.g. Garo GAR-200 / GAR-201).
#   3. finalize-draft-registrations.ts — flip every non-completed Sem-3
#      registration to status 'completed' and its lines to 'confirmed', which
#      is the ONLY state the UI renders as fully registered (clears "Pending").
#   4. Read-only post summary.
#
# It does NOT book seat-ledger seats (unused in this deployment; booking would
# waitlist over-capacity shared papers) and does NOT write semester_progress.
#
# Run on VPS (after vps-update.sh / vps-pull.sh so the scripts are present):
#   BACK UP THE DATABASE FIRST.
#   bash scripts/deploy/vps-finalize-sem3-registrations.sh --dry-run   # preview
#   bash scripts/deploy/vps-finalize-sem3-registrations.sh             # apply
#   TENANT=demo SEM=3 bash scripts/deploy/vps-finalize-sem3-registrations.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

DRY_RUN=0
TENANT="${TENANT:-demo}"
SEM="${SEM:-3}"

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --help|-h)
      echo "Usage: bash scripts/deploy/vps-finalize-sem3-registrations.sh [--dry-run]"
      echo "  TENANT=demo (default), SEM=3 (default)"
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

psql_q() {
  "${COMPOSE[@]}" exec -T postgres psql -U "${POSTGRES_USER:-nep}" -d "${POSTGRES_DB:-nep_erp}" -P pager=off -c "$1"
}

echo "=== NEP ERP — finalize Sem-${SEM} registrations ==="
echo "Tenant: ${TENANT}   Dry run: $([[ $DRY_RUN -eq 1 ]] && echo yes || echo no)"
echo

echo "[0/4] Ensuring postgres/redis up…"
"${COMPOSE[@]}" up -d postgres redis
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-nep}" -d "${POSTGRES_DB:-nep_erp}" >/dev/null 2>&1; then break; fi
  sleep 2
done

echo
echo "[1/4] Pre-flight (read-only) — Sem-${SEM} registration status:"
psql_q "SELECT sr.status AS reg_status, COUNT(*) AS regs
        FROM academic.semester_registrations sr
        WHERE sr.semester_sequence=${SEM}
        GROUP BY sr.status ORDER BY regs DESC;"
psql_q "SELECT COUNT(*) AS null_section_draft_lines
        FROM academic.semester_registration_lines l
        JOIN academic.semester_registrations sr ON sr.id=l.registration_id
        WHERE sr.semester_sequence=${SEM} AND sr.status NOT IN ('completed','rejected')
          AND l.offering_section_id IS NULL;"

echo
echo "[2/4] Attach missing MAJOR sections…"
api_run npx tsx scripts/attach-missing-major-sections.ts --tenant="${TENANT}" --sem="${SEM}" --dry-run
if [[ $DRY_RUN -eq 0 ]]; then
  api_run npx tsx scripts/attach-missing-major-sections.ts --tenant="${TENANT}" --sem="${SEM}" --apply
fi

echo
echo "[3/4] Finalize registrations…"
api_run npx tsx scripts/finalize-draft-registrations.ts --tenant="${TENANT}" --sem="${SEM}" --dry-run
if [[ $DRY_RUN -eq 0 ]]; then
  api_run npx tsx scripts/finalize-draft-registrations.ts --tenant="${TENANT}" --sem="${SEM}" --apply
fi

echo
echo "[4/4] Post summary (read-only):"
psql_q "SELECT sr.status AS reg_status, COUNT(*) AS regs
        FROM academic.semester_registrations sr
        WHERE sr.semester_sequence=${SEM}
        GROUP BY sr.status ORDER BY regs DESC;"

echo
if [[ $DRY_RUN -eq 1 ]]; then
  echo "DRY RUN complete — nothing was written. Re-run without --dry-run to apply."
else
  echo "Done. All Sem-${SEM} registrations should now show as Completed (not Pending)."
  echo "Restart API to clear caches:  ${COMPOSE[*]} up -d api"
fi
