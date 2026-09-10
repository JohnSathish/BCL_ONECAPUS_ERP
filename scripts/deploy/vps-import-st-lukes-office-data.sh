#!/usr/bin/env bash
# Import St. Luke's register, staff, 2026 fees, and bell timetable into school SIS.
# Does not touch college FYUP or TPS KG tables.
#
# On this Windows PC, copy the source workbooks first:
#   scp "C:\Users\johnm\OneDrive\Desktop\ST.LUCK SCHOOL TURA\Students data\Class XI Students Details.xlsx" \
#       root@82.25.110.120:/opt/nep-erp/tmp-sls/
#   scp "C:\Users\johnm\OneDrive\Desktop\ST.LUCK SCHOOL TURA\Students data\NURSERY to Class X Stundets details.xlsx" \
#       root@82.25.110.120:/opt/nep-erp/tmp-sls/
#   scp "C:\Users\johnm\Downloads\St_Lukes_Teaching_Staff_Cleaned.xlsx" \
#       root@82.25.110.120:/opt/nep-erp/tmp-sls/
#
# Then on the VPS:
#   bash scripts/deploy/vps-import-st-lukes-office-data.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
SRC_DIR="${SLS_IMPORT_DIR:-$APP_DIR/tmp-sls}"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)
cd "$APP_DIR"

XI="$SRC_DIR/Class XI Students Details.xlsx"
NURSERY="$SRC_DIR/NURSERY to Class X Stundets details.xlsx"
STAFF="$SRC_DIR/St_Lukes_Teaching_Staff_Cleaned.xlsx"

missing=0
for f in "$XI" "$NURSERY" "$STAFF"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing: $f" >&2
    missing=1
  fi
done
if [[ "$missing" -eq 1 ]]; then
  echo "Place the three Excel files in $SRC_DIR and re-run." >&2
  exit 1
fi

API="$("${COMPOSE[@]}" ps -q api)"
if [[ -z "$API" ]]; then
  echo "API container is not running" >&2
  exit 1
fi

docker exec "$API" mkdir -p /tmp/sls
docker cp "$XI" "$API":/tmp/sls/xi.xlsx
docker cp "$NURSERY" "$API":/tmp/sls/nursery.xlsx
docker cp "$STAFF" "$API":/tmp/sls/staff.xlsx
docker cp "$APP_DIR/apps/api/scripts/import-st-lukes-students.ts" "$API":/app/apps/api/scripts/
docker cp "$APP_DIR/apps/api/scripts/import-st-lukes-staff.ts" "$API":/app/apps/api/scripts/
docker cp "$APP_DIR/apps/api/scripts/import-st-lukes-fees-2026.ts" "$API":/app/apps/api/scripts/
docker cp "$APP_DIR/apps/api/scripts/import-st-lukes-timetable.ts" "$API":/app/apps/api/scripts/

run() {
  "${COMPOSE[@]}" exec -T \
    -e SLS_STUDENTS_XI_XLSX=/tmp/sls/xi.xlsx \
    -e SLS_STUDENTS_NURSERY_XLSX=/tmp/sls/nursery.xlsx \
    -e SLS_STAFF_XLSX=/tmp/sls/staff.xlsx \
    api npx tsx "$@"
}

echo "=== Students ==="
run scripts/import-st-lukes-students.ts --apply
echo "=== Staff ==="
run scripts/import-st-lukes-staff.ts --apply
echo "=== Fees 2026 ==="
run scripts/import-st-lukes-fees-2026.ts
echo "=== Timetable bells ==="
run scripts/import-st-lukes-timetable.ts
echo "Done. Hard-refresh ERP Students, Staff, Fees, and Timetable."
