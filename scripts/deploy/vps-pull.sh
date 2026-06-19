#!/usr/bin/env bash
# Safe git pull on VPS — discards local nginx.conf edits (SSL copy is reapplied by vps-update.sh).
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

if [[ -n "$(git status --porcelain nginx/nginx.conf 2>/dev/null)" ]]; then
  echo "Resetting local nginx/nginx.conf (SSL config is restored on deploy)…"
  git checkout -- nginx/nginx.conf
fi

git pull origin master
echo "At commit: $(git log -1 --oneline)"
