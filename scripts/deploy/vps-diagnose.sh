#!/usr/bin/env bash
# Production diagnostics when users see 502 / "Upstream service is unavailable".
# Run on VPS: bash scripts/deploy/vps-diagnose.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/nep-erp}"
cd "$APP_DIR"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db)

echo "=== NEP ERP — production diagnostics ==="
echo "Time: $(date -Is)"
echo

echo "--- Container status ---"
"${COMPOSE[@]}" ps
echo

echo "--- API health (inside container) ---"
"${COMPOSE[@]}" exec -T api wget -qO- http://127.0.0.1:3001/api/health/live 2>/dev/null || echo "API live check FAILED"
echo
"${COMPOSE[@]}" exec -T api wget -qO- http://127.0.0.1:3001/api/health/ready 2>/dev/null || echo "API ready check FAILED"
echo

echo "--- Nginx -> API (from nginx container) ---"
"${COMPOSE[@]}" exec -T nginx wget -qO- http://api:3001/api/health/live 2>/dev/null || echo "nginx cannot reach api:3001"
echo

echo "--- Public health (via nginx) ---"
curl -sf "http://localhost/api/health/live" || echo "localhost /api/health/live FAILED"
echo

echo "--- API last 40 log lines ---"
"${COMPOSE[@]}" logs api --tail 40
echo

echo "--- Nginx last 20 error lines ---"
"${COMPOSE[@]}" logs nginx --tail 20 2>/dev/null || true
echo

echo "--- .env checks (redacted) ---"
if [[ -f .env ]]; then
  grep -E '^(PROCESS_BACKGROUND_JOBS|API_HOST|HOST|DATABASE_URL|REDIS_URL)=' .env \
    | sed -E 's/(PASSWORD|SECRET)=[^ ]+/\1=***REDACTED***/g' \
    || true
else
  echo "No .env file"
fi
echo

echo "=== If API is crash-looping: docker compose logs api --tail 100 ==="
echo "=== If PROCESS_BACKGROUND_JOBS=api, set PROCESS_BACKGROUND_JOBS=worker in .env ==="
