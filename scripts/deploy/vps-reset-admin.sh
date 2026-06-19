#!/usr/bin/env bash
# Reset production college admin password and clear login lockouts.
# Usage:
#   ADMIN_PASSWORD='YourPassword' bash scripts/deploy/vps-reset-admin.sh
#   ADMIN_PASSWORD='YourPassword' ADMIN_EMAIL='admin@donboscocollege.ac.in' bash scripts/deploy/vps-reset-admin.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

ADMIN_EMAIL="${ADMIN_EMAIL:-admin@donboscocollege.ac.in}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
ADMIN_NAME="${ADMIN_NAME:-College Administrator}"

if [[ -z "${ADMIN_PASSWORD}" ]]; then
  echo "Set ADMIN_PASSWORD first." >&2
  echo "  ADMIN_PASSWORD='YourPassword' bash scripts/deploy/vps-reset-admin.sh" >&2
  exit 1
fi

echo "=== Reset admin: ${ADMIN_EMAIL} ==="
"${COMPOSE[@]}" run --rm api \
  npx tsx scripts/production-bootstrap.ts \
  --admin-email "${ADMIN_EMAIL}" \
  --admin-password "${ADMIN_PASSWORD}" \
  --admin-name "${ADMIN_NAME}"

echo
echo "=== Verify login + students ==="
SMOKE_EMAIL="${ADMIN_EMAIL}" SMOKE_PASSWORD="${ADMIN_PASSWORD}" bash scripts/deploy/vps-smoke-students.sh
