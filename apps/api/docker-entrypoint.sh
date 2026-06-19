#!/bin/sh
set -e

mkdir -p /data/uploads /data/storage /data/backups

# Ensure the non-root app user can write to mounted volumes.
if [ "$(id -u)" = "0" ]; then
  chown -R nestjs:nodejs /data/uploads /data/storage /data/backups 2>/dev/null || true
  exec su-exec nestjs "$@"
fi

exec "$@"
