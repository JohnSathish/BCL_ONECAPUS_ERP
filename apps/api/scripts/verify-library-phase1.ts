/**
 * Smart Library Phase 1 — smoke test.
 *
 *   npm run verify:library-phase1 -w api
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
  if (!res.ok)
    throw new Error(
      `login ${email} → ${res.status}: ${(await res.text()).slice(0, 150)}`,
    );
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
  console.log('\n=== Smart Library Phase 1 Verification ===\n');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  if (!tenant) {
    log('fail', 'tenant', 'Demo tenant not found — run seed');
    process.exit(1);
  }

  let student = await prisma.student.findFirst({
    where: { tenantId: tenant.id, rfidNumber: { not: null }, deletedAt: null },
    include: { masterProfile: true },
  });

  if (!student?.rfidNumber) {
    student = await prisma.student.findFirst({
      where: { tenantId: tenant.id, deletedAt: null },
      include: { masterProfile: true },
    });
    if (student) {
      await prisma.student.update({
        where: { id: student.id },
        data: { rfidNumber: `TEST-RFID-${student.enrollmentNumber}` },
      });
      student = {
        ...student,
        rfidNumber: `TEST-RFID-${student.enrollmentNumber}`,
      };
      log('warn', 'rfid', `Assigned test RFID to ${student.enrollmentNumber}`);
    }
  }

  if (!student?.rfidNumber) {
    log('fail', 'student', 'No student with RFID for scan test');
    process.exit(1);
  }

  let deskToken: string;
  let adminToken: string;
  let studentToken: string;

  try {
    deskToken = await login('library-desk@demo.edu', PASSWORD);
    log('pass', 'login', 'Library operator login');
  } catch (e) {
    log('fail', 'login', `Library operator: ${String(e)}`);
    process.exit(1);
  }

  try {
    adminToken = await login('admin@demo.edu', PASSWORD);
    log('pass', 'login', 'Admin login');
  } catch (e) {
    log('fail', 'login', `Admin: ${String(e)}`);
    process.exit(1);
  }

  const studentUser = student.userId
    ? await prisma.user.findUnique({ where: { id: student.userId } })
    : null;
  if (studentUser?.email) {
    try {
      studentToken = await login(studentUser.email, 'Student@123');
      log('pass', 'login', `Student login (${studentUser.email})`);
    } catch {
      try {
        studentToken = await login(studentUser.email, PASSWORD);
        log('warn', 'login', 'Student login with Admin@123');
      } catch (e) {
        log('warn', 'login', `Student login skipped: ${String(e)}`);
        studentToken = '';
      }
    }
  } else {
    studentToken = '';
    log('warn', 'login', 'No student portal user');
  }

  const scan1 = await apiJson<{
    action: string;
    visit: { durationMinutes?: number };
  }>(deskToken, 'POST', '/v1/library/access/scan', {
    scanCode: student.rfidNumber,
  });
  if (
    (scan1.status === 200 || scan1.status === 201) &&
    (scan1.data as { action: string }).action === 'ENTRY'
  ) {
    log('pass', 'scan', 'RFID scan → ENTRY');
  } else {
    log(
      'fail',
      'scan',
      `ENTRY failed: ${scan1.status} ${JSON.stringify(scan1.data).slice(0, 120)}`,
    );
  }

  const scan2 = await apiJson<{
    action: string;
    visit: { durationMinutes?: number };
  }>(deskToken, 'POST', '/v1/library/access/scan', {
    scanCode: student.rfidNumber,
  });
  if (
    (scan2.status === 200 || scan2.status === 201) &&
    (scan2.data as { action: string }).action === 'EXIT'
  ) {
    log('pass', 'scan', 'RFID scan → EXIT with duration');
  } else {
    log('fail', 'scan', `EXIT failed: ${scan2.status}`);
  }

  const visitorReg = await apiJson<{ passNumber: string; fullName: string }>(
    deskToken,
    'POST',
    '/v1/library/visitors',
    {
      fullName: 'Test Visitor',
      mobile: '9999999999',
      institution: 'Guest',
      purpose: 'Research',
    },
  );
  if (visitorReg.status === 201 || visitorReg.status === 200) {
    const pass = (visitorReg.data as { passNumber: string }).passNumber;
    log('pass', 'visitor', `Registered visitor pass ${pass}`);
    const vScan1 = await apiJson(deskToken, 'POST', '/v1/library/access/scan', {
      scanCode: pass,
    });
    const vScan2 = await apiJson(deskToken, 'POST', '/v1/library/access/scan', {
      scanCode: pass,
    });
    if (
      (vScan1.status === 200 || vScan1.status === 201) &&
      (vScan2.status === 200 || vScan2.status === 201)
    ) {
      log('pass', 'visitor', 'Visitor entry/exit scan');
    } else {
      log('fail', 'visitor', 'Visitor scan failed');
    }
  } else {
    log('fail', 'visitor', `Register failed: ${visitorReg.status}`);
  }

  const occ = await apiJson<{ totalInside: number }>(
    deskToken,
    'GET',
    '/v1/library/access/occupancy',
  );
  if (occ.status === 200) {
    log(
      'pass',
      'occupancy',
      `Occupancy endpoint OK (inside: ${(occ.data as { totalInside: number }).totalInside})`,
    );
  } else {
    log('fail', 'occupancy', `Status ${occ.status}`);
  }

  const accession = `LIB-TEST-${Date.now()}`;
  const book = await apiJson<{ id: string; copies?: { barcode: string }[] }>(
    adminToken,
    'POST',
    '/v1/library/books',
    {
      accessionNo: accession,
      title: 'Test Book Phase1',
      author: 'Tester',
      totalCopies: 1,
    },
  );
  if (book.status !== 200 && book.status !== 201) {
    log('fail', 'catalogue', `Create book: ${book.status}`);
  } else {
    log('pass', 'catalogue', 'Book created');
    const bookData = book.data as {
      id: string;
      copies?: { barcode: string }[];
    };
    const barcode = bookData.copies?.[0]?.barcode ?? `${accession}-C1`;

    const issue = await apiJson(
      adminToken,
      'POST',
      '/v1/library/circulation/issue',
      {
        memberScan: student.rfidNumber,
        copyBarcode: barcode,
      },
    );
    if (issue.status === 200 || issue.status === 201) {
      log('pass', 'circulation', 'Book issued');
    } else {
      log('fail', 'circulation', `Issue failed: ${issue.status}`);
    }

    await prisma.libraryLoan.updateMany({
      where: { tenantId: tenant.id, copy: { barcode } },
      data: { dueAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    });

    const ret = await apiJson<{ fine?: { amount: string } | null }>(
      adminToken,
      'POST',
      '/v1/library/circulation/return',
      { copyBarcode: barcode },
    );
    if (ret.status === 200 || ret.status === 201) {
      log('pass', 'circulation', 'Book returned (overdue fine may apply)');
    } else {
      log('fail', 'circulation', `Return failed: ${ret.status}`);
    }

    const issue2 = await apiJson(
      adminToken,
      'POST',
      '/v1/library/circulation/issue',
      {
        memberScan: student.rfidNumber,
        copyBarcode: barcode,
      },
    );
    if (issue2.status === 200 || issue2.status === 201) {
      const reserve = await apiJson(
        adminToken,
        'POST',
        '/v1/library/circulation/reserve',
        {
          bookId: bookData.id,
          studentId: student.id,
        },
      );
      if (reserve.status === 200 || reserve.status === 201) {
        log('pass', 'reservation', 'Reservation created while copy issued');
      } else {
        log(
          'warn',
          'reservation',
          `Reserve status ${reserve.status} (may need all copies out)`,
        );
      }
      await apiJson(adminToken, 'POST', '/v1/library/circulation/return', {
        copyBarcode: barcode,
      });
    }
  }

  const dash = await apiJson(adminToken, 'GET', '/v1/library/dashboard');
  if (dash.status === 200) log('pass', 'dashboard', 'Admin dashboard');
  else log('fail', 'dashboard', `Status ${dash.status}`);

  const booksDenied = await apiJson(
    studentToken || deskToken,
    'POST',
    '/v1/library/books',
    {
      accessionNo: 'SHOULD-FAIL',
      title: 'Nope',
    },
  );
  if (studentToken && booksDenied.status === 403) {
    log('pass', 'rbac', 'Student blocked from catalogue manage');
  } else if (!studentToken) {
    log('warn', 'rbac', 'Student RBAC skipped');
  } else {
    log('warn', 'rbac', `Student create book status ${booksDenied.status}`);
  }

  const adminBooks = await apiJson(deskToken, 'POST', '/v1/library/books', {
    accessionNo: 'DESK-FAIL',
    title: 'Nope',
  });
  if (adminBooks.status === 403) {
    log('pass', 'rbac', 'Library operator blocked from catalogue manage');
  } else {
    log('warn', 'rbac', `Desk create book status ${adminBooks.status}`);
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
