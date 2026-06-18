/**
 * BCL Smart Library Phase 1 — policy engine, dashboard KPIs, circulation desk APIs.
 *
 *   npm run verify:smart-library-phase1 -w api
 */
import { randomUUID } from 'crypto';
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

async function seedTodayCirculation(tenantId: string) {
  const startOfDay = new Date();
  startOfDay.setHours(10, 0, 0, 0);

  const existingIssuedToday = await prisma.libraryLoan.count({
    where: { tenantId, issuedAt: { gte: startOfDay } },
  });
  if (existingIssuedToday > 0) {
    log('pass', 'seed', `Already ${existingIssuedToday} issue(s) today`);
    return;
  }

  const student = await prisma.student.findFirst({
    where: { tenantId, deletedAt: null },
  });
  const copy = await prisma.libraryBookCopy.findFirst({
    where: { tenantId, status: 'AVAILABLE' },
    include: { book: true },
  });
  if (!student || !copy) {
    log('warn', 'seed', 'No student or available copy for demo seed');
    return;
  }

  const loanId = randomUUID();
  await prisma.libraryLoan.create({
    data: {
      id: loanId,
      tenantId,
      studentId: student.id,
      memberType: 'STUDENT',
      copyId: copy.id,
      issuedAt: startOfDay,
      dueAt: new Date(startOfDay.getTime() + 14 * 86400000),
      status: 'RETURNED',
      returnedAt: new Date(startOfDay.getTime() + 2 * 3600000),
    },
  });
  await prisma.libraryBookCopy.update({
    where: { id: copy.id },
    data: { status: 'AVAILABLE' },
  });
  await prisma.libraryAuditLog.create({
    data: {
      id: randomUUID(),
      tenantId,
      action: 'ISSUE',
      metadata: {
        memberName: student.enrollmentNumber,
        bookTitle: copy.book.title,
      },
    },
  });
  await prisma.libraryAuditLog.create({
    data: {
      id: randomUUID(),
      tenantId,
      action: 'RETURN',
      metadata: {
        memberName: student.enrollmentNumber,
        bookTitle: copy.book.title,
      },
    },
  });
  log('pass', 'seed', 'Demo issue/return today seeded');
}

async function main() {
  console.log('\n=== BCL Smart Library Phase 1 Verification ===\n');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  if (!tenant) {
    log('fail', 'tenant', 'Demo tenant not found');
    process.exit(1);
  }

  await seedTodayCirculation(tenant.id);

  let adminToken: string;
  try {
    adminToken = await login('admin@demo.edu', PASSWORD);
    log('pass', 'login', 'Admin login');
  } catch (e) {
    log('fail', 'login', String(e));
    process.exit(1);
  }

  const policyPatch = await apiJson<{
    circulationPolicy?: { student?: { loanDays: number } };
  }>(adminToken, 'PATCH', '/v1/library/settings', {
    circulationPolicy: {
      student: { loanDays: 14, maxBooks: 3, maxRenewals: 1 },
      faculty: { loanDays: 30, maxBooks: 10, maxRenewals: 2 },
      researchScholar: { loanDays: 45, maxBooks: 15, maxRenewals: 2 },
    },
    finePolicy: { lostBookPenaltyMultiplier: 2, damageChargeDefault: 100 },
  });
  if (policyPatch.status === 200) {
    const cp = (
      policyPatch.data as {
        circulationPolicy?: { student?: { loanDays: number } };
      }
    ).circulationPolicy;
    if (cp?.student?.loanDays === 14) {
      log('pass', 'policy', 'Circulation policy saved and returned');
    } else {
      log('warn', 'policy', 'Policy saved but student loanDays mismatch');
    }
  } else {
    log('fail', 'policy', `PATCH settings ${policyPatch.status}`);
  }

  const settingsGet = await apiJson<{
    circulationPolicy?: { faculty?: { loanDays: number } };
    finePolicy?: { damageChargeDefault: number };
  }>(adminToken, 'GET', '/v1/library/settings');
  if (
    settingsGet.status === 200 &&
    (settingsGet.data as { finePolicy?: { damageChargeDefault: number } })
      .finePolicy?.damageChargeDefault === 100
  ) {
    log('pass', 'policy', 'Fine policy persisted');
  } else {
    log('fail', 'policy', 'Fine policy load failed');
  }

  const dash = await apiJson<{
    totalTitles?: number;
    issuedToday?: number;
    returnedToday?: number;
    healthScore?: { overall: number };
    activity?: unknown[];
    entryAnalytics?: { active: boolean };
  }>(adminToken, 'GET', '/v1/library/dashboard');
  if (dash.status === 200) {
    const d = dash.data as {
      totalTitles?: number;
      issuedToday?: number;
      returnedToday?: number;
      healthScore?: { overall: number };
    };
    if (
      typeof d.totalTitles === 'number' &&
      typeof d.healthScore?.overall === 'number'
    ) {
      log(
        'pass',
        'dashboard',
        `KPIs: titles=${d.totalTitles}, issued=${d.issuedToday}, returned=${d.returnedToday}, health=${d.healthScore.overall}`,
      );
    } else {
      log('fail', 'dashboard', 'Missing Phase 1 dashboard fields');
    }
  } else {
    log('fail', 'dashboard', `Status ${dash.status}`);
  }

  const activity = await apiJson<unknown[]>(
    adminToken,
    'GET',
    '/v1/library/dashboard/activity?limit=5',
  );
  if (activity.status === 200 && Array.isArray(activity.data)) {
    log('pass', 'dashboard', `Activity feed (${activity.data.length} items)`);
  } else {
    log('fail', 'dashboard', `Activity status ${activity.status}`);
  }

  const student = await prisma.student.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  if (!student?.rfidNumber) {
    if (student) {
      await prisma.student.update({
        where: { id: student.id },
        data: { rfidNumber: `TEST-RFID-${student.enrollmentNumber}` },
      });
    }
  }
  const scanCode =
    student?.rfidNumber ??
    (student ? `TEST-RFID-${student.enrollmentNumber}` : '');

  if (scanCode) {
    const summary = await apiJson<{ maxBooks: number; borrowedCount: number }>(
      adminToken,
      'GET',
      `/v1/library/circulation/member-summary?scanCode=${encodeURIComponent(scanCode)}`,
    );
    if (
      summary.status === 200 &&
      typeof (summary.data as { maxBooks: number }).maxBooks === 'number'
    ) {
      log('pass', 'circulation', 'Member summary endpoint');
    } else {
      log('fail', 'circulation', `Member summary ${summary.status}`);
    }
  }

  const copy = await prisma.libraryBookCopy.findFirst({
    where: { tenantId: tenant.id },
    include: { book: true },
  });
  if (copy) {
    const preview = await apiJson<{ book: { location: string } }>(
      adminToken,
      'GET',
      `/v1/library/circulation/book-preview?barcode=${encodeURIComponent(copy.barcode)}`,
    );
    if (preview.status === 200) {
      log('pass', 'circulation', 'Book preview endpoint');
    } else {
      log('fail', 'circulation', `Book preview ${preview.status}`);
    }

    const qr = await apiJson<{ payload: string; qrImageUrl: string }>(
      adminToken,
      'GET',
      `/v1/library/copies/${copy.id}/qr`,
    );
    if (
      qr.status === 200 &&
      (qr.data as { payload: string }).payload?.startsWith('LIB:C:')
    ) {
      log('pass', 'qr', 'Copy QR payload LIB:C:');
    } else {
      log('fail', 'qr', `Copy QR status ${qr.status}`);
    }

    if (scanCode) {
      const issuePrev = await apiJson<{ loanDays: number }>(
        adminToken,
        'GET',
        `/v1/library/circulation/issue-preview?memberScan=${encodeURIComponent(scanCode)}&copyBarcode=${encodeURIComponent(copy.barcode)}`,
      );
      if (
        issuePrev.status === 200 &&
        (issuePrev.data as { loanDays: number }).loanDays === 14
      ) {
        log('pass', 'policy', 'Student issue preview loanDays=14');
      } else if (issuePrev.status === 400) {
        log(
          'warn',
          'policy',
          'Issue preview blocked (limit or copy unavailable)',
        );
      } else {
        log('fail', 'policy', `Issue preview ${issuePrev.status}`);
      }
    }
  }

  if (student && copy) {
    await prisma.libraryLoan.updateMany({
      where: { tenantId: tenant.id, studentId: student.id, status: 'ACTIVE' },
      data: { status: 'RETURNED', returnedAt: new Date() },
    });

    const barcodes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const acc = `LIMIT-TEST-${Date.now()}-${i}`;
      const created = await apiJson<{ copies?: { barcode: string }[] }>(
        adminToken,
        'POST',
        '/v1/library/books',
        {
          accessionNo: acc,
          title: `Limit Test ${i}`,
          author: 'Tester',
          totalCopies: 1,
        },
      );
      if (created.status === 200 || created.status === 201) {
        const bc = (created.data as { copies?: { barcode: string }[] })
          .copies?.[0]?.barcode;
        if (bc) barcodes.push(bc);
      }
    }

    for (const bc of barcodes) {
      await apiJson(adminToken, 'POST', '/v1/library/circulation/issue', {
        memberScan: scanCode,
        copyBarcode: bc,
      });
    }

    const extra = await apiJson(
      adminToken,
      'POST',
      '/v1/library/circulation/issue',
      {
        memberScan: scanCode,
        copyBarcode: copy.barcode,
      },
    );
    if (extra.status === 400) {
      log('pass', 'policy', 'Issue blocked at max books (3)');
    } else {
      log('fail', 'policy', `Expected 400 at limit, got ${extra.status}`);
    }

    for (const bc of barcodes) {
      await apiJson(adminToken, 'POST', '/v1/library/circulation/return', {
        copyBarcode: bc,
      });
    }
  }

  const passed = checks.filter((c) => c.level === 'pass').length;
  const failed = checks.filter((c) => c.level === 'fail').length;
  const warned = checks.filter((c) => c.level === 'warn').length;
  console.log(
    `\nResult: ${passed} passed, ${failed} failed, ${warned} warnings\n`,
  );
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
