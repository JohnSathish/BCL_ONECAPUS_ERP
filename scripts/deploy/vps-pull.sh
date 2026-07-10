#!/usr/bin/env bash
# Safe git pull on VPS — discards local nginx.conf edits (SSL config is reapplied by vps-update.sh).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

# Files commonly dirtied on the VPS during prior deploys / hotfixes.
# SSL nginx.conf is restored by vps-update.sh after pull.
DIRTY_OK=(
  nginx/nginx.conf
  scripts/deploy/vps-update.sh
  scripts/deploy/vps-pull.sh
)

for f in "${DIRTY_OK[@]}"; do
  if [[ -n "$(git status --porcelain -- "$f" 2>/dev/null)" ]]; then
    echo "Resetting local $f (tracked deploy file; restored from origin)…"
    git checkout -- "$f"
  fi
done

git pull origin master
echo "At commit: $(git log -1 --oneline)"
