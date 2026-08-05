/**
 * Provision Shift In-Charge (ERP) accounts on a tenant:
 *   office3.a@donboscocollege.ac.in → DAY
 *   office3.b@donboscocollege.ac.in → DAY
 *   msadmin@donboscocollege.ac.in     → MORNING
 *
 * Also syncs the shift-admin role name + permissions (expanded / hardened).
 *
 * Default = dry-run. Apply with CONFIRM=YES or --apply.
 *
 *   cd apps/api
 *   npx tsx scripts/ops-create-shift-incharge-accounts.ts --tenant=demo
 *   CONFIRM=YES npx tsx scripts/ops-create-shift-incharge-accounts.ts --tenant=demo
 */
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const apply = process.env.CONFIRM === 'YES' || process.argv.includes('--apply');
const tenantSlug = readArg('tenant') ?? process.env.TENANT_SLUG ?? 'demo';
const passwordOverride = readArg('password') ?? process.env.TEMP_PASSWORD;

const ACCOUNTS: Array<{ email: string; shiftCode: string; label: string }> = [
  {
    email: 'office3.a@donboscocollege.ac.in',
    shiftCode: 'DAY',
    label: 'Day Shift In-Charge (ERP)',
  },
  {
    email: 'office3.b@donboscocollege.ac.in',
    shiftCode: 'DAY',
    label: 'Day Shift In-Charge (ERP)',
  },
  {
    email: 'msadmin@donboscocollege.ac.in',
    shiftCode: 'MORNING',
    label: 'Morning Shift In-Charge (ERP)',
  },
];

const SHIFT_ADMIN_PERMISSIONS = [
  'shift:read',
  'shift:students:read',
  'shift:students:manage',
  'shift:timetable:manage',
  'shift:attendance:manage',
  'shift:exams:manage',
  'shift:reports:read',
  'students:read',
  'academic-engine:read',
  'reports:read',
  'staff:read',
  'staff-attendance:view',
  'staff-attendance:shift-admin',
  'staff-attendance:leave-admin',
  'communication:read',
  'communication:manage',
  'student-attendance:view',
  'student-attendance:admin',
] as const;

const EXTRA_PERMISSIONS: Array<{
  slug: string;
  resource: string;
  action: string;
  description: string;
}> = [
  {
    slug: 'student-attendance:view',
    resource: 'student-attendance',
    action: 'view',
    description: 'View student attendance sessions and records',
  },
  {
    slug: 'student-attendance:admin',
    resource: 'student-attendance',
    action: 'admin',
    description: 'Administer student attendance for assigned scope',
  },
];

function generateTempPassword(length = 14): string {
  const alphabet =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

async function ensurePermissions() {
  for (const p of EXTRA_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { slug: p.slug },
      update: { description: p.description },
      create: p,
    });
  }
}

async function syncShiftAdminRole(tenantId: string) {
  let role = await prisma.role.findFirst({
    where: { tenantId, slug: 'shift-admin', deletedAt: null },
  });

  const perms = await prisma.permission.findMany({
    where: { slug: { in: [...SHIFT_ADMIN_PERMISSIONS] } },
  });
  const found = new Set(perms.map((p) => p.slug));
  const missing = SHIFT_ADMIN_PERMISSIONS.filter((s) => !found.has(s));
  if (missing.length) {
    console.log(
      `WARN missing permission rows (skipped): ${missing.join(', ')}`,
    );
  }

  if (!apply) {
    console.log(
      `DRY-RUN would sync shift-admin${role ? '' : ' (create role)'} → "Shift In-Charge (ERP)" with ${perms.length} permissions` +
        ` (remove shift:manage if present)`,
    );
    if (!role) {
      // Placeholder id only for dry-run path; provisionAccount dry-run ignores roleId writes.
      role = { id: 'dry-run' } as typeof role & { id: string };
    }
    return role!;
  }

  role = await prisma.role.upsert({
    where: { tenantId_slug: { tenantId, slug: 'shift-admin' } },
    update: { name: 'Shift In-Charge (ERP)', deletedAt: null },
    create: {
      tenantId,
      slug: 'shift-admin',
      name: 'Shift In-Charge (ERP)',
      isSystem: true,
    },
  });

  await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  for (const perm of perms) {
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: perm.id },
    });
  }
  console.log(
    `Synced shift-admin role (${role.id}): ${perms.length} permissions`,
  );
  return role;
}

async function provisionAccount(
  tenantId: string,
  roleId: string,
  email: string,
  shiftCode: string,
  label: string,
  passwordHash: string,
) {
  const shift = await prisma.shift.findFirst({
    where: {
      tenantId,
      code: { equals: shiftCode, mode: 'insensitive' },
      deletedAt: null,
    },
    select: { id: true, code: true, name: true },
  });
  if (!shift) {
    console.log(`FAIL ${email}: shift ${shiftCode} not found`);
    return false;
  }

  const existing = await prisma.user.findFirst({
    where: { tenantId, email: { equals: email, mode: 'insensitive' } },
    select: { id: true, isActive: true, deletedAt: true },
  });

  if (!apply) {
    console.log(
      `DRY-RUN would ${existing ? 'update' : 'create'} ${email} → ${shift.name} (${shift.code}) as ${label}`,
    );
    return true;
  }

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          email: email.toLowerCase(),
          passwordHash,
          isActive: true,
          deletedAt: null,
          mustResetPassword: true,
          emailVerifiedAt: new Date(),
        },
      })
    : await prisma.user.create({
        data: {
          tenantId,
          email: email.toLowerCase(),
          passwordHash,
          isActive: true,
          mustResetPassword: true,
          emailVerifiedAt: new Date(),
        },
      });

  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId, deletedAt: null },
  });
  if (!existingRole) {
    await prisma.userRole.create({ data: { userId: user.id, roleId } });
  }

  await prisma.userShiftAssignment.updateMany({
    where: { userId: user.id },
    data: { isPrimary: false },
  });
  const existingAssign = await prisma.userShiftAssignment.findFirst({
    where: { userId: user.id, shiftId: shift.id },
  });
  if (existingAssign) {
    await prisma.userShiftAssignment.update({
      where: { id: existingAssign.id },
      data: { isPrimary: true },
    });
  } else {
    await prisma.userShiftAssignment.create({
      data: { userId: user.id, shiftId: shift.id, isPrimary: true },
    });
  }

  console.log(`OK ${email} → ${shift.code} (${label})`);
  return true;
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug.toLowerCase(), deletedAt: null },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  console.log(
    `Shift In-Charge accounts — tenant=${tenant.slug} mode=${apply ? 'APPLY' : 'DRY-RUN'}`,
  );

  if (apply) await ensurePermissions();
  else console.log('DRY-RUN would ensure student-attendance permission rows');

  const role = await syncShiftAdminRole(tenant.id);
  const tempPassword = passwordOverride?.trim() || generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  let ok = 0;
  for (const row of ACCOUNTS) {
    const success = await provisionAccount(
      tenant.id,
      role.id,
      row.email,
      row.shiftCode,
      row.label,
      passwordHash,
    );
    if (success) ok += 1;
  }

  console.log(`\nAccounts processed: ${ok}/${ACCOUNTS.length}`);
  if (!apply) {
    console.log(
      'Dry-run complete. Re-run with CONFIRM=YES (or --apply) to write.\n',
    );
  } else {
    console.log('\n=== ONE-TIME TEMPORARY PASSWORD (all three accounts) ===');
    console.log(tempPassword);
    console.log(
      'Users must change password on first login (mustResetPassword).',
    );
    console.log(
      'Login at ERP Admin portal: https://erp.donboscocollege.ac.in\n',
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
