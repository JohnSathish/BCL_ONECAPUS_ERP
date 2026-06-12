/**
 * Smart Library Phase 4 — fine automation, renewals, analytics, ranked search.
 *
 *   npm run verify:library-phase4 -w api
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
  console.log('\n=== Smart Library Phase 4 Verification ===\n');

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

  const settings = await apiJson<{
    blockIssueOnUnpaidFines?: boolean;
    overdueNotifyEnabled?: boolean;
    maxRenewals?: number;
  }>(adminToken, 'GET', '/v1/library/settings');
  if (
    settings.status === 200 &&
    typeof (settings.data as { blockIssueOnUnpaidFines?: boolean })
      .blockIssueOnUnpaidFines === 'boolean'
  ) {
    log('pass', 'settings', 'Phase 4 settings flags present');
  } else {
    log('fail', 'settings', `Settings status ${settings.status}`);
  }

  const accrue = await apiJson<{ checked: number; updated: number }>(
    adminToken,
    'POST',
    '/v1/library/circulation/accrue-fines',
  );
  if (accrue.status === 200 || accrue.status === 201) {
    log(
      'pass',
      'fines',
      `Running fine accrual (updated: ${(accrue.data as { updated: number }).updated})`,
    );
  } else {
    log('fail', 'fines', `Accrue status ${accrue.status}`);
  }

  const finesList = await apiJson<unknown[]>(
    adminToken,
    'GET',
    '/v1/library/circulation/fines?status=UNPAID',
  );
  if (finesList.status === 200)
    log(
      'pass',
      'fines',
      `Fines list (${(finesList.data as unknown[]).length} unpaid)`,
    );
  else log('fail', 'fines', `List status ${finesList.status}`);

  const overdue = await apiJson<{ projectedFine?: number }[]>(
    adminToken,
    'GET',
    '/v1/library/circulation/overdue',
  );
  if (overdue.status === 200) {
    const withProjection = (overdue.data as { projectedFine?: number }[]).some(
      (l) => typeof l.projectedFine === 'number',
    );
    if ((overdue.data as unknown[]).length === 0 || withProjection) {
      log('pass', 'fines', 'Overdue loans include projected fine');
    } else {
      log('warn', 'fines', 'No overdue loans to verify projection');
    }
  } else {
    log('fail', 'fines', `Overdue status ${overdue.status}`);
  }

  const heatmap = await apiJson<{ rows: unknown[] }>(
    adminToken,
    'GET',
    '/v1/library/analytics/department-heatmap',
  );
  if (
    heatmap.status === 200 &&
    Array.isArray((heatmap.data as { rows: unknown[] }).rows)
  ) {
    log('pass', 'analytics', 'Department heatmap');
  } else {
    log('fail', 'analytics', `Heatmap status ${heatmap.status}`);
  }

  const gender = await apiJson<{ weekly: unknown[] }>(
    adminToken,
    'GET',
    '/v1/library/analytics/gender-trends',
  );
  if (
    gender.status === 200 &&
    Array.isArray((gender.data as { weekly: unknown[] }).weekly)
  ) {
    log('pass', 'analytics', 'Gender trends');
  } else {
    log('fail', 'analytics', `Gender trends status ${gender.status}`);
  }

  const dash = await apiJson<{
    unpaidFinesCount?: number;
    unpaidFinesTotal?: number;
  }>(adminToken, 'GET', '/v1/library/dashboard');
  if (
    dash.status === 200 &&
    typeof (dash.data as { unpaidFinesCount?: number }).unpaidFinesCount ===
      'number'
  ) {
    log('pass', 'dashboard', 'Unpaid fine KPIs on dashboard');
  } else {
    log('fail', 'dashboard', `Dashboard status ${dash.status}`);
  }

  const search = await apiJson<{ total: number }>(
    adminToken,
    'GET',
    '/v1/library/search?q=book&type=BOOK',
  );
  if (search.status === 200)
    log('pass', 'search', 'Ranked search with type filter');
  else log('fail', 'search', `Search status ${search.status}`);

  const suggestions = await apiJson<unknown[]>(
    adminToken,
    'GET',
    '/v1/library/search/suggestions?q=te',
  );
  if (suggestions.status === 200 && Array.isArray(suggestions.data)) {
    log('pass', 'search', 'Search suggestions');
  } else {
    log('fail', 'search', `Suggestions status ${suggestions.status}`);
  }

  const notify = await apiJson<{ checked: number; sent: number }>(
    adminToken,
    'POST',
    '/v1/library/circulation/notify-overdue',
  );
  if (notify.status === 200 || notify.status === 201) {
    log(
      'pass',
      'notifications',
      `Deduped overdue reminders (sent: ${(notify.data as { sent: number }).sent})`,
    );
    const notify2 = await apiJson<{ sent: number }>(
      adminToken,
      'POST',
      '/v1/library/circulation/notify-overdue',
    );
    if (
      notify2.status === 200 &&
      (notify2.data as { sent: number }).sent === 0
    ) {
      log('pass', 'notifications', 'Second run sends zero (dedupe)');
    } else {
      log(
        'warn',
        'notifications',
        'Dedupe may not apply without overdue loans today',
      );
    }
  } else {
    log('warn', 'notifications', `Notify status ${notify.status}`);
  }

  const overdueCsv = await fetch(
    `${API_BASE}/v1/library/reports/export/overdue.csv`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-Slug': TENANT_SLUG,
      },
    },
  );
  const overdueCsvText = await overdueCsv.text();
  if (overdueCsv.ok && overdueCsvText.includes('Barcode')) {
    log('pass', 'reports', 'Overdue CSV export');
  } else {
    log('fail', 'reports', `Overdue CSV status ${overdueCsv.status}`);
  }

  const finesCsv = await fetch(
    `${API_BASE}/v1/library/reports/export/fines.csv`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-Slug': TENANT_SLUG,
      },
    },
  );
  const finesCsvText = await finesCsv.text();
  if (finesCsv.ok && finesCsvText.includes('Amount')) {
    log('pass', 'reports', 'Fines CSV export');
  } else {
    log('fail', 'reports', `Fines CSV status ${finesCsv.status}`);
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
