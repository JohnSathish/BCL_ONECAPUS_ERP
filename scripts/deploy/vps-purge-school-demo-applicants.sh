#!/usr/bin/env bash
# Remove Tura Public School demo K.G. applications and reset TPS27 numbering.
# Does not touch college FYUP admissions.
#
# Usage on VPS:
#   bash scripts/deploy/vps-purge-school-demo-applicants.sh
#   bash scripts/deploy/vps-purge-school-demo-applicants.sh --confirm
#   bash scripts/deploy/vps-purge-school-demo-applicants.sh --confirm --application-numbers TPS27-0001,TPS27-0002
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --confirm)
      EXTRA_ARGS+=(--confirm)
      ;;
    --application-numbers)
      EXTRA_ARGS+=(--application-numbers "$2")
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

if [[ ! -f apps/api/scripts/purge-school-demo-applicants.ts ]]; then
  echo "Missing apps/api/scripts/purge-school-demo-applicants.ts — git pull origin master first." >&2
  exit 1
fi

echo "=== Tura Public School demo applicant purge ==="
"${COMPOSE[@]}" run --rm \
  -v "${APP_DIR}/apps/api/scripts:/app/apps/api/scripts:ro" \
  api npx tsx scripts/purge-school-demo-applicants.ts "${EXTRA_ARGS[@]}"
