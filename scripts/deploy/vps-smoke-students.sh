#!/usr/bin/env bash
# Test students API — direct to Nest and through nginx (same path as browser).
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
PUBLIC_API="https://${HOST}/api"
EMAIL="${SMOKE_EMAIL:-admin@donboscocollege.ac.in}"
PASS="${SMOKE_PASSWORD:-}"

echo "=== Students API smoke test ==="
echo "Host: ${HOST}"
echo "Email: ${EMAIL}"
echo

echo "--- 1) nginx -> api (docker network) ---"
"${COMPOSE[@]}" exec -T nginx wget -qO- "http://api:3001/api/health/live" || echo "FAIL: nginx cannot reach api:3001"
echo

echo "--- 2) Public health via HTTPS ---"
curl -sf "${PUBLIC_API}/health/ready" | head -c 300
echo
echo

if [[ -z "${PASS}" ]]; then
  echo "Set SMOKE_PASSWORD to test login + /v1/students."
  echo "  SMOKE_EMAIL='admin@donboscocollege.ac.in' SMOKE_PASSWORD='***' bash scripts/deploy/vps-smoke-students.sh"
  exit 0
fi

echo "--- 3) DB password check (bypasses HTTP) ---"
"${COMPOSE[@]}" run --rm -e VERIFY_EMAIL="${EMAIL}" -e VERIFY_PASSWORD="${PASS}" api \
  npx tsx scripts/verify-admin-login.ts || true
echo

echo "--- 4) Login + students (public HTTPS first, then direct API) ---"
"${COMPOSE[@]}" exec -T \
  -e SMOKE_HOST="${HOST}" \
  -e SMOKE_EMAIL="${EMAIL}" \
  -e SMOKE_PASSWORD="${PASS}" \
  -e PUBLIC_API="${PUBLIC_API}" \
  api node <<'NODE'
const host = process.env.SMOKE_HOST;
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const publicApi = process.env.PUBLIC_API;
const localApi = 'http://127.0.0.1:3001/api';

function tenantHeaders() {
  // Node fetch to 127.0.0.1 ignores Host — use X-Login-Host (API supports this).
  return {
    'X-Login-Host': host,
    'X-Tenant-Slug': 'demo',
    Accept: 'application/json',
  };
}

function unwrap(json) {
  if (json && typeof json === 'object' && json.success === true && 'data' in json) {
    return json.data;
  }
  return json;
}

function solveExpression(expression) {
  const normalized = String(expression).replace(/×/g, '*').replace(/÷/g, '/');
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${normalized});`)();
}

async function login(apiBase, label) {
  const challengeRes = await fetch(`${apiBase}/v1/auth/challenge`, {
    headers: tenantHeaders(),
  });
  const challengeBody = unwrap(await challengeRes.json());
  if (!challengeRes.ok || !challengeBody?.token) {
    throw new Error(`${label} challenge failed: HTTP ${challengeRes.status}`);
  }
  const answer = solveExpression(challengeBody.expression);
  const loginRes = await fetch(`${apiBase}/v1/auth/login`, {
    method: 'POST',
    headers: {
      ...tenantHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: String(email).trim().toLowerCase(),
      password,
      challengeToken: challengeBody.token,
      challengeAnswer: answer,
    }),
  });
  const loginBody = unwrap(await loginRes.json());
  if (!loginRes.ok || !loginBody?.accessToken) {
    const detail = JSON.stringify(loginBody).slice(0, 240);
    if (loginRes.status === 401) {
      console.error(
        `${label} login failed: invalid email/password for ${email} on tenant host ${host}.`,
      );
      console.error(
        'Run: ADMIN_PASSWORD="..." bash scripts/deploy/vps-reset-admin.sh',
      );
      console.error(
        'Or try demo: SMOKE_EMAIL=admin@demo.edu SMOKE_PASSWORD=Admin@123 bash scripts/deploy/vps-smoke-students.sh',
      );
    }
    throw new Error(`${label} login failed: HTTP ${loginRes.status} ${detail}`);
  }
  console.log(`${label} login OK`);
  return loginBody.accessToken;
}

async function students(apiBase, label, token) {
  const res = await fetch(`${apiBase}/v1/students?page=1&limit=25`, {
    headers: {
      ...tenantHeaders(),
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await res.text();
  console.log(`${label} GET /v1/students -> HTTP ${res.status}`);
  console.log(text.slice(0, 400));
  if (!res.ok) process.exitCode = 1;
}

(async () => {
  let failed = false;
  try {
    const publicToken = await login(publicApi, 'public-nginx');
    await students(publicApi, 'public-nginx', publicToken);
  } catch (err) {
    failed = true;
    console.error(err);
  }
  try {
    const token = await login(localApi, 'direct-api');
    await students(localApi, 'direct-api', token);
  } catch (err) {
    failed = true;
    console.error(err);
  }
  if (failed) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
NODE

echo
echo "--- 5) API logs (last 20 lines) ---"
"${COMPOSE[@]}" logs api --tail 20
echo
echo "=== Done ==="
