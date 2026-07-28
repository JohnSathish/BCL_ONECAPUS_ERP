#!/usr/bin/env bash
# Copy auth_erp plugin into the running Moodle container and enable it.
# Run on VPS after vps-provision-moodle.sh: bash scripts/deploy/vps-install-moodle-auth-plugin.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db --profile moodle)

MOODLE_CID="$("${COMPOSE[@]}" ps -q moodle 2>/dev/null | head -1)"
if [[ -z "${MOODLE_CID}" ]]; then
  echo "Moodle container is not running. Start with: bash scripts/deploy/vps-provision-moodle.sh" >&2
  exit 1
fi

if [[ ! -d integrations/moodle-auth-erp ]]; then
  echo "Missing integrations/moodle-auth-erp in repo." >&2
  exit 1
fi

echo "=== Install Moodle auth_erp plugin ==="
echo "Container: ${MOODLE_CID}"

docker exec "${MOODLE_CID}" mkdir -p /bitnami/moodle/auth/erp
docker cp integrations/moodle-auth-erp/. "${MOODLE_CID}:/bitnami/moodle/auth/erp/"

# Bitnami runs as daemon user — ensure plugin files are readable
docker exec -u root "${MOODLE_CID}" chown -R daemon:daemon /bitnami/moodle/auth/erp

ERP_API_BASE="${ERP_API_BASE:-https://erp.donboscocollege.ac.in/api}"

echo "Purging Moodle caches…"
docker exec -u daemon "${MOODLE_CID}" php /bitnami/moodle/admin/cli/purge_caches.php || true

echo "Enabling auth_erp plugin in auth sequence…"
docker exec -u daemon "${MOODLE_CID}" php /bitnami/moodle/admin/cli/cfg.php \
  --name=auth --set=manual,erp,email 2>/dev/null || true

echo "Setting ERP API base URL for plugin…"
docker exec -u daemon "${MOODLE_CID}" php /bitnami/moodle/admin/cli/cfg.php \
  --component=auth_erp --name=erp_api_base --set="${ERP_API_BASE}" 2>/dev/null || true

if docker exec "${MOODLE_CID}" test -f /bitnami/moodle/auth/erp/version.php; then
  echo "OK: auth_erp plugin installed at /bitnami/moodle/auth/erp"
else
  echo "FAIL: plugin version.php not found after copy" >&2
  exit 1
fi

echo
echo "Moodle admin UI (if needed): Site administration → Plugins → Authentication → BCL OneCampus ERP SSO"
echo "ERP API base should be: ${ERP_API_BASE}"
echo "=== auth_erp install complete ==="
