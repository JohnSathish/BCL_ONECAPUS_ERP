#!/usr/bin/env bash
# Clear college student/staff in-app notification inbox (platform.notifications).
#
# Usage on VPS:
#   bash scripts/deploy/vps-purge-user-notifications.sh
#   bash scripts/deploy/vps-purge-user-notifications.sh --execute
#   TENANT_SLUG=demo bash scripts/deploy/vps-purge-user-notifications.sh --execute
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)
TENANT_SLUG="${TENANT_SLUG:-demo}"
EXTRA_ARGS=(--tenant="$TENANT_SLUG")

while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute)
      EXTRA_ARGS+=(--execute)
      ;;
    --tenant=*)
      EXTRA_ARGS+=("$1")
      ;;
    --tenant)
      EXTRA_ARGS+=(--tenant="$2")
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

if [[ ! -f apps/api/scripts/purge-test-user-notifications.ts ]]; then
  echo "Missing apps/api/scripts/purge-test-user-notifications.ts — git pull origin master first." >&2
  exit 1
fi

echo "=== User notification inbox purge (tenant: ${TENANT_SLUG}) ==="
"${COMPOSE[@]}" run --rm \
  -v "${APP_DIR}/apps/api/scripts:/app/apps/api/scripts:ro" \
  api npx tsx scripts/purge-test-user-notifications.ts "${EXTRA_ARGS[@]}"
