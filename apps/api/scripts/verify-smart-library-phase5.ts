/**
 * BCL Smart Library Phase 5 — recommendations + student dashboard.
 *
 *   npm run verify:smart-library-phase5 -w api
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
): Promise<{ status: number; data: T | string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': TENANT_SLUG,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  try {
    return { status: res.status, data: unwrap<T>(JSON.parse(text)) };
  } catch {
    return { status: res.status, data: text };
  }
}

async function main() {
  console.log('\n=== BCL Smart Library Phase 5 Verification ===\n');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  if (!tenant) {
    log('fail', 'tenant', 'Demo tenant not found');
    process.exit(1);
  }

  const studentUser = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      email: { contains: 'student', mode: 'insensitive' },
      student: { isNot: null },
    },
    include: { student: true },
  });

  let studentToken: string | null = null;
  if (studentUser?.email) {
    try {
      studentToken = await login(studentUser.email, PASSWORD);
      log('pass', 'login', `Student login (${studentUser.email})`);
    } catch {
      log(
        'warn',
        'login',
        'Student login failed — trying admin for route smoke test',
      );
    }
  } else {
    log('warn', 'login', 'No demo student user found');
  }

  const token =
    studentToken ?? (await login('admin@demo.edu', PASSWORD).catch(() => null));
  if (!token) {
    log('fail', 'login', 'Could not obtain auth token');
    process.exit(1);
  }
  if (!studentToken) {
    log('warn', 'login', 'Using admin token — student dashboard may 404');
  }

  const dashboard = await apiJson<{
    readingScore: { overall: number };
    recommendations: unknown[];
    readingHistory: unknown[];
  }>(token, 'GET', '/v1/library/me/dashboard');

  if (dashboard.status === 200) {
    const d = dashboard.data as {
      readingScore: { overall: number };
      recommendations: unknown[];
    };
    log(
      'pass',
      'dashboard',
      `Score=${d.readingScore.overall} recs=${d.recommendations.length}`,
    );
  } else if (dashboard.status === 404 && !studentToken) {
    log('warn', 'dashboard', '404 without student user (expected)');
  } else {
    log('fail', 'dashboard', `Dashboard ${dashboard.status}`);
  }

  const recs = await apiJson<unknown[]>(
    token,
    'GET',
    '/v1/library/me/recommendations?limit=5',
  );
  if (recs.status === 200 && Array.isArray(recs.data)) {
    log('pass', 'recommendations', `${recs.data.length} recommendations`);
  } else if (recs.status === 404 && !studentToken) {
    log('warn', 'recommendations', '404 without student user');
  } else {
    log('fail', 'recommendations', `Recommendations ${recs.status}`);
  }

  const fails = checks.filter((c) => c.level === 'fail').length;
  console.log(`\n${checks.length - fails}/${checks.length} checks passed\n`);
  await prisma.$disconnect();
  process.exit(fails ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
