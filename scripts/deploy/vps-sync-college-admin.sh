#!/usr/bin/env bash
# After restoring a local dump, live login emails are the demo ones.
# This copies admin@demo.edu (password + roles) onto admin@donboscocollege.ac.in
# and clears login lockouts. Does not print or change the password hash.
#
# Run on VPS: bash scripts/deploy/vps-sync-college-admin.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

SOURCE_EMAIL="${SOURCE_EMAIL:-admin@demo.edu}"
TARGET_EMAIL="${TARGET_EMAIL:-admin@donboscocollege.ac.in}"

echo "=== Sync ${SOURCE_EMAIL} → ${TARGET_EMAIL} ==="
"${COMPOSE[@]}" exec -T postgres psql -U "${POSTGRES_USER:-nep}" -d "${POSTGRES_DB:-nep_erp}" -v ON_ERROR_STOP=1 <<SQL
DELETE FROM platform.login_attempts
WHERE lower(email) IN (lower('${SOURCE_EMAIL}'), lower('${TARGET_EMAIL}'));

INSERT INTO platform.users (
  id, tenant_id, email, username, phone, display_name, password_hash,
  email_verified_at, is_active, account_status, last_login_at,
  password_changed_at, must_reset_password, mfa_enabled, appearance_mode,
  created_at, updated_at, deleted_at
)
SELECT
  gen_random_uuid(),
  src.tenant_id,
  '${TARGET_EMAIL}',
  NULL,
  src.phone,
  COALESCE(src.display_name, 'College Administrator'),
  src.password_hash,
  NOW(),
  true,
  'active',
  NULL,
  NOW(),
  false,
  false,
  src.appearance_mode,
  NOW(),
  NOW(),
  NULL
FROM platform.users src
WHERE lower(src.email) = lower('${SOURCE_EMAIL}')
  AND src.deleted_at IS NULL
LIMIT 1
ON CONFLICT (tenant_id, email) DO UPDATE
SET
  password_hash = EXCLUDED.password_hash,
  is_active = true,
  account_status = 'active',
  deleted_at = NULL,
  must_reset_password = false,
  email_verified_at = COALESCE(platform.users.email_verified_at, NOW()),
  updated_at = NOW();

INSERT INTO platform.user_roles (
  id, user_id, role_id, campus_id, shift_id, department_id, programme_id,
  semester_no, created_at, updated_at, deleted_at
)
SELECT
  gen_random_uuid(),
  dest.id,
  r.role_id,
  r.campus_id,
  r.shift_id,
  r.department_id,
  r.programme_id,
  r.semester_no,
  NOW(),
  NOW(),
  NULL
FROM platform.users src
JOIN platform.user_roles r
  ON r.user_id = src.id AND r.deleted_at IS NULL
JOIN platform.users dest
  ON dest.tenant_id = src.tenant_id
 AND lower(dest.email) = lower('${TARGET_EMAIL}')
WHERE lower(src.email) = lower('${SOURCE_EMAIL}')
  AND src.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM platform.user_roles x
    WHERE x.user_id = dest.id
      AND x.role_id = r.role_id
      AND x.deleted_at IS NULL
  );
SQL

echo "Done. Login at https://erp.donboscocollege.ac.in/login"
echo "  ${TARGET_EMAIL}  now uses the same password as ${SOURCE_EMAIL}"
echo "  (local dump: ${SOURCE_EMAIL} / Admin@123)"
