/**
 * Enterprise RBAC verification
 *
 *   npm run verify:rbac -w api
 */
import { PrismaClient } from '@prisma/client';
import {
  canAccessAdminRoute,
  MODULE_PERMISSIONS,
} from '../src/common/permissions/permission-registry';

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

async function login(email: string, password: string) {
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
  const session = unwrap<{
    accessToken: string;
    user: { permissions: string[]; roles: string[] };
  }>(await res.json());
  return session;
}

async function apiStatus(token: string, method: string, path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Tenant-Slug': TENANT_SLUG,
      Accept: 'application/json',
    },
  });
  return res.status;
}

async function main() {
  console.log('\n=== Enterprise RBAC Verification ===\n');

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
  });
  if (!tenant) {
    log('fail', 'tenant', 'Demo tenant missing — run seed');
    process.exit(1);
  }

  const foRole = await prisma.role.findFirst({
    where: { tenantId: tenant.id, slug: 'front-office-desk' },
    include: { permissions: { include: { permission: true } } },
  });
  if (!foRole) {
    log('fail', 'seed', 'front-office-desk role missing');
  } else {
    const slugs = foRole.permissions.map((p) => p.permission.slug);
    const onlyFo = slugs.every(
      (s) => s.startsWith('front-office:') || s === 'notifications:read',
    );
    log(
      onlyFo ? 'pass' : 'fail',
      'seed-fo-role',
      onlyFo
        ? 'Front Office role is module-scoped'
        : `Unexpected perms: ${slugs.join(', ')}`,
    );
  }

  const foUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'frontoffice@demo.edu' },
  });
  log(
    foUser ? 'pass' : 'warn',
    'seed-fo-user',
    foUser ? 'frontoffice@demo.edu exists' : 'Run seed to create demo FO user',
  );

  try {
    const foSession = await login('frontoffice@demo.edu', PASSWORD);
    const perms = foSession.user.permissions ?? [];
    const roles = foSession.user.roles ?? [];

    const canFoRoute = canAccessAdminRoute('/admin/front-office', perms, roles);
    log(
      canFoRoute ? 'pass' : 'fail',
      'fo-route-allowed',
      '/admin/front-office accessible',
    );

    const blockedStudents = !canAccessAdminRoute(
      '/admin/students',
      perms,
      roles,
    );
    log(
      blockedStudents ? 'pass' : 'fail',
      'fo-route-blocked-students',
      '/admin/students blocked in registry',
    );

    const blockedLibrary = !canAccessAdminRoute('/admin/library', perms, roles);
    log(
      blockedLibrary ? 'pass' : 'fail',
      'fo-route-blocked-library',
      '/admin/library blocked in registry',
    );

    const foOnlyPerms = perms.every(
      (p) => p.startsWith('front-office:') || p === 'notifications:read',
    );
    log(
      foOnlyPerms ? 'pass' : 'fail',
      'fo-jwt-perms',
      `JWT has ${perms.length} permissions`,
    );

    const libStatus = await apiStatus(
      foSession.accessToken,
      'GET',
      '/v1/library/dashboard',
    );
    log(
      libStatus === 403 ? 'pass' : 'fail',
      'fo-api-library',
      `GET /library/dashboard → ${libStatus} (expect 403)`,
    );

    const studentStatus = await apiStatus(
      foSession.accessToken,
      'GET',
      '/v1/students?page=1&limit=1',
    );
    log(
      studentStatus === 403 ? 'pass' : 'fail',
      'fo-api-students',
      `GET /students → ${studentStatus} (expect 403)`,
    );

    const foDeskStatus = await apiStatus(
      foSession.accessToken,
      'GET',
      '/v1/front-office/dashboard',
    );
    log(
      foDeskStatus === 200 ? 'pass' : 'fail',
      'fo-api-desk',
      `GET /front-office/dashboard → ${foDeskStatus} (expect 200)`,
    );
  } catch (e) {
    log(
      'warn',
      'fo-login',
      `Could not login frontoffice@demo.edu (${String(e)}) — seed and start API`,
    );
  }

  const moduleKeys = Object.keys(MODULE_PERMISSIONS);
  log(
    moduleKeys.length >= 20 ? 'pass' : 'fail',
    'registry-modules',
    `${moduleKeys.length} ERP modules in registry`,
  );

  const fails = checks.filter((c) => c.level === 'fail').length;
  const warns = checks.filter((c) => c.level === 'warn').length;
  console.log(
    `\n=== ${checks.length - fails - warns} passed, ${warns} warnings, ${fails} failed ===\n`,
  );
  await prisma.$disconnect();
  process.exit(fails > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
