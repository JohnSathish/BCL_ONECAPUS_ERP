#!/usr/bin/env bash
# Remove demo/smoke admission applications from production DB.
#
# Usage:
#   bash scripts/deploy/vps-purge-demo-applicants.sh
#   bash scripts/deploy/vps-purge-demo-applicants.sh --confirm
#   ADMIN_EMAIL='admin@donboscocollege.ac.in' bash scripts/deploy/vps-purge-demo-applicants.sh --confirm
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@donboscocollege.ac.in}"
CONFIRM=()

for arg in "$@"; do
  if [[ "$arg" == "--confirm" ]]; then
    CONFIRM=(--confirm)
  fi
done

if [[ ! -f apps/api/scripts/purge-demo-applicants.ts ]]; then
  echo "Missing apps/api/scripts/purge-demo-applicants.ts — run: git pull origin master" >&2
  exit 1
fi

echo "=== Demo applicant purge (admin tenant: ${ADMIN_EMAIL}) ==="
"${COMPOSE[@]}" run --rm \
  -v "${APP_DIR}/apps/api/scripts:/app/apps/api/scripts:ro" \
  api npx tsx scripts/purge-demo-applicants.ts --admin-email "${ADMIN_EMAIL}" "${CONFIRM[@]}"
