#!/bin/sh
set -e

mkdir -p /data/uploads /data/storage /data/backups

# Restore homepage CMS images into the mounted volumes. Git pull does not
# include runtime storage, so these files 404 after a volume wipe unless we
# copy them from the image (apps/api/assets/website-public).
BUNDLED="/app/apps/api/assets/website-public"
seed_missing() {
  src_root="$1"
  dest_root="$2"
  if [ ! -d "$src_root" ]; then
    return 0
  fi
  find "$src_root" -type f | while IFS= read -r src; do
    rel="${src#$src_root/}"
    dest="$dest_root/$rel"
    if [ ! -f "$dest" ]; then
      mkdir -p "$(dirname "$dest")"
      cp "$src" "$dest"
    fi
  done
}
seed_missing "$BUNDLED" /data/uploads/website
seed_missing "$BUNDLED" /data/storage/website
seed_missing /data/storage/website /data/uploads/website

# Ensure the non-root app user can write to mounted volumes.
if [ "$(id -u)" = "0" ]; then
  chown -R nestjs:nodejs /data/uploads /data/storage /data/backups 2>/dev/null || true
  exec su-exec nestjs "$@"
fi

exec "$@"
