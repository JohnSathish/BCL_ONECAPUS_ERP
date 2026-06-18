/**
 * BCL Smart Library Phase 2 — reading analytics, members admin, accession workflow.
 *
 *   npm run verify:smart-library-phase2 -w api
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_SLUG = 'demo';
const PASSWORD = 'Admin@123';
const API_BASE = (
  process.argv.find((a) => a.startsWith('--api='))?.slice(6) ??
  'http://127.0.0.1:3001/api'
).replace(/\/$/, '');

type Check = { level: 'pass' | 'fail' | 'warn'; step: string; message: string };
const checks: Check[] = [];

function log(level: Check['level'], step: string, message: string) {
  checks.push({ level, step, message });
  const tag = level === 'pass' ? 'PASS' : level === 'warn' ? 'WARN' : 'FAIL';
  console.log(`  ${tag}  [${step}] ${message}`);
}

function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body)
    return (body as { data: T }).data;
  return body as T;
}

function solveChallenge(expression: string): number {
  const n = expression.replace(/×/g, '*').replace(/x/gi, '*').trim();
  const m = n.match(/^(-?\d+)\s*([+\-*])\s*(-?\d+)$/);
  if (!m) throw new Error(`Bad challenge: ${expression}`);
  const a = Number(m[1]);
  const b = Number(m[3]);
  if (m[2] === '+') return a + b;
  if (m[2] === '-') return a - b;
  return a * b;
}

async function login(email: string, password: string): Promise<string> {
  const chRes = await fetch(`${API_BASE}/v1/auth/challenge`);
  if (!chRes.ok) throw new Error(`challenge ${chRes.status}`);
  const ch = unwrap<{ token: string; expression: string }>(await chRes.json());
  const res = await fetch(`${API_BASE}/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': TENANT_SLUG,
    },
    body: JSON.stringify({
      email,
      password,
      challengeToken: ch.token,
      challengeAnswer: solveChallenge(ch.expression),
      rememberMe: false,
    }),
  });
  if (!res.ok) throw new Error(`login ${email} → ${res.status}`);
  return unwrap<{ accessToken: string }>(await res.json()).accessToken;
}

async function apiJson<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T | string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': TENANT_SLUG,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { status: res.status, data: unwrap<T>(JSON.parse(text)) };
  } catch {
    return { status: res.status, data: text };
  }
}

async function main() {
  console.log('\n=== BCL Smart Library Phase 2 Verification ===\n');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  if (!tenant) {
    log('fail', 'tenant', 'Demo tenant not found');
    process.exit(1);
  }

  let adminToken: string;
  try {
    adminToken = await login('admin@demo.edu', PASSWORD);
    log('pass', 'login', 'Admin login');
  } catch (e) {
    log('fail', 'login', String(e));
    process.exit(1);
  }

  const reading = await apiJson<{
    topBooks: unknown[];
    topReaders: unknown[];
    departmentUsage: unknown[];
  }>(adminToken, 'GET', '/v1/library/analytics/reading?days=365');
  if (
    reading.status === 200 &&
    Array.isArray((reading.data as { topBooks: unknown[] }).topBooks) &&
    Array.isArray((reading.data as { topReaders: unknown[] }).topReaders)
  ) {
    log('pass', 'analytics', 'Reading analytics endpoint');
  } else {
    log('fail', 'analytics', `Reading analytics ${reading.status}`);
  }

  const members = await apiJson<{ items: unknown[]; total: number }>(
    adminToken,
    'GET',
    '/v1/library/members?limit=10',
  );
  if (
    members.status === 200 &&
    Array.isArray((members.data as { items: unknown[] }).items)
  ) {
    log(
      'pass',
      'members',
      `Members list (${(members.data as { total: number }).total} total)`,
    );
  } else {
    log('fail', 'members', `Members list ${members.status}`);
  }

  const nextAcc = await apiJson<{ accessionNo: string }>(
    adminToken,
    'GET',
    '/v1/library/accession/next',
  );
  if (
    nextAcc.status === 200 &&
    (nextAcc.data as { accessionNo: string }).accessionNo
  ) {
    log(
      'pass',
      'accession',
      `Next accession ${(nextAcc.data as { accessionNo: string }).accessionNo}`,
    );
  } else {
    log('fail', 'accession', `Next accession ${nextAcc.status}`);
  }

  const created = await apiJson<{
    id: string;
    accessionNo: string;
    accessionStatus: string;
  }>(adminToken, 'POST', '/v1/library/books/accession', {
    title: `Phase2 Test ${Date.now()}`,
    author: 'Verifier',
    totalCopies: 1,
    accessionStatus: 'PENDING',
  });
  if (created.status === 200 || created.status === 201) {
    const book = created.data as { id: string; accessionStatus: string };
    log('pass', 'accession', `Created pending entry (${book.accessionStatus})`);

    const shelve = await apiJson(
      adminToken,
      'PATCH',
      `/v1/library/books/${book.id}/accession`,
      { accessionStatus: 'ON_SHELF', rack: 'A1', shelf: '3' },
    );
    if (shelve.status === 200) {
      log('pass', 'accession', 'Workflow advance to ON_SHELF');
    } else {
      log('fail', 'accession', `Shelve status ${shelve.status}`);
    }
  } else {
    log('fail', 'accession', `Create accession ${created.status}`);
  }

  const passed = checks.filter((c) => c.level === 'pass').length;
  const failed = checks.filter((c) => c.level === 'fail').length;
  console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
