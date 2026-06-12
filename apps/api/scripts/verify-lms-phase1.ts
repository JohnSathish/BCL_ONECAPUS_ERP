/**
 * Phase 1 LMS smoke test — permissions, HTTP login, and key API routes.
 *
 *   npm run verify:lms-phase1 -w api
 *   npm run verify:lms-phase1 -w api -- --api=http://127.0.0.1:3001/api
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@demo.edu';
const ADMIN_PASSWORD = 'Admin@123';
const STUDENT_PASSWORD = 'Student@123';

const REQUIRED_ADMIN_LMS = [
  'lms:read',
  'lms:manage',
  'lms:workspace:manage',
  'lms:materials:upload',
  'lms:materials:publish',
  'lms:analytics:read',
  'lms:settings:manage',
];

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';
const apiBase = (readArg('api') ?? 'http://127.0.0.1:3001/api').replace(
  /\/$/,
  '',
);

type Check = { level: 'pass' | 'fail' | 'warn'; code: string; message: string };
const checks: Check[] = [];

function push(level: Check['level'], code: string, message: string) {
  checks.push({ level, code, message });
  const tag = level === 'pass' ? 'PASS' : level === 'warn' ? 'WARN' : 'FAIL';
  console.log(`${tag} — ${code}: ${message}`);
}

function unwrapData<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'data' in body) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function solveChallengeExpression(expression: string): number {
  const normalized = expression.replace(/×/g, '*').replace(/x/gi, '*').trim();
  const match = normalized.match(/^(-?\d+)\s*([+\-*])\s*(-?\d+)$/);
  if (!match)
    throw new Error(`Cannot parse challenge expression: ${expression}`);
  const a = Number(match[1]);
  const op = match[2];
  const b = Number(match[3]);
  if (op === '+') return a + b;
  if (op === '-') return a - b;
  return a * b;
}

async function login(email: string, password: string): Promise<string> {
  const challengeRes = await fetch(`${apiBase}/v1/auth/challenge`);
  if (!challengeRes.ok) {
    throw new Error(`challenge HTTP ${challengeRes.status}`);
  }
  const challengeRaw = await challengeRes.json();
  const challenge = unwrapData<{ token: string; expression: string }>(
    challengeRaw,
  );
  const loginRes = await fetch(`${apiBase}/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Slug': tenantSlug,
    },
    body: JSON.stringify({
      email,
      password,
      challengeToken: challenge.token,
      challengeAnswer: solveChallengeExpression(challenge.expression),
      rememberMe: false,
    }),
  });
  if (!loginRes.ok) {
    const body = await loginRes.text();
    throw new Error(`login HTTP ${loginRes.status}: ${body.slice(0, 200)}`);
  }
  const sessionRaw = await loginRes.json();
  const session = unwrapData<{ accessToken: string }>(sessionRaw);
  if (!session.accessToken) {
    throw new Error('login response missing accessToken');
  }
  return session.accessToken;
}

async function getJson<T>(
  token: string,
  path: string,
): Promise<{ status: number; body: T | string }> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': tenantSlug,
      Accept: 'application/json',
    },
  });
  const text = await res.text();
  try {
    const parsed = JSON.parse(text) as unknown;
    return { status: res.status, body: unwrapData<T>(parsed) };
  } catch {
    return { status: res.status, body: text };
  }
}

async function verifyDbPermissions(tenantId: string) {
  const admin = await prisma.user.findFirst({
    where: { tenantId, email: ADMIN_EMAIL },
    include: {
      roles: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });
  if (!admin) {
    push('fail', 'db_admin', `User not found: ${ADMIN_EMAIL}`);
    return;
  }

  const slugs = new Set(
    admin.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.slug),
    ),
  );
  const missing = REQUIRED_ADMIN_LMS.filter((p) => !slugs.has(p));
  if (missing.length === 0) {
    push(
      'pass',
      'db_admin_lms',
      `college-admin has all ${REQUIRED_ADMIN_LMS.length} LMS permissions`,
    );
  } else {
    push(
      'fail',
      'db_admin_lms',
      `Missing permissions: ${missing.join(', ')} — run npm run db:seed -w api`,
    );
  }
}

async function verifyHttpAdmin() {
  let token: string;
  try {
    token = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    push('pass', 'http_admin_login', `${ADMIN_EMAIL} login OK`);
  } catch (err) {
    push('fail', 'http_admin_login', String(err));
    return;
  }

  const dash = await getJson<Record<string, unknown>>(
    token,
    '/v1/lms/dashboard/admin',
  );
  if (dash.status === 200) {
    push('pass', 'http_admin_dashboard', 'GET /lms/dashboard/admin → 200');
  } else {
    push(
      'fail',
      'http_admin_dashboard',
      `GET /lms/dashboard/admin → ${dash.status} (re-login after seed if 403)`,
    );
  }

  const workspaces = await getJson<{ items?: unknown[]; total?: number }>(
    token,
    '/v1/lms/workspaces?limit=8',
  );
  if (workspaces.status === 200) {
    const total =
      typeof workspaces.body === 'object' &&
      workspaces.body &&
      'total' in workspaces.body
        ? (workspaces.body as { total?: number }).total
        : undefined;
    push(
      'pass',
      'http_admin_workspaces',
      `GET /lms/workspaces → 200 (${total ?? '?'} workspaces)`,
    );
  } else {
    push(
      'fail',
      'http_admin_workspaces',
      `GET /lms/workspaces → ${workspaces.status}`,
    );
  }

  const settings = await getJson<unknown>(token, '/v1/lms/settings');
  if (settings.status === 200) {
    push('pass', 'http_admin_settings', 'GET /lms/settings → 200');
  } else {
    push(
      'fail',
      'http_admin_settings',
      `GET /lms/settings → ${settings.status}`,
    );
  }
}

async function verifyHttpStudent(tenantId: string) {
  const student = await prisma.student.findFirst({
    where: { tenantId, enrollmentNumber: 'APP-2026-0001', deletedAt: null },
    include: { user: { select: { email: true } } },
  });
  if (!student?.user?.email) {
    push('fail', 'http_student_setup', 'APP-2026-0001 has no portal user');
    return;
  }

  let token: string;
  try {
    token = await login(student.user.email, STUDENT_PASSWORD);
    push('pass', 'http_student_login', `${student.user.email} login OK`);
  } catch (err) {
    push('fail', 'http_student_login', String(err));
    return;
  }

  const portal = await getJson<{ workspaces?: unknown[] }>(
    token,
    '/v1/lms/me/workspaces',
  );
  if (portal.status === 200) {
    const count =
      typeof portal.body === 'object' &&
      portal.body &&
      'workspaces' in portal.body
        ? (portal.body as { workspaces?: unknown[] }).workspaces?.length
        : undefined;
    push(
      'pass',
      'http_student_workspaces',
      `GET /lms/me/workspaces → 200 (${count ?? '?'} accessible)`,
    );
  } else {
    push(
      'fail',
      'http_student_workspaces',
      `GET /lms/me/workspaces → ${portal.status}`,
    );
  }

  const dashboard = await getJson<unknown>(token, '/v1/lms/me/dashboard');
  if (dashboard.status === 200) {
    push('pass', 'http_student_dashboard', 'GET /lms/me/dashboard → 200');
  } else {
    push(
      'fail',
      'http_student_dashboard',
      `GET /lms/me/dashboard → ${dashboard.status}`,
    );
  }
}

async function verifyHttpFaculty(tenantId: string) {
  const staff = await prisma.staffProfile.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      portalUserId: { not: null },
      subjectTeachingAssignments: {
        some: { deletedAt: null, canAccessSubjectWorkspace: true },
      },
    },
    include: {
      portalUser: { select: { email: true } },
      subjectTeachingAssignments: {
        where: { deletedAt: null, canAccessSubjectWorkspace: true },
        take: 1,
        include: {
          offeringSection: {
            select: {
              lmsWorkspace: {
                select: { id: true, status: true, deletedAt: true },
              },
            },
          },
          courseOffering: {
            select: {
              lmsPoolWorkspaces: {
                where: { deletedAt: null, status: 'ACTIVE' },
                take: 1,
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  if (!staff?.portalUser?.email) {
    push(
      'warn',
      'http_faculty_setup',
      'No staff with portal login + teaching assignment — skip faculty HTTP checks',
    );
    return;
  }

  let token: string;
  try {
    token = await login(staff.portalUser.email, ADMIN_PASSWORD);
    push('pass', 'http_faculty_login', `${staff.portalUser.email} login OK`);
  } catch (err) {
    push(
      'warn',
      'http_faculty_login',
      `${staff.portalUser.email}: ${err} (try Admin@123 or set faculty password in seed)`,
    );
    return;
  }

  const portal = await getJson<{ workspaces?: unknown[] }>(
    token,
    '/v1/lms/me/workspaces',
  );
  if (portal.status === 200) {
    const count =
      typeof portal.body === 'object' &&
      portal.body &&
      'workspaces' in portal.body
        ? (portal.body as { workspaces?: unknown[] }).workspaces?.length
        : undefined;
    push(
      count && count > 0 ? 'pass' : 'warn',
      'http_faculty_workspaces',
      `GET /lms/me/workspaces → 200 (${count ?? 0} assigned)`,
    );
  } else {
    push(
      'fail',
      'http_faculty_workspaces',
      `GET /lms/me/workspaces → ${portal.status}`,
    );
  }

  const assignment = staff.subjectTeachingAssignments[0];
  const sectionWs = assignment?.offeringSection?.lmsWorkspace;
  const workspaceId =
    sectionWs && sectionWs.deletedAt == null && sectionWs.status === 'ACTIVE'
      ? sectionWs.id
      : assignment?.courseOffering?.lmsPoolWorkspaces[0]?.id;

  if (workspaceId) {
    const attendance = await getJson<unknown>(
      token,
      `/v1/lms/workspaces/${workspaceId}/attendance`,
    );
    if (attendance.status === 200) {
      push('pass', 'http_faculty_attendance', `GET workspace attendance → 200`);
    } else {
      push(
        'fail',
        'http_faculty_attendance',
        `GET workspace attendance → ${attendance.status}`,
      );
    }
  } else {
    push(
      'warn',
      'http_faculty_attendance',
      'No LMS workspace linked to faculty assignment',
    );
  }
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const workspaceCount = await prisma.lmsWorkspace.count({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
  });

  console.log(
    `LMS Phase 1 verification — tenant=${tenantSlug}, api=${apiBase}, workspaces=${workspaceCount}\n`,
  );

  if (workspaceCount === 0) {
    push(
      'fail',
      'workspaces',
      'No workspaces — run: npm run provision:lms-workspaces -w api',
    );
  } else {
    push('pass', 'workspaces', `${workspaceCount} active workspace(s)`);
  }

  console.log('\n--- Database permissions ---');
  await verifyDbPermissions(tenant.id);

  console.log('\n--- HTTP smoke (requires API on :3001) ---');
  await verifyHttpAdmin();
  await verifyHttpStudent(tenant.id);
  await verifyHttpFaculty(tenant.id);

  const failed = checks.filter((c) => c.level === 'fail').length;
  const warned = checks.filter((c) => c.level === 'warn').length;
  const passed = checks.filter((c) => c.level === 'pass').length;

  console.log(`\n${passed} passed, ${warned} warned, ${failed} failed`);
  if (failed > 0) {
    console.log(
      '\nIf admin endpoints return 403: log out and sign in again after db:seed.',
    );
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
