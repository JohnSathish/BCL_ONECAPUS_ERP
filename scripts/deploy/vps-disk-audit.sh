#!/usr/bin/env bash
# Audit (and optionally reclaim) disk on the DBC VPS.
# Deleting the old site folder alone often frees little — Docker images,
# build cache, dumps, and volumes usually hold most of the space.
#
# Usage (Hostinger Terminal / SSH as root):
#   cd /opt/nep-erp && git pull origin master
#   bash scripts/deploy/vps-disk-audit.sh
#   bash scripts/deploy/vps-disk-audit.sh --cleanup   # safe reclaim (no volume wipe)
#
set -euo pipefail

CLEANUP=0
for arg in "$@"; do
  case "$arg" in
    --cleanup) CLEANUP=1 ;;
    --help|-h)
      sed -n '1,12p' "$0"
      exit 0
      ;;
  esac
done

hr() { echo; echo "=== $* ==="; }

hr "Filesystem overview"
df -hT /
df -hT /var/lib/docker 2>/dev/null || true

hr "Top-level disk use (/)"
du -xh --max-depth=1 / 2>/dev/null | sort -hr | head -20

hr "Likely app / panel roots"
for path in \
  /opt \
  /var \
  /home \
  /usr \
  /root \
  /tmp \
  /var/lib/docker \
  /var/lib/containerd \
  /var/log \
  /opt/nep-erp \
  /opt/donboscocollege \
  /usr/local/lsws \
  /home/cyberpanel \
  /usr/local/CyberCP
do
  if [[ -e "$path" ]]; then
    du -sh "$path" 2>/dev/null || true
  else
    echo "(absent) $path"
  fi
done

hr "Inside /opt (detail)"
if [[ -d /opt ]]; then
  du -xh --max-depth=2 /opt 2>/dev/null | sort -hr | head -40
fi

hr "Old college site leftovers"
if [[ -d /opt/donboscocollege ]]; then
  echo "STILL PRESENT: /opt/donboscocollege"
  du -sh /opt/donboscocollege 2>/dev/null || true
else
  echo "OK: /opt/donboscocollege already gone"
fi
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Size}}\t{{.Image}}' 2>/dev/null | grep -Ei 'donbosco|legacy|college|nep|NAME' || true
docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.ID}}' 2>/dev/null | grep -Ei 'dbc-legacy|donbosco|nep-erp|college|REPOSITORY' || true

hr "Docker disk summary"
if command -v docker >/dev/null 2>&1; then
  docker system df -v 2>/dev/null | head -120 || docker system df
else
  echo "docker not installed"
fi

hr "Large files under /opt and /root (>=200M)"
find /opt /root /var/tmp /tmp -xdev -type f -size +200M 2>/dev/null \
  | head -80 \
  | while read -r f; do du -h "$f"; done \
  | sort -hr \
  | head -40 || true

hr "Postgres / Redis / storage volumes (compose)"
if [[ -d /opt/nep-erp ]]; then
  du -sh /opt/nep-erp/apps/api/storage 2>/dev/null || true
  du -xh --max-depth=2 /opt/nep-erp/apps/api/storage 2>/dev/null | sort -hr | head -20 || true
  find /opt/nep-erp -maxdepth 3 -type f \( -name '*.dump' -o -name '*.sql.gz' -o -name '*.tar.gz' -o -name '*.zip' \) 2>/dev/null \
    | while read -r f; do du -h "$f"; done \
    | sort -hr \
    | head -30 || true
fi

hr "Journal / log pressure"
journalctl --disk-usage 2>/dev/null || true
du -sh /var/log 2>/dev/null || true
du -xh --max-depth=1 /var/log 2>/dev/null | sort -hr | head -15 || true

hr "Memory snapshot (Hostinger also showed ~94%)"
free -h
echo
ps aux --sort=-%mem | head -12

if [[ "$CLEANUP" -eq 1 ]]; then
  hr "CLEANUP (safe): prune unused Docker data + trim journals"
  echo "Removing stopped legacy college containers if present…"
  docker rm -f donboscocollege-web-legacy 2>/dev/null || true
  docker rmi dbc-legacy-apex:pre-cutover 2>/dev/null || true

  echo "Docker builder + unused images/containers/networks (NOT volumes)…"
  docker builder prune -af || true
  docker image prune -af || true
  docker container prune -f || true
  docker network prune -f || true
  # Do NOT run volume prune by default — that can wipe Postgres data.
  docker system prune -f || true

  echo "Vacuum journal to 200M…"
  journalctl --vacuum-size=200M 2>/dev/null || true

  if [[ -d /opt/donboscocollege ]]; then
    echo "Deleting leftover old site /opt/donboscocollege…"
    du -sh /opt/donboscocollege || true
    rm -rf /opt/donboscocollege
  fi

  echo
  echo "After cleanup:"
  df -h /
  docker system df 2>/dev/null || true
  free -h
else
  hr "Next step"
  echo "Review the sizes above. Typical space hogs after deleting the old site:"
  echo "  1) Docker images + build cache (/var/lib/docker) — often 20–80GB"
  echo "  2) Legacy image dbc-legacy-apex:pre-cutover from cutover"
  echo "  3) DB dumps under /opt/nep-erp (*.dump)"
  echo "  4) /opt/nep-erp/apps/api/storage uploads"
  echo "  5) Old /opt/donboscocollege if --delete-old was never run"
  echo
  echo "Safe reclaim (keeps Postgres volumes):"
  echo "  bash scripts/deploy/vps-disk-audit.sh --cleanup"
fi
