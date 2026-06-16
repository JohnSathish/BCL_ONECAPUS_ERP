#!/usr/bin/env node
/**
 * Backup smoke test — run inside Docker after API + worker + postgres are up.
 *
 * Usage (from repo root):
 *   docker compose exec api node scripts/backup-smoke-test.mjs
 *
 * Or locally with DATABASE_URL and REDIS_URL set:
 *   node scripts/backup-smoke-test.mjs
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const API = process.env.SMOKE_API_URL ?? 'http://127.0.0.1:3001/api';
const TENANT = process.env.SMOKE_TENANT ?? 'demo';
const EMAIL = process.env.SMOKE_EMAIL ?? 'admin@demo.edu';
const PASSWORD = process.env.SMOKE_PASSWORD ?? 'Admin@123';

async function login() {
  const res = await fetch(`${API}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': TENANT },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data?.accessToken ?? json.accessToken;
}

async function api(token, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-Slug': TENANT,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json.data ?? json;
}

async function waitForRun(token, runId, timeoutMs = 120_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const run = await api(token, 'GET', `/v1/admin/backups/runs/${runId}`);
    if (run.status === 'SUCCESS') return run;
    if (run.status === 'FAILED') throw new Error(`Backup failed: ${run.errorMessage}`);
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error('Backup timed out');
}

async function main() {
  console.log('Backup smoke test starting…');
  const token = await login();
  console.log('Logged in');

  const run = await api(token, 'POST', '/v1/admin/backups/run', {
    type: 'DATABASE_ONLY',
  });
  console.log('Queued backup run', run.id);

  const completed = await waitForRun(token, run.id);
  console.log('Backup completed', completed.sizeBytes, 'bytes');

  const verify = await api(token, 'POST', `/v1/admin/backups/runs/${run.id}/verify`);
  console.log('Verify result', verify.allOk ? 'OK' : verify);

  const dash = await api(token, 'GET', '/v1/admin/backups/dashboard');
  console.log('Dashboard totalBackups', dash.totalBackups);

  console.log('Backup smoke test passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
