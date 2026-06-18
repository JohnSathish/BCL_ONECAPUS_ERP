/**
 * BCL Smart Library Phase 4 — NAAC report bundle, multi-format export, IQAC evidence link.
 *
 *   npm run verify:smart-library-phase4 -w api
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
  console.log('\n=== BCL Smart Library Phase 4 Verification ===\n');

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

  const summary = await apiJson<{
    summary: { totalTitles: number };
    footfall: { totalVisits: number };
    departmentUsage: unknown[];
  }>(
    adminToken,
    'GET',
    `/v1/library/reports/naac/summary?from=${new Date().getFullYear()}-01-01`,
  );
  if (
    summary.status === 200 &&
    (summary.data as { summary: { totalTitles: number } }).summary
      ?.totalTitles != null
  ) {
    const d = summary.data as {
      summary: { totalTitles: number };
      footfall: { totalVisits: number };
    };
    log(
      'pass',
      'summary',
      `NAAC bundle titles=${d.summary.totalTitles} footfall=${d.footfall.totalVisits}`,
    );
  } else {
    log('fail', 'summary', `NAAC summary ${summary.status}`);
  }

  const pdfRes = await fetch(
    `${API_BASE}/v1/library/reports/naac/export?format=pdf&from=${new Date().getFullYear()}-01-01`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-Slug': TENANT_SLUG,
      },
    },
  );
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  if (pdfRes.ok && pdfBuf.length > 500) {
    log('pass', 'export-pdf', `PDF export ${pdfBuf.length} bytes`);
  } else {
    log(
      'fail',
      'export-pdf',
      `PDF export ${pdfRes.status} (${pdfBuf.length} bytes)`,
    );
  }

  const xlsxRes = await fetch(
    `${API_BASE}/v1/library/reports/naac/export?format=xlsx&from=${new Date().getFullYear()}-01-01`,
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Tenant-Slug': TENANT_SLUG,
      },
    },
  );
  const xlsxBuf = Buffer.from(await xlsxRes.arrayBuffer());
  if (xlsxRes.ok && xlsxBuf.length > 1000) {
    log('pass', 'export-xlsx', `Excel export ${xlsxBuf.length} bytes`);
  } else {
    log('fail', 'export-xlsx', `Excel export ${xlsxRes.status}`);
  }

  const link = await apiJson<{ tag: { id: string }; filename: string }>(
    adminToken,
    'POST',
    '/v1/library/reports/naac/link-evidence',
    {
      academicYear: '2025-26',
      from: `${new Date().getFullYear()}-01-01`,
      format: 'pdf',
      criterion: 4,
      metricCode: '4.2.1',
      evidenceNotes: 'Phase 4 verify script',
    },
  );
  if (link.status === 200 || link.status === 201) {
    log(
      'pass',
      'evidence',
      `IQAC tag ${(link.data as { tag: { id: string } }).tag.id.slice(0, 8)}…`,
    );
  } else {
    log(
      'fail',
      'evidence',
      `Link evidence ${link.status}: ${String(link.data).slice(0, 120)}`,
    );
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
