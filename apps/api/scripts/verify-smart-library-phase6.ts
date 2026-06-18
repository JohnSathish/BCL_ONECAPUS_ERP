/**
 * BCL Smart Library Phase 6 — Knowledge Assistant + RFID/biometric CAMS hooks.
 *
 *   npm run verify:smart-library-phase6 -w api
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
  if (!chRes.ok) {
    throw new Error(
      `API not reachable at ${API_BASE} (challenge ${chRes.status}). Start the API server first.`,
    );
  }
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
  console.log('\n=== BCL Smart Library Phase 6 Verification ===\n');

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

  const prompts = await apiJson<string[]>(
    adminToken,
    'GET',
    '/v1/library/assistant/prompts',
  );
  if (
    prompts.status === 200 &&
    Array.isArray(prompts.data) &&
    prompts.data.length >= 4
  ) {
    log('pass', 'prompts', `${prompts.data.length} default prompts`);
  } else {
    log('fail', 'prompts', `Prompts ${prompts.status}`);
  }

  const ask = await apiJson<{ answer: string; source: string }>(
    adminToken,
    'POST',
    '/v1/library/assistant/ask',
    { question: 'Show latest books added' },
  );
  if (
    ask.status === 200 &&
    (ask.data as { source: string }).source === 'library-assistant' &&
    String((ask.data as { answer: string }).answer).length > 10
  ) {
    log('pass', 'assistant', 'Latest books intent answered');
  } else {
    log(
      'fail',
      'assistant',
      `Ask ${ask.status}: ${String(ask.data).slice(0, 120)}`,
    );
  }

  const footfallAsk = await apiJson<{ answer: string }>(
    adminToken,
    'POST',
    '/v1/library/assistant/ask',
    { question: 'Library footfall today' },
  );
  const footfallAnswer =
    (footfallAsk.data as { answer?: string })?.answer ?? '';
  if (
    footfallAsk.status === 200 &&
    /footfall|occupancy|inside|visits/i.test(footfallAnswer)
  ) {
    log('pass', 'assistant-footfall', 'Occupancy/footfall intent');
  } else {
    log('fail', 'assistant-footfall', `Footfall ask ${footfallAsk.status}`);
  }

  const student = await prisma.student.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [{ rfidNumber: { not: null } }, { enrollmentNumber: { not: null } }],
    },
    select: { enrollmentNumber: true, rfidNumber: true },
  });

  const scanCode = student?.rfidNumber ?? student?.enrollmentNumber;
  if (scanCode) {
    const hw = await apiJson<{
      action: string;
      entryMethod: string;
      hardwareMethod: string;
    }>(adminToken, 'POST', '/v1/library/integrations/hardware-scan', {
      scanCode,
      method: student?.rfidNumber ? 'RFID' : 'BARCODE',
    });
    if (
      (hw.status === 200 || hw.status === 201) &&
      (hw.data as { action: string }).action &&
      (hw.data as { hardwareMethod: string }).hardwareMethod
    ) {
      log(
        'pass',
        'hardware-scan',
        `Scan → ${(hw.data as { action: string }).action}`,
      );
    } else {
      log(
        'fail',
        'hardware-scan',
        `Hardware scan ${hw.status}: ${String(hw.data).slice(0, 120)}`,
      );
    }
  } else {
    log(
      'warn',
      'hardware-scan',
      'No demo student with RFID/enrollment for scan test',
    );
  }

  const accessPoint = await prisma.accessPoint.findFirst({
    where: {
      tenantId: tenant.id,
      code: 'library',
      deletedAt: null,
      accessType: 'LIBRARY',
    },
  });

  if (accessPoint && scanCode) {
    const bridge = await apiJson<{ action: string; camsLogId: string | null }>(
      adminToken,
      'POST',
      '/v1/library/integrations/cams-library',
      {
        accessPointCode: 'library',
        scanCode,
        method: 'RFID',
      },
    );
    if (bridge.status === 200 || bridge.status === 201) {
      const d = bridge.data as { action: string; camsLogId: string | null };
      log(
        'pass',
        'cams-bridge',
        `CAMS bridge ${d.action}${d.camsLogId ? ` log=${d.camsLogId.slice(0, 8)}…` : ''}`,
      );
    } else {
      log(
        'fail',
        'cams-bridge',
        `CAMS bridge ${bridge.status}: ${String(bridge.data).slice(0, 120)}`,
      );
    }
  } else if (!accessPoint) {
    log(
      'warn',
      'cams-bridge',
      'No LIBRARY access point (code=library) — run seed or seed-cams-library-kiosk',
    );
  } else {
    log('warn', 'cams-bridge', 'Skipped — no scan code');
  }

  const settings = await apiJson<{
    assistantEnabled?: boolean;
    rfidEntryEnabled?: boolean;
  }>(adminToken, 'GET', '/v1/library/settings');
  if (settings.status === 200) {
    const s = settings.data as {
      assistantEnabled?: boolean;
      rfidEntryEnabled?: boolean;
    };
    log(
      'pass',
      'settings',
      `assistant=${s.assistantEnabled ?? true} rfid=${s.rfidEntryEnabled ?? true}`,
    );
  } else {
    log('fail', 'settings', `Settings ${settings.status}`);
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
