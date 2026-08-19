#!/usr/bin/env bash
# Restore Academic Calendar / website planner events from the live backup
# taken immediately BEFORE the full local-dump restore.
#
# Does NOT touch students, fees, or attendance.
#
# Run on VPS:
#   cd /opt/nep-erp
#   bash scripts/deploy/vps-restore-calendar-from-pre-restore.sh
#
# Optional:
#   BACKUP_DUMP=/opt/nep-erp/backup_before_restore_YYYYMMDD_HHMMSS.dump \
#     bash scripts/deploy/vps-restore-calendar-from-pre-restore.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)
OLD_DB="${OLD_DB:-nep_erp_pre_restore}"

cd "$APP_DIR"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DB_USER="${POSTGRES_USER:-nep}"
DB_NAME="${POSTGRES_DB:-nep_erp}"

DUMP="${BACKUP_DUMP:-}"
if [[ -z "$DUMP" ]]; then
  DUMP="$(ls -1t "$APP_DIR"/backup_before_restore_*.dump 2>/dev/null | head -1 || true)"
fi
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "ERROR: no backup_before_restore_*.dump found in $APP_DIR"
  echo "List backups with: ls -lh $APP_DIR/backup_before_restore_*.dump"
  echo "The restore script always writes that file before replacing live."
  exit 1
fi

echo "=== Restore calendar events from $(basename "$DUMP") ==="
echo "Live database stays. Students are not changed."

PG=$("${COMPOSE[@]}" ps -q postgres)
docker cp "$DUMP" "$PG:/tmp/pre_restore.dump"

echo
echo "--- Live calendar counts (before) ---"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT type, count(*) FROM academic.academic_calendar_events WHERE deleted_at IS NULL GROUP BY type ORDER BY 1;"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT count(*) AS planner_days FROM academic.website_academic_planner_days WHERE deleted_at IS NULL;"

echo
echo "--- Load pre-restore dump into temp database ${OLD_DB} ---"
"${COMPOSE[@]}" exec -T postgres bash -c "
  set -euo pipefail
  psql -U '$DB_USER' -d postgres -v ON_ERROR_STOP=1 -c \"
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '$OLD_DB' AND pid <> pg_backend_pid();
  \" >/dev/null
  dropdb -U '$DB_USER' --if-exists '$OLD_DB'
  createdb -U '$DB_USER' '$OLD_DB'
  pg_restore -U '$DB_USER' -d '$OLD_DB' --no-owner --no-acl /tmp/pre_restore.dump
  rm -f /tmp/pre_restore.dump
"

echo
echo "--- Pre-restore calendar counts ---"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$OLD_DB" -c \
  "SELECT type, count(*) FROM academic.academic_calendar_events WHERE deleted_at IS NULL GROUP BY type ORDER BY 1;"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$OLD_DB" -c \
  "SELECT id, title, start_date, end_date, type FROM academic.academic_calendar_events WHERE deleted_at IS NULL ORDER BY start_date, title;"

echo
echo "--- Copy calendar + website planner into live ---"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

DELETE FROM academic.academic_calendar_events;

INSERT INTO academic.academic_calendar_events (
  id, tenant_id, calendar_id, type, title, description, start_date, end_date,
  start_time, end_time, is_working_day, creates_attendance_session, scope_type,
  campus_id, department_ids, visibility, source_module, source_ref_id,
  published_to_website, active, created_by_id, updated_by_id, created_at,
  updated_at, deleted_at, color, icon, venue, is_all_day, is_recurring,
  recurrence_rule, recurrence_parent_id, programme_id, semester_id, shift_id,
  visibility_flags, attachment_urls, organizer_name
)
SELECT
  e.id, e.tenant_id, live_cal.id, e.type, e.title, e.description, e.start_date, e.end_date,
  e.start_time, e.end_time, e.is_working_day, e.creates_attendance_session, e.scope_type,
  CASE WHEN live_campus.id IS NULL THEN NULL ELSE e.campus_id END,
  e.department_ids, e.visibility, e.source_module, e.source_ref_id,
  e.published_to_website, e.active, e.created_by_id, e.updated_by_id, e.created_at,
  e.updated_at, e.deleted_at, e.color, e.icon, e.venue, e.is_all_day, e.is_recurring,
  e.recurrence_rule, e.recurrence_parent_id,
  CASE WHEN live_prog.id IS NULL THEN NULL ELSE e.programme_id END,
  CASE WHEN live_sem.id IS NULL THEN NULL ELSE e.semester_id END,
  CASE WHEN live_shift.id IS NULL THEN NULL ELSE e.shift_id END,
  e.visibility_flags, e.attachment_urls, e.organizer_name
FROM nep_erp_pre_restore.academic.academic_calendar_events e
JOIN nep_erp_pre_restore.academic.academic_calendars oc ON oc.id = e.calendar_id
JOIN nep_erp_pre_restore.core.academic_years oy ON oy.id = oc.academic_year_id
JOIN core.academic_years ly
  ON ly.tenant_id = oy.tenant_id
 AND ly.name = oy.name
JOIN academic.academic_calendars live_cal
  ON live_cal.academic_year_id = ly.id
LEFT JOIN core.campuses live_campus
  ON live_campus.id = e.campus_id
LEFT JOIN academic.programs live_prog
  ON live_prog.id = e.programme_id
LEFT JOIN core.semesters live_sem
  ON live_sem.id = e.semester_id
LEFT JOIN core.shifts live_shift
  ON live_shift.id = e.shift_id;

UPDATE academic.academic_calendars live_cal
SET
  title = oc.title,
  status = oc.status,
  weekend_days = oc.weekend_days,
  published_at = oc.published_at,
  updated_at = now()
FROM nep_erp_pre_restore.academic.academic_calendars oc
JOIN nep_erp_pre_restore.core.academic_years oy ON oy.id = oc.academic_year_id
JOIN core.academic_years ly
  ON ly.tenant_id = oy.tenant_id
 AND ly.name = oy.name
WHERE live_cal.academic_year_id = ly.id;

COMMIT;
SQL

echo
echo "--- Website planner / CMS events (best-effort) ---"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" <<'SQL' || true
BEGIN;
DELETE FROM academic.website_academic_planner_days;
DELETE FROM academic.website_academic_planner_years;
INSERT INTO academic.website_academic_planner_years
SELECT y.*
FROM nep_erp_pre_restore.academic.website_academic_planner_years y
JOIN academic.website_sites s ON s.id = y.site_id;
INSERT INTO academic.website_academic_planner_days
SELECT d.*
FROM nep_erp_pre_restore.academic.website_academic_planner_days d
JOIN academic.website_academic_planner_years y ON y.id = d.year_id;
UPDATE academic.website_sites live
SET
  settings_json = jsonb_set(
    COALESCE(live.settings_json::jsonb, '{}'::jsonb),
    '{calendarItems}',
    COALESCE(old.settings_json::jsonb->'calendarItems', '[]'::jsonb),
    true
  ),
  updated_at = now()
FROM nep_erp_pre_restore.academic.website_sites old
WHERE live.tenant_id = old.tenant_id;
COMMIT;
SQL

echo
echo "--- Live calendar counts (after) ---"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT type, count(*) FROM academic.academic_calendar_events WHERE deleted_at IS NULL GROUP BY type ORDER BY 1;"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT title, type, start_date, end_date FROM academic.academic_calendar_events WHERE deleted_at IS NULL ORDER BY start_date, title;"

echo
echo "Temp database ${OLD_DB} is kept for inspection. Drop later with:"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db exec postgres dropdb -U ${DB_USER} ${OLD_DB}"
echo
echo "Hard-refresh Academics → Calendar. Students were not changed."
