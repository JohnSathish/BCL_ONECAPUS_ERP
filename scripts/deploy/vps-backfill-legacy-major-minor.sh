#!/usr/bin/env bash
# Production: legacy Major/Minor migration for pre-ERP Sem-3+ students.
#
# Why: Sem 4 has no Minor. Sem 4→5 promotion needs StudentProgramChoice MINOR
# (and student_major_minor_tracks) so auto-assign can LOCK the correct path.
#
# Flow:
#   1. Export collection sheet (office fills minorDepartment)
#   2. Import filled CSV
#   3. Sync tracks
#   4. Report missing + verify readiness
#
# Usage on VPS (after ERP code deploy). BACK UP THE DATABASE FIRST.
#
#   # A) Export sheet for the college office
#   bash scripts/deploy/vps-backfill-legacy-major-minor.sh --export
#
#   # B) Dry-run import of filled CSV (mount/copy file under apps/api/scripts/data/)
#   CSV=scripts/data/legacy-minor-filled.csv bash scripts/deploy/vps-backfill-legacy-major-minor.sh --import --dry-run
#
#   # C) Apply import + track sync + verify
#   CSV=scripts/data/legacy-minor-filled.csv bash scripts/deploy/vps-backfill-legacy-major-minor.sh --import
#
#   # D) Report / verify only
#   bash scripts/deploy/vps-backfill-legacy-major-minor.sh --report
#   bash scripts/deploy/vps-backfill-legacy-major-minor.sh --verify
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

DRY_RUN=0
MODE=""
TENANT="${TENANT:-demo}"
SEM="${SEM:-3}"
CSV="${CSV:-}"
ALLOW_NONSTANDARD=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --export) MODE="export" ;;
    --import) MODE="import" ;;
    --report) MODE="report" ;;
    --verify) MODE="verify" ;;
    --allow-nonstandard) ALLOW_NONSTANDARD=1 ;;
    --help|-h)
      echo "Usage:"
      echo "  bash scripts/deploy/vps-backfill-legacy-major-minor.sh --export"
      echo "  CSV=path/to.csv bash scripts/deploy/vps-backfill-legacy-major-minor.sh --import [--dry-run]"
      echo "  bash scripts/deploy/vps-backfill-legacy-major-minor.sh --report"
      echo "  bash scripts/deploy/vps-backfill-legacy-major-minor.sh --verify"
      echo "  TENANT=demo SEM=3 (defaults)"
      exit 0
      ;;
    *) echo "Unknown option: $arg (try --help)" >&2; exit 1 ;;
  esac
done

if [[ -z "$MODE" ]]; then
  echo "Specify --export, --import, --report, or --verify (see --help)" >&2
  exit 1
fi

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
    -v "${APP_DIR}/apps/api/scripts:/app/apps/api/scripts" \
    api "$@"
}

echo "=== NEP ERP — legacy Major/Minor migration ==="
echo "Tenant: ${TENANT}  Sem>=${SEM}  Mode: ${MODE}  Dry run: $([[ $DRY_RUN -eq 1 ]] && echo yes || echo no)"
echo

echo "[0] Ensuring postgres/redis up…"
"${COMPOSE[@]}" up -d postgres redis
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-nep}" -d "${POSTGRES_DB:-nep_erp}" >/dev/null 2>&1; then break; fi
  sleep 2
done

case "$MODE" in
  export)
    echo
    echo "[1] Export Sem-${SEM}+ collection sheet…"
    mkdir -p apps/api/scripts/data
    OUT="scripts/data/legacy-minor-collection-sem${SEM}.csv"
    api_run npx tsx scripts/export-sem3-minor-collection-sheet.ts \
      --tenant="${TENANT}" --sem="${SEM}" --missing-only \
      --out="/app/apps/api/${OUT}"
    echo "Sheet written to ${APP_DIR}/apps/api/${OUT}"
    echo "Fill minorDepartment for each row, then:"
    echo "  CSV=apps/api/${OUT} bash scripts/deploy/vps-backfill-legacy-major-minor.sh --import --dry-run"
    echo "  CSV=apps/api/${OUT} bash scripts/deploy/vps-backfill-legacy-major-minor.sh --import"
    ;;
  import)
    if [[ -z "$CSV" ]]; then
      echo "CSV=path/to/filled.csv is required for --import" >&2
      exit 1
    fi
    # Allow path relative to APP_DIR or apps/api
    CSV_IN="$CSV"
    if [[ ! -f "$CSV_IN" && -f "apps/api/$CSV" ]]; then
      CSV_IN="apps/api/$CSV"
    fi
    if [[ ! -f "$CSV_IN" ]]; then
      echo "CSV file not found: $CSV" >&2
      exit 1
    fi
    # Container path: scripts are mounted at /app/apps/api/scripts
    REL="${CSV_IN#apps/api/}"
    CONTAINER_CSV="/app/apps/api/${REL}"

    echo
    echo "[1] Import legacy major/minor from ${CSV_IN}…"
    IMPORT_ARGS=(npx tsx scripts/import-legacy-major-minor.ts --tenant="${TENANT}" --file="${CONTAINER_CSV}")
    if [[ $DRY_RUN -eq 1 ]]; then IMPORT_ARGS+=(--dry-run); fi
    if [[ $ALLOW_NONSTANDARD -eq 1 ]]; then IMPORT_ARGS+=(--allow-nonstandard); fi
    api_run "${IMPORT_ARGS[@]}"

    if [[ $DRY_RUN -eq 0 ]]; then
      echo
      echo "[2] Sync student_major_minor_tracks…"
      api_run npx tsx scripts/backfill-major-minor-tracks.ts --tenant="${TENANT}"
      echo
      echo "[3] Report remaining missing minors…"
      api_run npx tsx scripts/report-missing-minor-choices.ts --tenant="${TENANT}" --sem="${SEM}" || true
      echo
      echo "[4] Verify promotion readiness (4→5 Minor)…"
      VERIFY_ARGS=(npx tsx scripts/verify-legacy-minor-promotion-ready.ts --tenant="${TENANT}" --sem="${SEM}")
      if [[ $ALLOW_NONSTANDARD -eq 1 ]]; then VERIFY_ARGS+=(--allow-nonstandard); fi
      api_run "${VERIFY_ARGS[@]}" || true
    else
      echo
      echo "DRY RUN complete — nothing was written. Re-run without --dry-run to apply."
    fi
    ;;
  report)
    echo
    echo "[1] Report missing MINOR program choices…"
    api_run npx tsx scripts/report-missing-minor-choices.ts --tenant="${TENANT}" --sem="${SEM}" || true
    ;;
  verify)
    echo
    echo "[1] Verify Sem 4→5 Minor readiness…"
    VERIFY_ARGS=(npx tsx scripts/verify-legacy-minor-promotion-ready.ts --tenant="${TENANT}" --sem="${SEM}")
    if [[ $ALLOW_NONSTANDARD -eq 1 ]]; then VERIFY_ARGS+=(--allow-nonstandard); fi
    api_run "${VERIFY_ARGS[@]}" || true
    echo
    echo "[2] Sync tracks (idempotent)…"
    if [[ $DRY_RUN -eq 1 ]]; then
      api_run npx tsx scripts/backfill-major-minor-tracks.ts --tenant="${TENANT}" --dry-run
    else
      api_run npx tsx scripts/backfill-major-minor-tracks.ts --tenant="${TENANT}"
    fi
    ;;
esac

echo
echo "=== Done ==="
