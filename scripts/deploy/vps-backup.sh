#!/usr/bin/env bash
# Snapshot critical VPS settings + DB for Don Bosco / OneCampus ERP.
#
# Run on VPS:
#   bash scripts/deploy/vps-backup.sh
#   bash scripts/deploy/vps-backup.sh --with-storage
#   RETENTION_DAYS=14 bash scripts/deploy/vps-backup.sh
#
# Optional weekly cron (as root):
#   0 3 * * 0 /opt/nep-erp/scripts/deploy/vps-backup.sh >> /var/log/nep-erp-backup.log 2>&1
#
# Copy off-box when done, e.g. from your PC:
#   scp -r root@YOUR_VPS_IP:/root/nep-erp-backups ./nep-erp-backups
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
BACKUP_ROOT="${BACKUP_ROOT:-/root/nep-erp-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-28}"
LETSENCRYPT_DIR="${LETSENCRYPT_DIR:-/etc/letsencrypt}"
WITH_STORAGE=0

usage() {
  cat <<'EOF'
Usage: bash scripts/deploy/vps-backup.sh [options]

Options:
  --with-storage   Also tar apps/api/storage (can be large)
  --help           Show this help

Env:
  APP_DIR          App root (default: /opt/nep-erp)
  BACKUP_ROOT      Backup parent dir (default: /root/nep-erp-backups)
  RETENTION_DAYS   Delete backups older than N days (default: 28)
  LETSENCRYPT_DIR  Certbot live root (default: /etc/letsencrypt)
EOF
}

for arg in "$@"; do
  case "$arg" in
    --with-storage) WITH_STORAGE=1 ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      usage >&2
      exit 1
      ;;
  esac
done

cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

STAMP="$(date +%Y%m%d-%H%M%S)"
DIR="${BACKUP_ROOT}/${STAMP}"
mkdir -p "$DIR"
chmod 700 "$BACKUP_ROOT" 2>/dev/null || true
chmod 700 "$DIR"

echo "=== NEP ERP — VPS backup ==="
echo "Time:    $(date -Is)"
echo "App:     $APP_DIR"
echo "Output:  $DIR"
echo "Commit:  $(git -C "$APP_DIR" log -1 --oneline 2>/dev/null || echo 'n/a')"
echo

# --- .env (secrets; keep mode private) ---
if [[ -f .env ]]; then
  install -m 600 .env "$DIR/env"
  echo "[ok] .env"
else
  echo "[skip] .env missing" >&2
fi

# --- nginx templates + active conf ---
mkdir -p "$DIR/nginx"
for f in nginx.conf nginx.combined-dbc.ssl.conf nginx.ssl.conf; do
  if [[ -f "nginx/$f" ]]; then
    cp -a "nginx/$f" "$DIR/nginx/"
  fi
done
echo "[ok] nginx configs"

# Note whether live conf is SSL-capable (detects HTTP-only wipe)
if grep -qE '^\s*listen\s+443\s+ssl' nginx/nginx.conf 2>/dev/null; then
  echo "[ok] nginx.conf has listen 443 ssl"
else
  echo "[WARN] nginx.conf has NO listen 443 ssl — restore from nginx.combined-dbc.ssl.conf after deploy" >&2
fi

# --- Let's Encrypt ---
if [[ -d "$LETSENCRYPT_DIR" ]]; then
  tar -C "$(dirname "$LETSENCRYPT_DIR")" -czf "$DIR/letsencrypt.tgz" "$(basename "$LETSENCRYPT_DIR")"
  chmod 600 "$DIR/letsencrypt.tgz"
  echo "[ok] letsencrypt → letsencrypt.tgz"
else
  echo "[skip] $LETSENCRYPT_DIR not found" >&2
fi

# --- Postgres dump (custom format) ---
POSTGRES_USER="${POSTGRES_USER:-nep}"
POSTGRES_DB="${POSTGRES_DB:-nep_erp}"
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if "${COMPOSE[@]}" ps --status running -q postgres 2>/dev/null | grep -q .; then
  "${COMPOSE[@]}" exec -T postgres \
    pg_dump -U "${POSTGRES_USER}" -Fc "${POSTGRES_DB}" >"$DIR/nep_erp.dump"
  chmod 600 "$DIR/nep_erp.dump"
  echo "[ok] postgres ${POSTGRES_DB} → nep_erp.dump ($(du -h "$DIR/nep_erp.dump" | awk '{print $1}'))"
else
  echo "[skip] postgres container not running" >&2
fi

# --- Optional API storage ---
if [[ "$WITH_STORAGE" -eq 1 ]]; then
  if [[ -d apps/api/storage ]]; then
    tar -C "$APP_DIR" -czf "$DIR/api-storage.tgz" apps/api/storage
    chmod 600 "$DIR/api-storage.tgz"
    echo "[ok] apps/api/storage → api-storage.tgz ($(du -h "$DIR/api-storage.tgz" | awk '{print $1}'))"
  else
    echo "[skip] apps/api/storage missing" >&2
  fi
else
  echo "[skip] storage (pass --with-storage to include)"
fi

# --- Manifest ---
{
  echo "stamp=$STAMP"
  echo "host=$(hostname -f 2>/dev/null || hostname)"
  echo "app_dir=$APP_DIR"
  echo "git=$(git -C "$APP_DIR" rev-parse HEAD 2>/dev/null || echo unknown)"
  echo "with_storage=$WITH_STORAGE"
  echo "created=$(date -Is)"
  ls -la "$DIR"
} >"$DIR/MANIFEST.txt"
chmod 600 "$DIR/MANIFEST.txt"

chmod -R go-rwx "$DIR"

# --- Retention ---
if [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] && [[ "$RETENTION_DAYS" -gt 0 ]]; then
  echo
  echo "Pruning backups in $BACKUP_ROOT older than ${RETENTION_DAYS} days…"
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+${RETENTION_DAYS}" -print -exec rm -rf {} + 2>/dev/null || true
fi

echo
echo "=== Backup complete ==="
du -sh "$DIR"
echo "Off-box copy example:"
echo "  scp -r root@$(hostname -I 2>/dev/null | awk '{print $1}'):$DIR ./nep-erp-backups/"
echo
echo "After git pull / deploy, restore SSL nginx if needed:"
echo "  cp nginx/nginx.combined-dbc.ssl.conf nginx/nginx.conf"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db up -d --force-recreate --no-deps nginx"
