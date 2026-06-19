#!/usr/bin/env bash
# Test students API through nginx (same path as the browser).
# Usage on VPS:
#   SMOKE_EMAIL='admin@donboscocollege.ac.in' SMOKE_PASSWORD='your-password' bash scripts/deploy/vps-smoke-students.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

HOST="${NEXT_PUBLIC_LOGIN_HOST:-erp.donboscocollege.ac.in}"
API="https://${HOST}/api"
EMAIL="${SMOKE_EMAIL:-admin@donboscocollege.ac.in}"
PASS="${SMOKE_PASSWORD:-}"

echo "=== Students API smoke test ==="
echo "API: ${API}"
echo "Email: ${EMAIL}"
echo

echo "--- 1) nginx -> api (inside docker network) ---"
"${COMPOSE[@]}" exec -T nginx wget -qO- "http://api:3001/api/health/live" || echo "FAIL: nginx cannot reach api:3001"
echo

echo "--- 2) Public health via HTTPS ---"
curl -sf "${API}/health/ready" | head -c 300
echo
echo

if [[ -z "${PASS}" ]]; then
  echo "Set SMOKE_PASSWORD to test authenticated /v1/students (login + list)."
  echo "Example:"
  echo "  SMOKE_EMAIL='admin@donboscocollege.ac.in' SMOKE_PASSWORD='***' bash scripts/deploy/vps-smoke-students.sh"
  exit 0
fi

echo "--- 3) Login ---"
LOGIN_JSON=$(curl -sf -X POST "${API}/v1/auth/login" \
  -H "Content-Type: application/json" \
  -H "Host: ${HOST}" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASS}\"}")
TOKEN=$(echo "$LOGIN_JSON" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
if [[ -z "${TOKEN}" ]]; then
  echo "FAIL: login did not return accessToken"
  echo "$LOGIN_JSON" | head -c 400
  exit 1
fi
echo "Login OK"
echo

echo "--- 4) GET /v1/students (through nginx, same as browser) ---"
HTTP_CODE=$(curl -s -o /tmp/students-smoke.json -w "%{http_code}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Host: ${HOST}" \
  "${API}/v1/students?page=1&limit=25")
echo "HTTP status: ${HTTP_CODE}"
head -c 500 /tmp/students-smoke.json
echo
echo

echo "--- 5) API container logs (last 15 lines) ---"
"${COMPOSE[@]}" logs api --tail 15
echo
echo "=== Done ==="
