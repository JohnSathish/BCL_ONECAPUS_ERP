#!/usr/bin/env bash
# Finalize imported-but-"Pending" subject registrations on production.
# Works for any semester via SEM=n (default 3). Handles Sem-3 and Sem-5.
#
# What it does (idempotent, dry-run first):
#   1. Read-only pre-flight summary of Sem-<SEM> registration/line statuses.
#   2. Semester-specific data corrections (only when needed):
#        SEM=5 → fix PHY-303 INTERNSHIP section stream (mistagged Arts → Science).
#   3. attach-missing-major-sections.ts — attach the shift-matching section to
#      any draft line left without one (e.g. Garo GAR-200 / GAR-201 in Sem-3).
#   4. finalize-draft-registrations.ts — flip every non-completed registration
#      for a LIVE student to status 'completed' and its lines to 'confirmed',
#      the ONLY state the UI renders as fully registered (clears "Pending").
#      Registrations belonging to soft-deleted students are skipped (orphans).
#   5. Read-only post summary.
#
# It does NOT book seat-ledger seats (unused in this deployment; booking would
# waitlist over-capacity shared papers) and does NOT write semester_progress.
#
# Run on VPS (after vps-update.sh / vps-pull.sh so the scripts are present):
#   BACK UP THE DATABASE FIRST.
#   bash scripts/deploy/vps-finalize-sem3-registrations.sh --dry-run           # Sem-3 preview
#   bash scripts/deploy/vps-finalize-sem3-registrations.sh                     # Sem-3 apply
#   SEM=5 bash scripts/deploy/vps-finalize-sem3-registrations.sh --dry-run     # Sem-5 preview
#   SEM=5 bash scripts/deploy/vps-finalize-sem3-registrations.sh               # Sem-5 apply
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

if [[ "${SEM}" == "5" ]]; then
  echo
  echo "[1b/4] Sem-5 data correction — PHY-303 INTERNSHIP stream (Arts → Science):"
  if [[ $DRY_RUN -eq 1 ]]; then
    psql_q "SELECT c.code, sec.section_code, st.name AS current_stream
            FROM academic.offering_sections sec
            JOIN academic.course_offerings o ON o.id=sec.course_offering_id
            JOIN academic.courses c ON c.id=o.course_id
            JOIN academic.offering_section_streams oss ON oss.offering_section_id=sec.id
            JOIN core.academic_streams st ON st.id=oss.academic_stream_id
            WHERE c.code='PHY-303' AND o.semester_sequence=5;"
    echo "  (dry-run — no change; would set any Arts row here to Science)"
  else
    psql_q "UPDATE academic.offering_section_streams oss
            SET academic_stream_id = (SELECT id FROM core.academic_streams WHERE code='SCIENCE' AND deleted_at IS NULL)
            WHERE oss.academic_stream_id = (SELECT id FROM core.academic_streams WHERE code='ARTS' AND deleted_at IS NULL)
              AND oss.offering_section_id IN (
                SELECT sec.id FROM academic.offering_sections sec
                JOIN academic.course_offerings o ON o.id=sec.course_offering_id
                JOIN academic.courses c ON c.id=o.course_id
                WHERE c.code='PHY-303' AND o.semester_sequence=5);"
  fi
fi

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
