/**
 * Smart Library Phase 2 — Digital Library + Research Repository smoke test.
 *
 *   npm run verify:library-phase2 -w api
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

const MIN_PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\nxref\n0 0\ntrailer<</Size 0/Root 1 0 R>>\nstartxref\n0\n%%EOF',
);

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

async function apiMultipart<T>(
  token: string,
  path: string,
  fields: Record<string, string>,
  file?: { name: string; buffer: Buffer; mime: string },
): Promise<{ status: number; data: T | string }> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) {
    form.append(
      'file',
      new Blob([file.buffer], { type: file.mime }),
      file.name,
    );
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': TENANT_SLUG,
      Accept: 'application/json',
    },
    body: form,
  });
  const text = await res.text();
  try {
    return { status: res.status, data: unwrap<T>(JSON.parse(text)) };
  } catch {
    return { status: res.status, data: text };
  }
}

async function main() {
  console.log('\n=== Smart Library Phase 2 Verification ===\n');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  if (!tenant) {
    log('fail', 'tenant', 'Demo tenant not found — run seed');
    process.exit(1);
  }

  let adminToken: string;
  let studentToken = '';

  try {
    adminToken = await login('admin@demo.edu', PASSWORD);
    log('pass', 'login', 'Admin login');
  } catch (e) {
    log('fail', 'login', `Admin: ${String(e)}`);
    process.exit(1);
  }

  const student = await prisma.student.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    include: { masterProfile: true },
  });
  if (student?.userId) {
    const studentUser = await prisma.user.findUnique({
      where: { id: student.userId },
    });
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
        }
      }
    }
  }

  const footfall = await apiJson<{ weekly: unknown[] }>(
    adminToken,
    'GET',
    '/v1/library/analytics/footfall',
  );
  if (footfall.status === 200)
    log('pass', 'analytics', 'Footfall trends endpoint');
  else log('fail', 'analytics', `Footfall status ${footfall.status}`);

  const stamp = Date.now();
  const digitalCreate = await apiMultipart<{ id: string; status: string }>(
    adminToken,
    '/v1/library/digital-assets',
    { title: `Phase2 Digital ${stamp}`, author: 'Verifier', assetType: 'PDF' },
    { name: 'test.pdf', buffer: MIN_PDF, mime: 'application/pdf' },
  );
  let digitalId = '';
  if (digitalCreate.status === 200 || digitalCreate.status === 201) {
    digitalId = (digitalCreate.data as { id: string }).id;
    log('pass', 'digital', `Digital asset created (${digitalId.slice(0, 8)}…)`);
  } else {
    log(
      'fail',
      'digital',
      `Create failed: ${digitalCreate.status} ${JSON.stringify(digitalCreate.data).slice(0, 200)}`,
    );
  }

  if (digitalId) {
    const publish = await apiJson(
      adminToken,
      'POST',
      `/v1/library/digital-assets/${digitalId}/publish`,
    );
    if (publish.status === 200 || publish.status === 201)
      log('pass', 'digital', 'Digital asset published');
    else log('fail', 'digital', `Publish status ${publish.status}`);

    const list = await apiJson<{ items: { id: string }[]; total: number }>(
      adminToken,
      'GET',
      '/v1/library/digital-assets?limit=5',
    );
    if (list.status === 200 && (list.data as { total: number }).total >= 1)
      log('pass', 'digital', 'Digital asset list');
    else log('fail', 'digital', `List status ${list.status}`);

    const dl = await fetch(
      `${API_BASE}/v1/library/digital-assets/${digitalId}/download`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'X-Tenant-Slug': TENANT_SLUG,
        },
      },
    );
    if (dl.ok && (await dl.arrayBuffer()).byteLength > 0)
      log('pass', 'digital', 'Digital download stream');
    else log('fail', 'digital', `Download status ${dl.status}`);

    if (studentToken) {
      const studentList = await apiJson<{ items: unknown[] }>(
        studentToken,
        'GET',
        '/v1/library/digital-assets?limit=5',
      );
      if (studentList.status === 200)
        log('pass', 'rbac', 'Student can list published digital assets');
      else
        log(
          'warn',
          'rbac',
          `Student digital list status ${studentList.status}`,
        );

      const studentCreate = await apiMultipart(
        studentToken,
        '/v1/library/digital-assets',
        { title: 'Should fail', assetType: 'PDF' },
      );
      if (studentCreate.status === 403)
        log('pass', 'rbac', 'Student blocked from digital manage');
      else
        log(
          'warn',
          'rbac',
          `Student create digital status ${studentCreate.status}`,
        );
    }
  }

  const qbSync = await apiJson<{ synced?: number }>(
    adminToken,
    'POST',
    '/v1/library/digital-assets/sync/question-bank',
  );
  if (qbSync.status === 200 || qbSync.status === 201) {
    log(
      'pass',
      'question-bank',
      `QB sync OK (synced: ${(qbSync.data as { synced?: number }).synced ?? 0})`,
    );
  } else {
    log('warn', 'question-bank', `QB sync status ${qbSync.status}`);
  }

  const researchCreate = await apiMultipart<{ id: string; status: string }>(
    adminToken,
    '/v1/library/research',
    {
      title: `Phase2 Thesis ${stamp}`,
      itemType: 'THESIS',
      abstract: 'Verification abstract',
    },
    { name: 'thesis.pdf', buffer: MIN_PDF, mime: 'application/pdf' },
  );
  let researchId = '';
  if (researchCreate.status === 200 || researchCreate.status === 201) {
    researchId = (researchCreate.data as { id: string }).id;
    log(
      'pass',
      'research',
      `Research item created (${researchId.slice(0, 8)}…)`,
    );
  } else {
    log(
      'fail',
      'research',
      `Create failed: ${researchCreate.status} ${JSON.stringify(researchCreate.data).slice(0, 200)}`,
    );
  }

  if (researchId) {
    const submit = await apiJson(
      adminToken,
      'POST',
      `/v1/library/research/${researchId}/submit`,
    );
    if (submit.status === 200 || submit.status === 201)
      log('pass', 'research', 'Research submitted');
    else log('fail', 'research', `Submit status ${submit.status}`);

    const review = await apiJson(
      adminToken,
      'POST',
      `/v1/library/research/${researchId}/review`,
      {
        action: 'APPROVE',
        comments: 'Phase2 verify',
      },
    );
    if (review.status === 200 || review.status === 201)
      log('pass', 'research', 'Research approved');
    else log('fail', 'research', `Review status ${review.status}`);

    const pending = await apiJson<unknown[]>(
      adminToken,
      'GET',
      '/v1/library/research/pending',
    );
    if (pending.status === 200) log('pass', 'research', 'Pending review list');
    else log('fail', 'research', `Pending status ${pending.status}`);

    const rdl = await fetch(
      `${API_BASE}/v1/library/research/${researchId}/download`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'X-Tenant-Slug': TENANT_SLUG,
        },
      },
    );
    if (rdl.ok && (await rdl.arrayBuffer()).byteLength > 0)
      log('pass', 'research', 'Research download stream');
    else log('fail', 'research', `Download status ${rdl.status}`);
  }

  const digitalReport = await apiJson(
    adminToken,
    'GET',
    '/v1/library/reports/digital/downloads',
  );
  if (digitalReport.status === 200)
    log('pass', 'reports', 'Digital download report');
  else log('fail', 'reports', `Digital report status ${digitalReport.status}`);

  const researchReport = await apiJson(
    adminToken,
    'GET',
    '/v1/library/reports/research/usage',
  );
  if (researchReport.status === 200)
    log('pass', 'reports', 'Research usage report');
  else
    log('fail', 'reports', `Research report status ${researchReport.status}`);

  const csvRes = await fetch(
    `${API_BASE}/v1/library/reports/export/department-visitors.csv`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-Slug': TENANT_SLUG,
      },
    },
  );
  const csvText = await csvRes.text();
  if (csvRes.ok && csvText.includes(','))
    log('pass', 'reports', 'Department visitors CSV export');
  else log('fail', 'reports', `CSV export status ${csvRes.status}`);

  const dash = await apiJson<{
    digitalAssets?: number;
    researchItems?: number;
  }>(adminToken, 'GET', '/v1/library/dashboard');
  if (dash.status === 200) {
    const d = dash.data as { digitalAssets?: number; researchItems?: number };
    if (
      typeof d.digitalAssets === 'number' &&
      typeof d.researchItems === 'number'
    ) {
      log(
        'pass',
        'dashboard',
        `Dashboard KPIs (digital: ${d.digitalAssets}, research: ${d.researchItems})`,
      );
    } else {
      log('warn', 'dashboard', 'Dashboard OK but Phase 2 KPI fields missing');
    }
  } else {
    log('fail', 'dashboard', `Status ${dash.status}`);
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
