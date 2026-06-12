/**
 * Front Office Phase 2 — admissions link, printable gate pass QR, kiosk scan.
 *
 *   npm run verify:front-office-phase2 -w api
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
  console.log('\n=== Front Office Phase 2 Verification ===\n');

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

  const dash = await apiJson<{
    pendingAdmissions?: number;
    admissionsHref?: string;
  }>(token, 'GET', '/v1/front-office/dashboard');
  if (dash.status === 200 && typeof dash.data === 'object') {
    log('pass', 'dashboard', 'Dashboard includes admissions fields');
  } else {
    log('fail', 'dashboard', `Status ${dash.status}`);
  }

  const admissions = await apiJson<{
    pendingReview: number;
    recentApplications: unknown[];
  }>(token, 'GET', '/v1/front-office/admissions/desk-summary');
  if (admissions.status === 200) {
    log(
      'pass',
      'admissions',
      `Desk summary — ${admissions.data.pendingReview} pending`,
    );
  } else {
    log('fail', 'admissions', `Desk summary status ${admissions.status}`);
  }

  const stamp = Date.now();
  const pass = await apiJson<{
    id: string;
    passNumber: string;
    scanCode: string;
    qrImageUrl: string;
    scanPayload: string;
  }>(token, 'POST', '/v1/front-office/gate-passes', {
    visitorName: `Phase2 Visitor ${stamp}`,
    mobile: '9123456789',
    hostName: 'Reception',
    purpose: 'Phase 2 verify',
  });

  let passId = '';
  let scanPayload = '';
  if (pass.status === 200 || pass.status === 201) {
    passId = pass.data.id;
    scanPayload = pass.data.scanPayload;
    if (pass.data.scanCode && pass.data.qrImageUrl?.includes('qrserver')) {
      log('pass', 'gate-pass', `Issued with scanCode ${pass.data.scanCode}`);
    } else {
      log('fail', 'gate-pass', 'Missing scanCode or qrImageUrl');
    }

    const print = await apiJson<{ qrImageUrl: string }>(
      token,
      'GET',
      `/v1/front-office/gate-passes/${passId}/print`,
    );
    if (print.status === 200 && print.data.qrImageUrl)
      log('pass', 'gate-pass', 'Print label endpoint');
    else log('fail', 'gate-pass', `Print status ${print.status}`);

    const kioskStatus = await apiJson<{ visitorsInside: number }>(
      token,
      'GET',
      '/v1/front-office/kiosk/status',
    );
    if (kioskStatus.status === 200) log('pass', 'kiosk', 'Kiosk status');
    else log('fail', 'kiosk', `Status endpoint ${kioskStatus.status}`);

    const scanLookup = await apiJson(
      token,
      'POST',
      '/v1/front-office/kiosk/scan',
      {
        code: scanPayload,
        autoCheckIn: false,
      },
    );
    if (scanLookup.status === 200 || scanLookup.status === 201)
      log('pass', 'kiosk', 'Scan lookup');
    else log('fail', 'kiosk', `Scan lookup ${scanLookup.status}`);

    const scanIn = await apiJson(token, 'POST', '/v1/front-office/kiosk/scan', {
      code: scanPayload,
      autoCheckIn: true,
    });
    if (scanIn.status === 200 || scanIn.status === 201)
      log('pass', 'kiosk', 'Auto check-in via scan');
    else log('fail', 'kiosk', `Auto check-in ${scanIn.status}`);

    const scanOut = await apiJson(
      token,
      'POST',
      '/v1/front-office/kiosk/scan',
      {
        code: scanPayload,
        autoCheckIn: true,
      },
    );
    if (scanOut.status === 200 || scanOut.status === 201)
      log('pass', 'kiosk', 'Auto check-out via scan');
    else log('fail', 'kiosk', `Auto check-out ${scanOut.status}`);
  } else {
    log('fail', 'gate-pass', `Create status ${pass.status}`);
  }

  const application = await prisma.admissionApplication.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (application) {
    const fromApp = await apiJson<{
      id: string;
      admissionApplicationId: string;
    }>(
      token,
      'POST',
      `/v1/front-office/enquiries/from-admission/${application.id}`,
    );
    if (fromApp.status === 200 || fromApp.status === 201) {
      log('pass', 'admissions', 'Create enquiry from application');
      const link = await apiJson(
        token,
        'POST',
        `/v1/front-office/enquiries/${fromApp.data.id}/link-admission`,
        {
          admissionApplicationId: application.id,
        },
      );
      if (link.status === 200 || link.status === 201)
        log('pass', 'admissions', 'Link enquiry to application');
      else log('fail', 'admissions', `Link status ${link.status}`);
    } else {
      log('fail', 'admissions', `From-application status ${fromApp.status}`);
    }
  } else {
    log(
      'warn',
      'admissions',
      'No admission application in DB — skipped link tests',
    );
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
