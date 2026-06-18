/**
 * BCL Smart Library Phase 3 — incidents, reservation queue, due-tomorrow reminders.
 *
 *   npm run verify:smart-library-phase3 -w api
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
  console.log('\n=== BCL Smart Library Phase 3 Verification ===\n');

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

  const settings = await apiJson<{ dueTomorrowNotifyEnabled?: boolean }>(
    adminToken,
    'GET',
    '/v1/library/settings',
  );
  if (settings.status === 200) {
    log(
      'pass',
      'settings',
      `dueTomorrowNotifyEnabled=${(settings.data as { dueTomorrowNotifyEnabled?: boolean }).dueTomorrowNotifyEnabled ?? true}`,
    );
  } else {
    log('fail', 'settings', `Settings ${settings.status}`);
  }

  const incidents = await apiJson<unknown[]>(
    adminToken,
    'GET',
    '/v1/library/circulation/incidents',
  );
  if (incidents.status === 200 && Array.isArray(incidents.data)) {
    log('pass', 'incidents', `Incidents list (${incidents.data.length} rows)`);
  } else {
    log('fail', 'incidents', `Incidents list ${incidents.status}`);
  }

  const queue = await apiJson<{ bookId: string; queue: unknown[] }[]>(
    adminToken,
    'GET',
    '/v1/library/reservations/queue',
  );
  if (queue.status === 200 && Array.isArray(queue.data)) {
    log(
      'pass',
      'queue',
      `Reservation queue (${queue.data.length} title groups)`,
    );
  } else {
    log('fail', 'queue', `Reservation queue ${queue.status}`);
  }

  const reservations = await apiJson<unknown[]>(
    adminToken,
    'GET',
    '/v1/library/reservations',
  );
  if (reservations.status === 200 && Array.isArray(reservations.data)) {
    log(
      'pass',
      'reservations',
      `Active reservations (${reservations.data.length})`,
    );
  } else {
    log('fail', 'reservations', `Reservations ${reservations.status}`);
  }

  const dueTomorrow = await apiJson<{
    sent: number;
    checked: number;
    skipped?: boolean;
  }>(adminToken, 'POST', '/v1/library/circulation/notify-due-tomorrow');
  if (dueTomorrow.status === 200 || dueTomorrow.status === 201) {
    const d = dueTomorrow.data as {
      sent: number;
      checked: number;
      skipped?: boolean;
    };
    log(
      'pass',
      'due-tomorrow',
      d.skipped
        ? 'Due-tomorrow job skipped (disabled)'
        : `Due-tomorrow sent=${d.sent} checked=${d.checked}`,
    );
  } else {
    log('fail', 'due-tomorrow', `Notify due-tomorrow ${dueTomorrow.status}`);
  }

  const tableExists = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'library' AND table_name = 'library_copy_incidents'
    ) AS exists
  `;
  if (tableExists[0]?.exists) {
    log('pass', 'schema', 'library_copy_incidents table present');
  } else {
    log('fail', 'schema', 'library_copy_incidents table missing');
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
