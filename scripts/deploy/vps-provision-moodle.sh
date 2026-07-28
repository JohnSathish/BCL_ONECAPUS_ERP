#!/usr/bin/env bash
# First-time Moodle LMS provisioning on the ERP VPS (same host as nep-erp).
# Run: bash scripts/deploy/vps-provision-moodle.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db --profile moodle)

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

for var in MOODLE_DB_PASSWORD MOODLE_ADMIN_PASSWORD; do
  if [[ -z "${!var:-}" ]]; then
    echo "Set $var in .env before provisioning Moodle." >&2
    exit 1
  fi
done

echo "=== Moodle LMS — provision ==="
echo "Time: $(date -Is)"

echo "Starting moodle-db + moodle containers…"
"${COMPOSE[@]}" up -d moodle-db moodle

echo "Waiting for Moodle HTTP (up to 5 min)…"
for i in $(seq 1 60); do
  if docker run --rm --network "$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$("${COMPOSE[@]}" ps -q moodle-db 2>/dev/null | head -1)" 2>/dev/null || echo nep-erp_default)" \
    curlimages/curl:8.5.0 -sf -m 5 "http://moodle:8080/" -o /dev/null 2>/dev/null; then
    echo "Moodle is responding."
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "WARN: Moodle did not respond in time — check: docker compose logs moodle --tail 80"
  fi
  sleep 5
done

if [[ -f nginx/nginx.combined-dbc.ssl.conf ]]; then
  cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf
  "${COMPOSE[@]}" up -d nginx
fi

if [[ -f scripts/deploy/vps-install-moodle-auth-plugin.sh ]]; then
  echo "Installing auth_erp SSO plugin…"
  bash scripts/deploy/vps-install-moodle-auth-plugin.sh || echo "WARN: auth plugin install failed — retry manually"
fi

echo
echo "Next steps (Moodle admin UI):"
echo "  1. Open https://${MOODLE_HOST:-lms.donboscocollege.ac.in}"
echo "  2. Site administration → Advanced features → Enable web services"
echo "  3. Site administration → Server → Web services → Enable REST protocol"
echo "  4. Create external service 'BCL ERP' with functions:"
echo "       core_webservice_get_site_info"
echo "       core_user_create_users, core_user_update_users, core_user_get_users_by_field"
echo "       core_course_create_courses, core_course_update_courses, core_course_get_courses"
echo "       enrol_manual_enrol_users, enrol_manual_unenrol_users"
echo "  5. Generate token for ERP service account"
echo "  6. ERP → Academics → LMS → Moodle Settings → paste URL + token → Test Connection"
echo "  7. Run: bash scripts/deploy/vps-smoke-moodle.sh"
echo "=== Moodle provision complete ==="
