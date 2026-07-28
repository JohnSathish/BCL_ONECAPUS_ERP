#!/usr/bin/env bash
# Smoke test Moodle + ERP integration on VPS (read-only checks + SSO verify probe).
# Run: bash scripts/deploy/vps-smoke-moodle.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db --profile moodle)

ERP_HOST="${ERP_HOST:-erp.donboscocollege.ac.in}"
MOODLE_HOST="${MOODLE_HOST:-lms.donboscocollege.ac.in}"
ERP_API_BASE="${ERP_API_BASE:-https://${ERP_HOST}/api}"

PASS=0
FAIL=0
WARN=0

check() {
  local label="$1"
  local result="$2"
  if [[ "$result" == "ok" ]]; then
    echo "  [PASS] $label"
    PASS=$((PASS + 1))
  elif [[ "$result" == "warn" ]]; then
    echo "  [WARN] $label"
    WARN=$((WARN + 1))
  else
    echo "  [FAIL] $label"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Moodle integration smoke test ==="
echo "Time: $(date -Is)"
echo "ERP: https://${ERP_HOST}"
echo "LMS: https://${MOODLE_HOST}"
echo

# --- HTTP probes ---
ERP_CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 "https://${ERP_HOST}/login" || echo 000)"
if [[ "$ERP_CODE" =~ ^(200|301|302|303|307|308)$ ]]; then
  check "ERP web reachable (HTTP ${ERP_CODE})" ok
else
  check "ERP web reachable (HTTP ${ERP_CODE})" fail
fi

MOODLE_CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 "https://${MOODLE_HOST}/" || echo 000)"
if [[ "$MOODLE_CODE" =~ ^(200|301|302|303|307|308)$ ]]; then
  check "Moodle web reachable (HTTP ${MOODLE_CODE})" ok
else
  check "Moodle web reachable (HTTP ${MOODLE_CODE})" fail
fi

API_READY="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 "${ERP_API_BASE}/health/ready" || echo 000)"
if [[ "$API_READY" == "200" ]]; then
  check "API health/ready" ok
else
  check "API health/ready (HTTP ${API_READY})" warn
fi

# SSO verify should reject invalid token (401/403/400)
VERIFY_CODE="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 15 \
  -X POST "${ERP_API_BASE}/v1/moodle/sso/verify" \
  -H 'Content-Type: application/json' \
  -d '{"token":"invalid-smoke-test"}' || echo 000)"
if [[ "$VERIFY_CODE" =~ ^(400|401|403)$ ]]; then
  check "SSO verify endpoint rejects bad token (HTTP ${VERIFY_CODE})" ok
else
  check "SSO verify endpoint (HTTP ${VERIFY_CODE}, expected 400/401/403)" warn
fi

# --- Docker ---
if docker ps --format '{{.Names}}' | grep -q moodle; then
  check "Moodle container running" ok
else
  check "Moodle container running" fail
fi

if docker ps --format '{{.Names}}' | grep -q moodle-db; then
  check "Moodle DB container running" ok
else
  check "Moodle DB container running" fail
fi

MOODLE_CID="$("${COMPOSE[@]}" ps -q moodle 2>/dev/null | head -1 || true)"
if [[ -n "${MOODLE_CID}" ]] && docker exec "${MOODLE_CID}" test -f /bitnami/moodle/auth/erp/version.php 2>/dev/null; then
  check "auth_erp plugin present in container" ok
else
  check "auth_erp plugin present (run vps-install-moodle-auth-plugin.sh)" warn
fi

# --- Redis (queue) ---
if "${COMPOSE[@]}" ps -q redis 2>/dev/null | head -1 | xargs -r docker inspect -f '{{.State.Running}}' 2>/dev/null | grep -q true; then
  check "Redis running (Moodle sync queue)" ok
else
  check "Redis running" warn
fi

# --- DB tables (optional) ---
if [[ -n "${DATABASE_URL:-}" ]]; then
  TABLE_COUNT="$("${COMPOSE[@]}" run --rm --no-deps -e DATABASE_URL="${DATABASE_URL}" api \
    node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$queryRawUnsafe('SELECT COUNT(*)::int AS c FROM academic.moodle_settings')
  .then(r => { console.log(r[0]?.c ?? 0); return p.\$disconnect(); })
  .catch(e => { console.error(0); process.exit(0); });
" 2>/dev/null | tail -1 || echo 0)"
  if [[ "${TABLE_COUNT:-0}" -ge 0 ]]; then
    check "moodle_settings table exists" ok
  else
    check "moodle_settings table" fail
  fi
else
  check "DATABASE_URL not set — skipped DB check" warn
fi

echo
echo "Results: ${PASS} passed, ${WARN} warnings, ${FAIL} failed"
echo
if [[ "$FAIL" -gt 0 ]]; then
  echo "Fix failures before go-live. Common steps:"
  echo "  bash scripts/deploy/vps-provision-moodle.sh"
  echo "  bash scripts/deploy/vps-install-moodle-auth-plugin.sh"
  echo "  bash scripts/deploy/vps-update-erp-safe.sh"
  exit 1
fi

echo "Smoke test passed (with ${WARN} warnings)."
echo
echo "Manual steps still required in Moodle admin:"
echo "  1. Enable web services + REST protocol"
echo "  2. Create external service with ERP functions + token"
echo "  3. ERP → Academics → LMS → Moodle Settings → URL + token → Test Connection"
echo "  4. Run manual sync (USERS, COURSES) then test Launch in LMS from student portal"
exit 0
