#!/usr/bin/env bash
# Restore Academic Calendar / website planner events from the live backup
# taken immediately BEFORE the full local-dump restore.
#
# Does NOT touch students, fees, or attendance.
# Copies via a staging table (Postgres cannot query another database by name).
#
# Run on VPS:
#   cd /opt/nep-erp
#   bash scripts/deploy/vps-restore-calendar-from-pre-restore.sh
#
# If nep_erp_pre_restore is already loaded:
#   FORCE_RELOAD=0 bash scripts/deploy/vps-restore-calendar-from-pre-restore.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)
OLD_DB="${OLD_DB:-nep_erp_pre_restore}"
FORCE_RELOAD="${FORCE_RELOAD:-}"

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

old_event_count() {
  "${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$OLD_DB" -Atqc \
    "SELECT count(*) FROM academic.academic_calendar_events;" 2>/dev/null || echo 0
}

EXISTING_OLD="$(old_event_count | tr -d '[:space:]')"
if [[ "${FORCE_RELOAD}" == "1" ]]; then
  EXISTING_OLD=0
fi

if [[ "${EXISTING_OLD}" =~ ^[1-9][0-9]*$ ]]; then
  echo "Temp database ${OLD_DB} already has ${EXISTING_OLD} events — skipping dump reload."
  echo "Set FORCE_RELOAD=1 to load the dump again."
else
  PG=$("${COMPOSE[@]}" ps -q postgres)
  docker cp "$DUMP" "$PG:/tmp/pre_restore.dump"

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
fi

echo
echo "--- Live calendar counts (before) ---"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
  "SELECT type, count(*) FROM academic.academic_calendar_events WHERE deleted_at IS NULL GROUP BY type ORDER BY 1;"

echo
echo "--- Pre-restore calendar counts ---"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$OLD_DB" -c \
  "SELECT type, count(*) FROM academic.academic_calendar_events WHERE deleted_at IS NULL GROUP BY type ORDER BY 1;"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$OLD_DB" -c \
  "SELECT title, start_date, end_date, type FROM academic.academic_calendar_events WHERE deleted_at IS NULL ORDER BY start_date, title;"

echo
echo "--- Copy events through staging table ---"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
DROP TABLE IF EXISTS tmp_pre_cal_events;
CREATE TABLE tmp_pre_cal_events (LIKE academic.academic_calendar_events);
ALTER TABLE tmp_pre_cal_events ADD COLUMN year_name text;
ALTER TABLE tmp_pre_cal_events ADD COLUMN year_tenant_id uuid;
SQL

"${COMPOSE[@]}" exec -T postgres bash -s <<INNER
set -euo pipefail
psql -U ${DB_USER} -d ${OLD_DB} -v ON_ERROR_STOP=1 -c "COPY (
  SELECT e.id, e.tenant_id, e.calendar_id, e.type, e.title, e.description, e.start_date, e.end_date,
         e.start_time, e.end_time, e.is_working_day, e.creates_attendance_session, e.scope_type,
         e.campus_id, e.department_ids, e.visibility, e.source_module, e.source_ref_id,
         e.published_to_website, e.active, e.created_by_id, e.updated_by_id, e.created_at,
         e.updated_at, e.deleted_at, e.color, e.icon, e.venue, e.is_all_day, e.is_recurring,
         e.recurrence_rule, e.recurrence_parent_id, e.programme_id, e.semester_id, e.shift_id,
         e.visibility_flags, e.attachment_urls, e.organizer_name,
         oy.name, oy.tenant_id
  FROM academic.academic_calendar_events e
  JOIN academic.academic_calendars oc ON oc.id = e.calendar_id
  JOIN core.academic_years oy ON oy.id = oc.academic_year_id
) TO STDOUT" | psql -U ${DB_USER} -d ${DB_NAME} -v ON_ERROR_STOP=1 -c "COPY tmp_pre_cal_events FROM STDIN"
INNER

STAGED="$("${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -Atqc "SELECT count(*) FROM tmp_pre_cal_events;" | tr -d '[:space:]')"
echo "Staged ${STAGED} event(s) from pre-restore backup."
if [[ "${STAGED}" == "0" ]]; then
  echo "ERROR: staging table is empty."
  exit 1
fi

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
  e.id, e.tenant_id,
  COALESCE(by_id.id, by_year.id),
  e.type, e.title, e.description, e.start_date, e.end_date,
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
FROM tmp_pre_cal_events e
LEFT JOIN academic.academic_calendars by_id
  ON by_id.id = e.calendar_id
LEFT JOIN core.academic_years ly
  ON ly.tenant_id = e.year_tenant_id
 AND ly.name = e.year_name
LEFT JOIN academic.academic_calendars by_year
  ON by_year.academic_year_id = ly.id
LEFT JOIN core.campuses live_campus
  ON live_campus.id = e.campus_id
LEFT JOIN academic.programs live_prog
  ON live_prog.id = e.programme_id
LEFT JOIN core.semesters live_sem
  ON live_sem.id = e.semester_id
LEFT JOIN core.shifts live_shift
  ON live_shift.id = e.shift_id
WHERE COALESCE(by_id.id, by_year.id) IS NOT NULL;

UPDATE academic.academic_calendars live_cal
SET
  status = 'PUBLISHED',
  published_at = COALESCE(live_cal.published_at, now()),
  updated_at = now()
WHERE live_cal.deleted_at IS NULL
  AND live_cal.id IN (
    SELECT DISTINCT calendar_id FROM academic.academic_calendar_events
  );

COMMIT;
SQL

INSERTED="$("${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -Atqc \
  "SELECT count(*) FROM academic.academic_calendar_events WHERE deleted_at IS NULL;" | tr -d '[:space:]')"
if [[ "${INSERTED}" == "0" ]]; then
  echo "ERROR: no events landed on live. Year names may not match."
  echo "Live years:"
  "${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
    "SELECT id, name FROM core.academic_years WHERE deleted_at IS NULL ORDER BY name;"
  echo "Backup year names on staged rows:"
  "${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -c \
    "SELECT DISTINCT year_name, year_tenant_id FROM tmp_pre_cal_events;"
  exit 1
fi

echo
echo "--- Website planner / CMS events (best-effort) ---"
"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL || true
DROP TABLE IF EXISTS tmp_pre_planner_years;
DROP TABLE IF EXISTS tmp_pre_planner_days;
DROP TABLE IF EXISTS tmp_pre_sites;
CREATE TABLE tmp_pre_planner_years (LIKE academic.website_academic_planner_years);
CREATE TABLE tmp_pre_planner_days (LIKE academic.website_academic_planner_days);
CREATE TABLE tmp_pre_sites (LIKE academic.website_sites);
SQL

"${COMPOSE[@]}" exec -T postgres bash -s <<INNER || true
set -euo pipefail
psql -U ${DB_USER} -d ${OLD_DB} -c "COPY academic.website_academic_planner_years TO STDOUT" \
  | psql -U ${DB_USER} -d ${DB_NAME} -c "COPY tmp_pre_planner_years FROM STDIN" || true
psql -U ${DB_USER} -d ${OLD_DB} -c "COPY academic.website_academic_planner_days TO STDOUT" \
  | psql -U ${DB_USER} -d ${DB_NAME} -c "COPY tmp_pre_planner_days FROM STDIN" || true
psql -U ${DB_USER} -d ${OLD_DB} -c "COPY academic.website_sites TO STDOUT" \
  | psql -U ${DB_USER} -d ${DB_NAME} -c "COPY tmp_pre_sites FROM STDIN" || true
INNER

"${COMPOSE[@]}" exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" <<'SQL' || true
BEGIN;
DELETE FROM academic.website_academic_planner_days;
DELETE FROM academic.website_academic_planner_years;
INSERT INTO academic.website_academic_planner_years
SELECT y.* FROM tmp_pre_planner_years y
JOIN academic.website_sites s ON s.id = y.site_id;
INSERT INTO academic.website_academic_planner_days
SELECT d.* FROM tmp_pre_planner_days d
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
FROM tmp_pre_sites old
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
echo "Restored ${INSERTED} calendar event(s). Students were not changed."
echo "Hard-refresh Academics → Calendar."
echo
echo "Temp database ${OLD_DB} is kept. Drop later with:"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db exec postgres dropdb -U ${DB_USER} ${OLD_DB}"
