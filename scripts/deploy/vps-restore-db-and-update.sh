#!/usr/bin/env bash
# Restore a pg_dump custom-format backup on VPS, deploy latest code, lock curriculum.
#
# Prerequisite: copy dump to VPS, e.g.
#   scp nep_erp_live_upload.dump root@82.25.110.120:/opt/nep-erp/
#
# On VPS:
#   cd /opt/nep-erp
#   bash scripts/deploy/vps-restore-db-and-update.sh nep_erp_live_upload.dump
#
# This script:
#   1. Backs up current live database
#   2. Restores the provided dump (clean local export with 853 real students)
#   3. git pull + vps-update.sh (migrations, rebuild)
#   4. finalize --apply --skip-seed (curriculum lock; DB already finalized)
#   5. Restarts api/web
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
DUMP_FILE="${1:-}"

if [[ -z "$DUMP_FILE" ]]; then
  echo "Usage: bash scripts/deploy/vps-restore-db-and-update.sh <dump-file.dump>" >&2
  exit 1
fi

if [[ ! -f "$DUMP_FILE" ]]; then
  if [[ -f "$APP_DIR/$DUMP_FILE" ]]; then
    DUMP_FILE="$APP_DIR/$DUMP_FILE"
  else
    echo "Dump not found: $DUMP_FILE" >&2
    exit 1
  fi
fi

cd "$APP_DIR"
COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

if [[ ! -f .env ]]; then
  echo "Missing $APP_DIR/.env" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

BACKUP_NAME="backup_before_restore_$(date +%Y%m%d_%H%M%S).dump"
echo "=== [1/6] Backup current live database → $BACKUP_NAME ==="
"${COMPOSE[@]}" up -d postgres
for i in $(seq 1 60); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U "${POSTGRES_USER:-nep}" -d "${POSTGRES_DB:-nep_erp}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
"${COMPOSE[@]}" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-nep}" -Fc "${POSTGRES_DB:-nep_erp}" >"$BACKUP_NAME"
echo "Saved: $APP_DIR/$BACKUP_NAME"

echo
echo "=== [2/6] Restore database from $(basename "$DUMP_FILE") ==="
docker cp "$DUMP_FILE" "$("${COMPOSE[@]}" ps -q postgres):/tmp/restore.dump"
"${COMPOSE[@]}" exec -T postgres bash -c "
  set -e
  dropdb -U ${POSTGRES_USER:-nep} --if-exists ${POSTGRES_DB:-nep_erp}
  createdb -U ${POSTGRES_USER:-nep} ${POSTGRES_DB:-nep_erp}
  pg_restore -U ${POSTGRES_USER:-nep} -d ${POSTGRES_DB:-nep_erp} --no-owner --no-acl /tmp/restore.dump
  rm -f /tmp/restore.dump
"
echo "Restore complete."

echo
echo "=== [3/6] Pull latest code and rebuild (vps-update.sh) ==="
bash scripts/deploy/vps-update.sh

echo
echo "=== [4/6] Finalize curriculum lock (skip seed — data already clean) ==="
TENANT="${TENANT:-demo}" bash scripts/deploy/vps-curriculum-update.sh --skip-seed

echo
echo "=== [5/6] Restart API and web ==="
"${COMPOSE[@]}" up -d api web nginx

echo
echo "=== [6/6] Health check ==="
HOST="${NEXT_PUBLIC_LOGIN_HOST:-erp.donboscocollege.ac.in}"
curl -sf "https://${HOST}/api/health/ready" | head -c 400 || curl -sf "http://localhost/api/health/ready" | head -c 400
echo
echo
echo "=== Live upload complete ==="
echo "Verify: https://${HOST}/login"
echo "  • Student Records — 853 real students, no DEMO-S3-*"
echo "  • Course Catalog — Sem 4 has no MINOR; GAR-303 only INTERNSHIP on BA-GAR"
echo "  • Academic Engine → Major–Minor combinations"
