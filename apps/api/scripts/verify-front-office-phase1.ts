/**
 * Front Office Phase 1 — enquiries, gate passes, complaints.
 *
 *   npm run verify:front-office-phase1 -w api
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
  console.log('\n=== Front Office Phase 1 Verification ===\n');

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

  const dash = await apiJson<{ todayEnquiries: number }>(
    token,
    'GET',
    '/v1/front-office/dashboard',
  );
  if (dash.status === 200) log('pass', 'dashboard', 'Dashboard KPIs');
  else log('fail', 'dashboard', `Status ${dash.status}`);

  const stamp = Date.now();
  const enquiry = await apiJson<{ id: string; enquiryNo: string }>(
    token,
    'POST',
    '/v1/front-office/enquiries',
    {
      enquiryType: 'ADMISSION',
      fullName: `Verify Enquiry ${stamp}`,
      mobile: '9876543210',
      programmeInterest: 'BSc CS',
      source: 'WALK_IN',
    },
  );
  if (enquiry.status === 200 || enquiry.status === 201) {
    log(
      'pass',
      'enquiries',
      `Created ${(enquiry.data as { enquiryNo: string }).enquiryNo}`,
    );
    const upd = await apiJson(
      token,
      'PATCH',
      `/v1/front-office/enquiries/${(enquiry.data as { id: string }).id}`,
      {
        status: 'IN_PROGRESS',
      },
    );
    if (upd.status === 200) log('pass', 'enquiries', 'Status update');
    else log('fail', 'enquiries', `Update status ${upd.status}`);
  } else {
    log('fail', 'enquiries', `Create status ${enquiry.status}`);
  }

  const pass = await apiJson<{ id: string; passNumber: string }>(
    token,
    'POST',
    '/v1/front-office/gate-passes',
    {
      visitorName: `Verify Visitor ${stamp}`,
      mobile: '9123456789',
      hostName: 'Principal Office',
      purpose: 'Meeting',
    },
  );
  let passId = '';
  let passNumber = '';
  if (pass.status === 200 || pass.status === 201) {
    passId = (pass.data as { id: string }).id;
    passNumber = (pass.data as { passNumber: string }).passNumber;
    log('pass', 'gate-pass', `Issued ${passNumber}`);
    const lookup = await apiJson(
      token,
      'GET',
      `/v1/front-office/gate-passes/lookup/${encodeURIComponent(passNumber)}`,
    );
    if (lookup.status === 200)
      log('pass', 'gate-pass', 'Lookup by pass number');
    else log('fail', 'gate-pass', `Lookup status ${lookup.status}`);
    const cin = await apiJson(
      token,
      'POST',
      `/v1/front-office/gate-passes/${passId}/check-in`,
    );
    if (cin.status === 200 || cin.status === 201)
      log('pass', 'gate-pass', 'Check in');
    else log('fail', 'gate-pass', `Check-in status ${cin.status}`);
    const cout = await apiJson(
      token,
      'POST',
      `/v1/front-office/gate-passes/${passId}/check-out`,
    );
    if (cout.status === 200 || cout.status === 201)
      log('pass', 'gate-pass', 'Check out');
    else log('fail', 'gate-pass', `Check-out status ${cout.status}`);
  } else {
    log('fail', 'gate-pass', `Create status ${pass.status}`);
  }

  const complaint = await apiJson<{ id: string; ticketNo: string }>(
    token,
    'POST',
    '/v1/front-office/complaints',
    {
      category: 'FACILITY',
      priority: 'HIGH',
      complainantName: `Verify Complainant ${stamp}`,
      subject: 'Water supply issue',
      description: 'Phase 1 verification complaint',
    },
  );
  if (complaint.status === 200 || complaint.status === 201) {
    log(
      'pass',
      'complaints',
      `Created ${(complaint.data as { ticketNo: string }).ticketNo}`,
    );
    const resolve = await apiJson(
      token,
      'PATCH',
      `/v1/front-office/complaints/${(complaint.data as { id: string }).id}`,
      {
        status: 'RESOLVED',
        resolution: 'Verified',
      },
    );
    if (resolve.status === 200) log('pass', 'complaints', 'Resolve complaint');
    else log('fail', 'complaints', `Resolve status ${resolve.status}`);
  } else {
    log('fail', 'complaints', `Create status ${complaint.status}`);
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
