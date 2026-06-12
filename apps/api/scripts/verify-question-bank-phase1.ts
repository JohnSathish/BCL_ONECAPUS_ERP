/**
 * Question Bank Phase 1 — full workflow smoke test.
 *
 *   npm run verify:question-bank-phase1 -w api
 *   npm run verify:question-bank-phase1 -w api -- --api=http://127.0.0.1:3001/api
 */
import * as bcrypt from 'bcrypt';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

const TENANT_SLUG = 'demo';
const PASSWORD = 'Admin@123';
const STUDENT_PASSWORD = 'Student@123';
const API_BASE = (
  process.argv.find((a) => a.startsWith('--api='))?.slice(6) ??
  'http://127.0.0.1:3001/api'
).replace(/\/$/, '');

const TEST_USERS = {
  faculty: 'qb-faculty@demo.edu',
  hod: 'qb-hod@demo.edu',
  examCell: 'qb-examcell@demo.edu',
  admin: 'admin@demo.edu',
  student: 'meban.sangma@student.demo.edu',
};

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
  const session = unwrap<{
    accessToken: string;
    user?: { permissions?: string[]; roles?: string[] };
  }>(await res.json());
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

async function apiMultipart<T>(
  token: string,
  path: string,
  form: FormData,
): Promise<{ status: number; data: T | string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Tenant-Slug': TENANT_SLUG },
    body: form,
  });
  const text = await res.text();
  try {
    return { status: res.status, data: unwrap<T>(JSON.parse(text)) };
  } catch {
    return { status: res.status, data: text };
  }
}

function minimalPdf(): Buffer {
  const content = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
178
%%EOF`;
  return Buffer.from(content);
}

async function ensureTestUsers(tenantId: string) {
  const hash = await bcrypt.hash(PASSWORD, 12);
  const roleMap: Record<string, string> = {
    [TEST_USERS.faculty]: 'faculty',
    [TEST_USERS.hod]: 'hod',
    [TEST_USERS.examCell]: 'academic-admin',
  };

  for (const [email, roleSlug] of Object.entries(roleMap)) {
    const role = await prisma.role.findFirstOrThrow({
      where: { tenantId, slug: roleSlug },
    });
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { passwordHash: hash, isActive: true },
      create: {
        tenantId,
        email,
        passwordHash: hash,
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });
    await prisma.userRole.deleteMany({
      where: { userId: user.id, roleId: role.id },
    });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });
  }
  log(
    'pass',
    'setup',
    `Test users ready: ${Object.keys(roleMap).join(', ')} (${PASSWORD})`,
  );
}

async function verifyPermissions(tenantId: string) {
  const required: Record<string, string[]> = {
    faculty: ['question-bank:contribute', 'question-bank:read'],
    hod: ['question-bank:read', 'question-bank:approve'],
    'academic-admin': [
      'question-bank:read',
      'question-bank:publish',
      'question-bank:manage',
    ],
    student: ['question-bank:download'],
  };

  for (const [roleSlug, perms] of Object.entries(required)) {
    const role = await prisma.role.findFirst({
      where: { tenantId, slug: roleSlug },
      include: { permissions: { include: { permission: true } } },
    });
    if (!role) {
      log('fail', 'permissions', `Role missing: ${roleSlug}`);
      continue;
    }
    const slugs = new Set(role.permissions.map((p) => p.permission.slug));
    const missing = perms.filter((p) => !slugs.has(p));
    if (missing.length)
      log('fail', 'permissions', `${roleSlug} missing: ${missing.join(', ')}`);
    else log('pass', 'permissions', `${roleSlug} has ${perms.join(', ')}`);
  }
}

async function main() {
  console.log(`\nQuestion Bank Phase 1 smoke test`);
  console.log(`API: ${API_BASE}  Tenant: ${TENANT_SLUG}\n`);

  const tenant = await prisma.tenant.findFirstOrThrow({
    where: { slug: TENANT_SLUG },
  });

  console.log('── 1. Setup & permissions ──');
  await ensureTestUsers(tenant.id);
  await verifyPermissions(tenant.id);

  const course =
    (await prisma.course.findFirst({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [
          { code: { contains: 'CHE', mode: 'insensitive' } },
          { title: { contains: 'Chem', mode: 'insensitive' } },
        ],
      },
      select: { id: true, code: true, title: true },
    })) ??
    (await prisma.course.findFirst({
      where: { tenantId: tenant.id, deletedAt: null },
      select: { id: true, code: true, title: true },
    }));

  if (!course) {
    log('fail', 'setup', 'No course in tenant — cannot link paper');
    return finish();
  }
  log('pass', 'setup', `Using course ${course.code} — ${course.title}`);

  const tmpDir = join(process.cwd(), 'uploads', '_qb-smoke');
  mkdirSync(tmpDir, { recursive: true });
  const pdfPath = join(tmpDir, 'CHE251_2025_smoke.pdf');
  writeFileSync(pdfPath, minimalPdf());

  console.log('\n── 2. Faculty upload & submit ──');
  let facultyToken: string;
  try {
    facultyToken = await login(TEST_USERS.faculty, PASSWORD);
    log('pass', 'faculty-login', `${TEST_USERS.faculty} authenticated`);
  } catch (e) {
    log('fail', 'faculty-login', String(e));
    return finish();
  }

  const uploadForm = new FormData();
  uploadForm.append('paperCode', course.code);
  uploadForm.append('paperName', `Organic Chemistry Smoke Test ${Date.now()}`);
  uploadForm.append('paperType', 'UNIVERSITY_EXAM');
  uploadForm.append('examYear', '2025');
  uploadForm.append('semesterNo', '3');
  uploadForm.append('courseId', course.id);
  uploadForm.append(
    'file',
    new Blob([minimalPdf()], { type: 'application/pdf' }),
    'CHE251_2025_smoke.pdf',
  );

  const created = await apiMultipart<{ id: string; status: string }>(
    facultyToken,
    '/v1/question-bank/papers',
    uploadForm,
  );
  if (created.status !== 201 && created.status !== 200) {
    log(
      'fail',
      'faculty-upload',
      `POST /papers → ${created.status}: ${JSON.stringify(created.data).slice(0, 400)}`,
    );
    return finish();
  }
  const paperId = (created.data as { id: string }).id;
  log('pass', 'faculty-upload', `Paper created ${paperId} (DRAFT)`);

  const submit = await apiJson<{ status: string }>(
    facultyToken,
    'POST',
    `/v1/question-bank/papers/${paperId}/submit`,
  );
  if (submit.status !== 201 && submit.status !== 200) {
    log(
      'fail',
      'faculty-submit',
      `Submit → ${submit.status}: ${String(submit.data).slice(0, 200)}`,
    );
    return finish();
  }
  if ((submit.data as { status: string }).status !== 'PENDING_REVIEW') {
    log(
      'fail',
      'faculty-submit',
      `Expected PENDING_REVIEW, got ${(submit.data as { status: string }).status}`,
    );
  } else {
    log('pass', 'faculty-submit', 'Paper submitted → PENDING_REVIEW');
  }

  console.log('\n── 3. Workflow enforcement ──');
  const pendingFaculty = await apiJson<
    Array<{ id: string; stepCode: string; roleSlug: string }>
  >(facultyToken, 'GET', '/v1/question-bank/approvals/pending');
  if (pendingFaculty.status === 403 || pendingFaculty.status === 401) {
    log(
      'pass',
      'rbac-faculty-block',
      'Faculty blocked from approval queue (403/401 as expected)',
    );
  } else if (
    pendingFaculty.status === 200 &&
    Array.isArray(pendingFaculty.data) &&
    pendingFaculty.data.length
  ) {
    const reject = await apiJson(
      facultyToken,
      'POST',
      `/v1/question-bank/approvals/${pendingFaculty.data[0].id}/action`,
      {
        action: 'APPROVE',
      },
    );
    if (reject.status === 403 || reject.status === 401) {
      log(
        'pass',
        'rbac-faculty-block',
        'Faculty cannot approve (403/401 as expected)',
      );
    } else {
      log(
        'fail',
        'rbac-faculty-block',
        `Faculty approval should fail, got ${reject.status}`,
      );
    }
  } else {
    log(
      'warn',
      'rbac-faculty-block',
      `Unexpected faculty pending response (${pendingFaculty.status})`,
    );
  }

  let hodToken: string;
  try {
    hodToken = await login(TEST_USERS.hod, PASSWORD);
    log('pass', 'hod-login', `${TEST_USERS.hod} authenticated`);
  } catch (e) {
    log('fail', 'hod-login', String(e));
    return finish();
  }

  const pendingHod = await apiJson<
    Array<{ id: string; stepCode: string; roleSlug: string; paperId: string }>
  >(hodToken, 'GET', '/v1/question-bank/approvals/pending');
  if (
    pendingHod.status !== 200 ||
    !Array.isArray(pendingHod.data) ||
    !pendingHod.data.length
  ) {
    log(
      'fail',
      'hod-queue',
      `No pending approvals for HOD (${pendingHod.status})`,
    );
    return finish();
  }

  const hodStep = pendingHod.data.find(
    (a) => a.paperId === paperId && a.roleSlug === 'hod',
  );
  const examStepEarly = pendingHod.data.find(
    (a) => a.paperId === paperId && a.roleSlug === 'academic-admin',
  );
  if (examStepEarly && !hodStep) {
    log('fail', 'workflow-order', 'Exam cell step visible before HOD step');
  } else if (hodStep) {
    log('pass', 'workflow-order', 'HOD step is first pending approval');
  }

  if (examStepEarly && hodStep) {
    let examToken: string;
    try {
      examToken = await login(TEST_USERS.examCell, PASSWORD);
    } catch {
      examToken = '';
    }
    if (examToken) {
      const skip = await apiJson(
        examToken,
        'POST',
        `/v1/question-bank/approvals/${examStepEarly.id}/action`,
        { action: 'APPROVE' },
      );
      if (skip.status === 400 || skip.status === 403) {
        log('pass', 'workflow-skip-block', 'Exam cell cannot skip HOD step');
      } else {
        log(
          'fail',
          'workflow-skip-block',
          `Exam cell skip should fail, got ${skip.status}`,
        );
      }
    }
  }

  if (hodStep) {
    const hodApprove = await apiJson(
      hodToken,
      'POST',
      `/v1/question-bank/approvals/${hodStep.id}/action`,
      {
        action: 'APPROVE',
        comments: 'HOD smoke test OK',
      },
    );
    if (hodApprove.status !== 200 && hodApprove.status !== 201) {
      log(
        'fail',
        'hod-approve',
        `HOD approve → ${hodApprove.status}: ${String(hodApprove.data).slice(0, 200)}`,
      );
    } else {
      log('pass', 'hod-approve', 'HOD approved step 1');
    }
  }

  console.log('\n── 4. Exam cell approve → auto-publish ──');
  let examToken: string;
  try {
    examToken = await login(TEST_USERS.examCell, PASSWORD);
    log('pass', 'examcell-login', `${TEST_USERS.examCell} authenticated`);
  } catch (e) {
    log('fail', 'examcell-login', String(e));
    return finish();
  }

  const pendingExam = await apiJson<
    Array<{ id: string; roleSlug: string; paperId: string }>
  >(examToken, 'GET', '/v1/question-bank/approvals/pending');
  const examStep = Array.isArray(pendingExam.data)
    ? pendingExam.data.find(
        (a) => a.paperId === paperId && a.roleSlug === 'academic-admin',
      )
    : undefined;

  if (!examStep) {
    log(
      'fail',
      'examcell-queue',
      'Exam cell step not in pending queue after HOD approval',
    );
  } else {
    const examApprove = await apiJson(
      examToken,
      'POST',
      `/v1/question-bank/approvals/${examStep.id}/action`,
      {
        action: 'APPROVE',
        comments: 'Exam cell smoke test OK',
      },
    );
    if (examApprove.status !== 200 && examApprove.status !== 201) {
      log('fail', 'examcell-approve', `Exam approve → ${examApprove.status}`);
    } else {
      log('pass', 'examcell-approve', 'Exam cell approved step 2');
    }
  }

  const adminToken = await login(TEST_USERS.admin, PASSWORD);
  const published = await apiJson<{ status: string }>(
    adminToken,
    'GET',
    `/v1/question-bank/papers/${paperId}`,
  );
  if (
    published.status === 200 &&
    (published.data as { status: string }).status === 'PUBLISHED'
  ) {
    log(
      'pass',
      'auto-publish',
      'Paper status is PUBLISHED after final approval',
    );
  } else {
    log(
      'fail',
      'auto-publish',
      `Expected PUBLISHED, got ${published.status} / ${JSON.stringify(published.data).slice(0, 100)}`,
    );
  }

  console.log('\n── 5. Dashboard & search ──');
  const dash = await apiJson<{
    kpis: { pendingApprovals: number; totalPapers: number };
  }>(adminToken, 'GET', '/v1/question-bank/dashboard');
  if (dash.status === 200) {
    const kpis = (
      dash.data as { kpis: { pendingApprovals: number; totalPapers: number } }
    ).kpis;
    log(
      'pass',
      'dashboard',
      `Dashboard OK — ${kpis.totalPapers} papers, ${kpis.pendingApprovals} pending`,
    );
  } else {
    log('fail', 'dashboard', `Dashboard → ${dash.status}`);
  }

  const search = await apiJson<{ items: { id: string }[] }>(
    adminToken,
    'GET',
    `/v1/question-bank/papers?q=Organic&limit=20`,
  );
  if (
    search.status === 200 &&
    Array.isArray((search.data as { items: unknown[] }).items)
  ) {
    const found = (search.data as { items: { id: string }[] }).items.some(
      (p) => p.id === paperId,
    );
    log(
      found ? 'pass' : 'fail',
      'search',
      found
        ? 'Search "Organic" returns smoke paper'
        : 'Smoke paper not in search results',
    );
  } else {
    log('fail', 'search', `Search → ${search.status}`);
  }

  console.log('\n── 6. Student access ──');
  let studentToken: string;
  try {
    studentToken = await login(TEST_USERS.student, STUDENT_PASSWORD);
    log('pass', 'student-login', `${TEST_USERS.student} authenticated`);
  } catch (e) {
    log(
      'warn',
      'student-login',
      `${e} — trying Student@123 fallback on other students`,
    );
    const alt = await prisma.student.findFirst({
      where: { tenantId: tenant.id, deletedAt: null, user: { isNot: null } },
      include: { user: { select: { email: true } } },
    });
    if (alt?.user?.email) {
      try {
        studentToken = await login(alt.user.email, STUDENT_PASSWORD);
        log('pass', 'student-login', `${alt.user.email} authenticated`);
      } catch (e2) {
        log('fail', 'student-login', String(e2));
        studentToken = '';
      }
    } else {
      studentToken = '';
    }
  }

  if (studentToken) {
    const adminRoute = await apiJson(
      studentToken,
      'GET',
      '/v1/question-bank/settings',
    );
    if (adminRoute.status === 403 || adminRoute.status === 401) {
      log(
        'pass',
        'student-rbac',
        'Student blocked from admin settings endpoint',
      );
    } else {
      log(
        'fail',
        'student-rbac',
        `Student should not access settings, got ${adminRoute.status}`,
      );
    }

    const myPapers = await apiJson<{ items: { id: string; status: string }[] }>(
      studentToken,
      'GET',
      '/v1/question-bank/me/papers?limit=50',
    );
    if (myPapers.status === 200) {
      const items =
        (myPapers.data as { items: { id: string; status: string }[] }).items ??
        [];
      const visible = items.find((p) => p.id === paperId);
      if (visible) {
        log(
          'pass',
          'student-list',
          'Student sees published paper in /me/papers',
        );
      } else {
        log(
          'warn',
          'student-list',
          `Paper not in student list (${items.length} papers) — enrollment scope may exclude course ${course.code}`,
        );
      }
    } else {
      log('fail', 'student-list', `/me/papers → ${myPapers.status}`);
    }

    const dl = await fetch(
      `${API_BASE}/v1/question-bank/papers/${paperId}/download`,
      {
        headers: {
          Authorization: `Bearer ${studentToken}`,
          'X-Tenant-Slug': TENANT_SLUG,
        },
      },
    );
    if (dl.status === 200) {
      const buf = Buffer.from(await dl.arrayBuffer());
      log(
        buf.length > 50 ? 'pass' : 'fail',
        'student-download',
        `Download OK (${buf.length} bytes)`,
      );
    } else if (dl.status === 403) {
      log(
        'warn',
        'student-download',
        '403 — student not enrolled in course (scope isolation working)',
      );
    } else {
      log('fail', 'student-download', `Download → ${dl.status}`);
    }

    const bookmark = await apiJson(
      studentToken,
      'POST',
      `/v1/question-bank/me/bookmarks/${paperId}`,
    );
    if (bookmark.status === 200 || bookmark.status === 201) {
      log('pass', 'student-bookmark', 'Bookmark added');
      const bookmarks = await apiJson<unknown[]>(
        studentToken,
        'GET',
        '/v1/question-bank/me/bookmarks',
      );
      if (
        bookmarks.status === 200 &&
        Array.isArray(bookmarks.data) &&
        bookmarks.data.length
      ) {
        log(
          'pass',
          'student-bookmark-list',
          `${bookmarks.data.length} bookmark(s) persisted`,
        );
      }
      await apiJson(
        studentToken,
        'DELETE',
        `/v1/question-bank/me/bookmarks/${paperId}`,
      );
    } else if (bookmark.status === 403) {
      log(
        'warn',
        'student-bookmark',
        '403 — cannot bookmark out-of-scope paper',
      );
    } else {
      log('fail', 'student-bookmark', `Bookmark → ${bookmark.status}`);
    }

    // Positive path: paper linked to student's enrolled course (GEO-100 for meban)
    const enrolledCourse = await prisma.student.findFirst({
      where: { tenantId: tenant.id, user: { email: TEST_USERS.student } },
      include: {
        semesterRegistrations: {
          include: {
            lines: { include: { offering: { include: { course: true } } } },
          },
        },
      },
    });
    const studentCourse = enrolledCourse?.semesterRegistrations
      .flatMap((r) => r.lines.map((l) => l.offering?.course))
      .find(Boolean);

    if (studentCourse) {
      const geoForm = new FormData();
      geoForm.append('paperCode', studentCourse.code);
      geoForm.append('paperName', `Student scope test ${studentCourse.title}`);
      geoForm.append('paperType', 'UNIVERSITY_EXAM');
      geoForm.append('examYear', '2024');
      geoForm.append('courseId', studentCourse.id);
      geoForm.append(
        'file',
        new Blob([minimalPdf()], { type: 'application/pdf' }),
        `${studentCourse.code}_2024.pdf`,
      );
      const geoCreated = await apiMultipart<{ id: string }>(
        adminToken,
        '/v1/question-bank/papers',
        geoForm,
      );
      if (geoCreated.status === 200 || geoCreated.status === 201) {
        const geoId = (geoCreated.data as { id: string }).id;
        const geoPub = await apiJson(
          adminToken,
          'POST',
          `/v1/question-bank/papers/${geoId}/publish`,
        );
        if (geoPub.status === 200 || geoPub.status === 201) {
          const geoList = await apiJson<{ items: { id: string }[] }>(
            studentToken,
            'GET',
            '/v1/question-bank/me/papers?limit=50',
          );
          const geoVisible =
            geoList.status === 200 &&
            (geoList.data as { items: { id: string }[] }).items.some(
              (p) => p.id === geoId,
            );
          log(
            geoVisible ? 'pass' : 'fail',
            'student-enrolled-list',
            geoVisible
              ? `Student sees ${studentCourse.code} paper`
              : 'Enrolled course paper not listed',
          );

          const geoDl = await fetch(
            `${API_BASE}/v1/question-bank/papers/${geoId}/download`,
            {
              headers: {
                Authorization: `Bearer ${studentToken}`,
                'X-Tenant-Slug': TENANT_SLUG,
              },
            },
          );
          if (geoDl.status === 200) {
            log(
              'pass',
              'student-enrolled-download',
              `Download OK for enrolled course ${studentCourse.code}`,
            );
            const geoBm = await apiJson(
              studentToken,
              'POST',
              `/v1/question-bank/me/bookmarks/${geoId}`,
            );
            log(
              geoBm.status === 200 || geoBm.status === 201 ? 'pass' : 'fail',
              'student-enrolled-bookmark',
              'Bookmark on enrolled paper',
            );
            await apiJson(
              studentToken,
              'DELETE',
              `/v1/question-bank/me/bookmarks/${geoId}`,
            );
          } else {
            log(
              'fail',
              'student-enrolled-download',
              `Download → ${geoDl.status}`,
            );
          }
        } else {
          log(
            'fail',
            'student-enrolled-setup',
            `Admin publish → ${geoPub.status}`,
          );
        }
      } else {
        log(
          'fail',
          'student-enrolled-setup',
          `Admin create → ${geoCreated.status}`,
        );
      }
    } else {
      log(
        'warn',
        'student-enrolled-setup',
        'No enrolled courses found for student — skip positive access test',
      );
    }
  }

  console.log('\n── 7. Bulk import (Excel + ZIP) ──');
  const bulkPdf = join(tmpDir, 'BULK_CHE251_2025.pdf');
  writeFileSync(bulkPdf, minimalPdf());
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Question Papers');
  ws.addRow([
    'paperCode',
    'subject',
    'department',
    'semester',
    'academicYear',
    'paperType',
    'examYear',
    'examMonth',
    'fileName',
    'maxMarks',
    'durationMinutes',
  ]);
  ws.addRow([
    course.code,
    'Bulk Organic Chemistry',
    '',
    '3',
    '',
    'UNIVERSITY_EXAM',
    '2024',
    '11',
    'BULK_CHE251_2025.pdf',
    '70',
    '180',
  ]);
  const xlsxPath = join(tmpDir, 'bulk.xlsx');
  await wb.xlsx.writeFile(xlsxPath);

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  zip.file('BULK_CHE251_2025.pdf', readFileSync(bulkPdf));
  const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });

  const previewForm = new FormData();
  previewForm.append('excel', new Blob([readFileSync(xlsxPath)]), 'bulk.xlsx');
  previewForm.append('zip', new Blob([zipBuf]), 'bulk.zip');
  const preview = await apiMultipart<{
    summary: { valid: number; invalid: number };
    rows: unknown[];
  }>(adminToken, '/v1/question-bank/bulk/preview', previewForm);
  if (preview.status === 200 || preview.status === 201) {
    const body = preview.data as {
      summary: { valid: number; invalid: number };
      rows: {
        status: string;
        errors: string[];
        normalized?: Record<string, unknown>;
      }[];
    };
    const validRows = body.rows
      .filter((r) => r.status === 'VALID')
      .map((r) => r.normalized!);
    if (body.summary.valid >= 1) {
      log(
        'pass',
        'bulk-preview',
        `Bulk preview: ${body.summary.valid} valid, ${body.summary.invalid} invalid`,
      );
      const commitForm = new FormData();
      commitForm.append('rows', JSON.stringify(validRows));
      commitForm.append('zip', new Blob([zipBuf]), 'bulk.zip');
      const commitRes = await fetch(
        `${API_BASE}/v1/question-bank/bulk/commit`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'X-Tenant-Slug': TENANT_SLUG,
          },
          body: commitForm,
        },
      );
      if (commitRes.status === 200 || commitRes.status === 201) {
        const commitBody = unwrap<{ imported: number }>(await commitRes.json());
        log(
          commitBody.imported >= 1 ? 'pass' : 'fail',
          'bulk-commit',
          `Bulk commit imported ${commitBody.imported} paper(s)`,
        );
      } else {
        log(
          'fail',
          'bulk-commit',
          `Bulk commit → ${commitRes.status}: ${(await commitRes.text()).slice(0, 200)}`,
        );
      }
    } else {
      log(
        'fail',
        'bulk-preview',
        `Bulk preview: 0 valid — ${body.rows.map((r) => r.errors.join('; ')).join(' | ')}`,
      );
    }
  } else {
    log(
      'fail',
      'bulk-preview',
      `Bulk preview → ${preview.status}: ${String(preview.data).slice(0, 200)}`,
    );
  }

  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  return finish();
}

function finish() {
  const passed = checks.filter((c) => c.level === 'pass').length;
  const warned = checks.filter((c) => c.level === 'warn').length;
  const failed = checks.filter((c) => c.level === 'fail').length;

  console.log('\n══════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${warned} warned, ${failed} failed`);
  console.log('══════════════════════════════════════\n');

  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
