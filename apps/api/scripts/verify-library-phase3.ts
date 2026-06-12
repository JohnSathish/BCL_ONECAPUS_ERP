/**
 * Smart Library Phase 3 — QR entry, self check-in, zones, search, notifications.
 *
 *   npm run verify:library-phase3 -w api
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
  const session = unwrap<{ accessToken: string }>(await res.json());
  return session.accessToken;
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
  console.log('\n=== Smart Library Phase 3 Verification ===\n');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  if (!tenant) {
    log('fail', 'tenant', 'Demo tenant not found');
    process.exit(1);
  }

  let adminToken: string;
  let studentToken = '';

  try {
    adminToken = await login('admin@demo.edu', PASSWORD);
    log('pass', 'login', 'Admin login');
  } catch (e) {
    log('fail', 'login', String(e));
    process.exit(1);
  }

  const student = await prisma.student.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    include: { masterProfile: true },
  });
  if (student?.userId) {
    const user = await prisma.user.findUnique({
      where: { id: student.userId },
    });
    if (user?.email) {
      try {
        studentToken = await login(user.email, 'Student@123');
        log('pass', 'login', `Student (${user.email})`);
      } catch {
        try {
          studentToken = await login(user.email, PASSWORD);
          log('warn', 'login', 'Student with Admin@123');
        } catch {
          log('warn', 'login', 'Student login skipped');
        }
      }
    }
  }

  const zones = await apiJson<{ id: string; code: string }[]>(
    adminToken,
    'GET',
    '/v1/library/zones',
  );
  if (zones.status === 200 && (zones.data as unknown[]).length >= 1) {
    log('pass', 'zones', `Reading zones (${(zones.data as unknown[]).length})`);
  } else {
    log('fail', 'zones', `Status ${zones.status}`);
  }

  const zoneOcc = await apiJson<unknown[]>(
    adminToken,
    'GET',
    '/v1/library/zones/occupancy',
  );
  if (zoneOcc.status === 200) log('pass', 'zones', 'Zone occupancy');
  else log('fail', 'zones', `Occupancy status ${zoneOcc.status}`);

  if (studentToken && student) {
    const qr = await apiJson<{ payload: string; qrImageUrl: string }>(
      studentToken,
      'GET',
      '/v1/library/me/qr',
    );
    if (
      qr.status === 200 &&
      (qr.data as { payload: string }).payload.startsWith('LIB:')
    ) {
      log('pass', 'qr', 'Student QR pass');
      const qrScan = await apiJson<{ action: string }>(
        adminToken,
        'POST',
        '/v1/library/access/scan',
        { scanCode: (qr.data as { payload: string }).payload },
      );
      if (qrScan.status === 200 || qrScan.status === 201)
        log('pass', 'qr', 'QR scan entry/exit');
      else log('fail', 'qr', `QR scan status ${qrScan.status}`);
    } else {
      log('fail', 'qr', `QR endpoint status ${qr.status}`);
    }

    const selfIn = await apiJson<{ action: string }>(
      studentToken,
      'POST',
      '/v1/library/me/check-in',
      {},
    );
    if (selfIn.status === 200 || selfIn.status === 201)
      log('pass', 'self-checkin', 'Student self check-in');
    else
      log(
        'warn',
        'self-checkin',
        `Status ${selfIn.status} (may already be inside)`,
      );
  } else {
    log('warn', 'qr', 'Student QR tests skipped');
  }

  const search = await apiJson<{ total: number }>(
    adminToken,
    'GET',
    '/v1/library/search?q=test',
  );
  if (search.status === 200)
    log(
      'pass',
      'search',
      `Unified search (total: ${(search.data as { total: number }).total})`,
    );
  else log('fail', 'search', `Status ${search.status}`);

  const notify = await apiJson<{ checked: number; sent: number }>(
    adminToken,
    'POST',
    '/v1/library/circulation/notify-overdue',
  );
  if (notify.status === 200 || notify.status === 201) {
    log(
      'pass',
      'notifications',
      `Overdue reminders (sent: ${(notify.data as { sent: number }).sent})`,
    );
  } else {
    log('warn', 'notifications', `Notify status ${notify.status}`);
  }

  const settings = await apiJson<{
    qrEntryEnabled?: boolean;
    zonesEnabled?: boolean;
  }>(adminToken, 'GET', '/v1/library/settings');
  if (
    settings.status === 200 &&
    typeof (settings.data as { qrEntryEnabled?: boolean }).qrEntryEnabled ===
      'boolean'
  ) {
    log('pass', 'settings', 'Phase 3 settings flags present');
  } else {
    log('fail', 'settings', `Settings status ${settings.status}`);
  }

  const passed = checks.filter((c) => c.level === 'pass').length;
  const failed = checks.filter((c) => c.level === 'fail').length;
  const warned = checks.filter((c) => c.level === 'warn').length;
  console.log(
    `\n--- ${passed} passed, ${warned} warned, ${failed} failed ---\n`,
  );
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
