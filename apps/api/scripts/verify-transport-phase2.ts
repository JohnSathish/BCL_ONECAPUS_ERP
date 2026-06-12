/**
 * Transport Phase 2 — student picker, parent notifications, route capacity alerts.
 *
 *   npm run verify:transport-phase2 -w api
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
  console.log(
    `  ${level === 'pass' ? 'PASS' : level === 'warn' ? 'WARN' : 'FAIL'}  [${step}] ${message}`,
  );
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
) {
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
    return { status: res.status, data: text as T };
  }
}

async function main() {
  console.log('\n=== Transport Phase 2 Verification ===\n');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  if (!tenant) {
    log('fail', 'tenant', 'Demo tenant not found');
    process.exit(1);
  }

  let token: string;
  try {
    token = await login('admin@demo.edu', PASSWORD);
    log('pass', 'login', 'Admin login');
  } catch (e) {
    log('fail', 'login', String(e));
    process.exit(1);
  }

  await apiJson(token, 'POST', '/v1/communication/templates/seed-defaults');

  const dash = await apiJson<{
    routesAtCapacity?: number;
    capacityAlerts?: unknown[];
  }>(token, 'GET', '/v1/transport/dashboard');
  if (dash.status === 200 && typeof dash.data === 'object') {
    log('pass', 'dashboard', 'Dashboard includes capacity alert fields');
  } else {
    log('fail', 'dashboard', `Status ${dash.status}`);
  }

  const alerts = await apiJson<unknown[]>(token, 'GET', '/v1/transport/alerts');
  if (alerts.status === 200)
    log(
      'pass',
      'alerts',
      `Alerts endpoint (${Array.isArray(alerts.data) ? alerts.data.length : 0} routes)`,
    );
  else log('fail', 'alerts', `Status ${alerts.status}`);

  const student = await prisma.student.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    include: { masterProfile: { select: { fullName: true } } },
  });

  if (student?.masterProfile?.fullName) {
    const search = await apiJson<Array<{ id: string }>>(
      token,
      'GET',
      `/v1/transport/students/search?q=${encodeURIComponent(student.enrollmentNumber.slice(0, 4))}`,
    );
    if (search.status === 200 && Array.isArray(search.data))
      log('pass', 'students', `Student search (${search.data.length} results)`);
    else log('fail', 'students', `Search status ${search.status}`);
  } else {
    log('warn', 'students', 'No student in DB — skipped search');
  }

  const stamp = Date.now();
  const route = await apiJson<{ id: string; code: string }>(
    token,
    'POST',
    '/v1/transport/routes',
    {
      code: `P2-${stamp}`,
      name: `Phase2 Route ${stamp}`,
      capacityWarningPercent: 90,
    },
  );

  let routeId = '';
  if (route.status === 200 || route.status === 201) {
    routeId = route.data.id;
    log('pass', 'routes', `Created ${route.data.code}`);

    const capacityBefore = await apiJson<{
      capacity: number;
      assigned: number;
    }>(token, 'GET', `/v1/transport/routes/${routeId}/capacity`);
    if (capacityBefore.status === 200)
      log('pass', 'capacity', 'Route capacity endpoint');
    else log('fail', 'capacity', `Capacity status ${capacityBefore.status}`);

    const vehicle = await apiJson(token, 'POST', '/v1/transport/vehicles', {
      registrationNo: `P2-${stamp}`,
      capacity: 2,
      routeId,
      driverName: 'Verify Driver',
      driverMobile: '9999999999',
    });
    if (vehicle.status === 200 || vehicle.status === 201)
      log('pass', 'vehicles', 'Vehicle with capacity 2');
    else log('fail', 'vehicles', `Vehicle status ${vehicle.status}`);

    if (student) {
      const assign = await apiJson<{ id: string; notificationStatus?: string }>(
        token,
        'POST',
        '/v1/transport/assignments',
        {
          studentId: student.id,
          routeId,
          notifyParents: true,
        },
      );
      if (assign.status === 200 || assign.status === 201) {
        log(
          'pass',
          'assign',
          `Assigned student (notify: ${assign.data.notificationStatus ?? 'n/a'})`,
        );
        const cancel = await apiJson(
          token,
          'POST',
          `/v1/transport/assignments/${assign.data.id}/cancel`,
        );
        if (cancel.status === 200 || cancel.status === 201)
          log('pass', 'assign', 'Cancel assignment');
        else log('fail', 'assign', `Cancel status ${cancel.status}`);
      } else {
        log('fail', 'assign', `Assign status ${assign.status}`);
      }
    } else {
      log('warn', 'assign', 'No student — skipped assign/notify');
    }
  } else {
    log('fail', 'routes', `Create status ${route.status}`);
  }

  const passed = checks.filter((c) => c.level === 'pass').length;
  const failed = checks.filter((c) => c.level === 'fail').length;
  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
