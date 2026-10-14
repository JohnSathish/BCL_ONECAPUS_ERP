/**
 * Create college staff portal logins.
 *
 * Username is the staff email. The temporary password comes from
 * STAFF_TEMP_PASSWORD. Each new or unused account must change that password
 * on first login. Accounts that have already signed in are left as they are.
 *
 * College StaffProfile only. Does not touch St. Luke's or TPS.
 *
 *   STAFF_TEMP_PASSWORD='…' TENANT_SLUG=demo npx tsx scripts/provision-staff-portal-logins.ts
 *   add --dry-run to list changes without writing
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

function roleFor(staffType: string): 'faculty' | 'staff' {
  if (
    staffType === 'TEACHING' ||
    staffType === 'GUEST' ||
    staffType === 'VISITING'
  ) {
    return 'faculty';
  }
  return 'staff';
}

function usableEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

async function main() {
  const password = process.env.STAFF_TEMP_PASSWORD?.trim() ?? '';
  if (password.length < 8) {
    throw new Error('Set STAFF_TEMP_PASSWORD to the temporary password.');
  }
  const slug = process.env.TENANT_SLUG?.trim() || 'demo';
  const tenant = await prisma.tenant.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, name: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${slug}`);

  const roles = await prisma.role.findMany({
    where: {
      tenantId: tenant.id,
      slug: { in: ['faculty', 'staff'] },
      deletedAt: null,
    },
    select: { id: true, slug: true },
  });
  const roleId = new Map(roles.map((role) => [role.slug, role.id]));
  if (!roleId.get('faculty') || !roleId.get('staff')) {
    throw new Error(
      'The faculty and staff roles must exist before logins are created.',
    );
  }

  const staff = await prisma.staffProfile.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      status: { in: ['ACTIVE', 'ON_LEAVE'] },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      mobile: true,
      staffType: true,
      portalUserId: true,
      primaryShiftId: true,
      campusId: true,
    },
    orderBy: { fullName: 'asc' },
  });

  const emailOwners = new Map<string, number>();
  for (const row of staff) {
    const email = usableEmail(row.email);
    if (!email) continue;
    emailOwners.set(email, (emailOwners.get(email) ?? 0) + 1);
  }

  const created: string[] = [];
  const reset: string[] = [];
  const already: string[] = [];
  const skipped: string[] = [];

  for (const row of staff) {
    const email = usableEmail(row.email);
    if (!email) {
      skipped.push(`${row.fullName}: no email address`);
      continue;
    }
    if ((emailOwners.get(email) ?? 0) > 1) {
      skipped.push(
        `${row.fullName}: email ${email} is used by more than one staff member`,
      );
      continue;
    }

    const taken = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [{ email }, { username: email }],
      },
      select: {
        id: true,
        email: true,
        username: true,
        lastLoginAt: true,
        mustResetPassword: true,
        student: { select: { id: true } },
        staffProfile: { select: { id: true } },
      },
    });
    if (
      taken &&
      taken.id !== row.portalUserId &&
      (taken.student ||
        (taken.staffProfile && taken.staffProfile.id !== row.id))
    ) {
      skipped.push(
        `${row.fullName}: ${email} already belongs to another login`,
      );
      continue;
    }

    const linked = row.portalUserId
      ? await prisma.user.findFirst({
          where: { id: row.portalUserId, tenantId: tenant.id, deletedAt: null },
          select: { id: true, lastLoginAt: true, mustResetPassword: true },
        })
      : null;
    const existing = linked ?? (taken && !taken.student ? taken : null);
    const signedIn =
      Boolean(existing?.lastLoginAt) && existing?.mustResetPassword === false;
    if (signedIn) {
      already.push(row.fullName);
      continue;
    }

    if (dryRun) {
      (existing ? reset : created).push(row.fullName);
      continue;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date();
    const userId = existing
      ? existing.id
      : (
          await prisma.user.create({
            data: {
              tenantId: tenant.id,
              email,
              username: email,
              phone: row.mobile?.trim() || null,
              displayName: row.fullName,
              passwordHash,
              emailVerifiedAt: now,
              isActive: true,
              accountStatus: 'active',
              passwordChangedAt: now,
              mustResetPassword: true,
            },
            select: { id: true },
          })
        ).id;

    if (existing) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          email,
          username: email,
          displayName: row.fullName,
          phone: row.mobile?.trim() || null,
          passwordHash,
          isActive: true,
          deletedAt: null,
          accountStatus: 'active',
          passwordChangedAt: now,
          mustResetPassword: true,
        },
      });
    }

    await prisma.passwordHistory.create({
      data: { userId, passwordHash },
    });

    const slugForRole = roleFor(row.staffType);
    const existingRole = await prisma.userRole.findFirst({
      where: {
        userId,
        roleId: roleId.get(slugForRole)!,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!existingRole) {
      await prisma.userRole.create({
        data: {
          userId,
          roleId: roleId.get(slugForRole)!,
          shiftId: row.primaryShiftId,
          campusId: row.campusId,
        },
      });
    }

    if (row.primaryShiftId) {
      await prisma.userShiftAssignment.upsert({
        where: {
          userId_shiftId: { userId, shiftId: row.primaryShiftId },
        },
        create: { userId, shiftId: row.primaryShiftId, isPrimary: true },
        update: { isPrimary: true },
      });
    }

    await prisma.staffProfile.update({
      where: { id: row.id },
      data: { portalUserId: userId, email },
    });

    (existing ? reset : created).push(row.fullName);
  }

  console.log(
    `${dryRun ? 'Dry run' : 'Done'} for ${tenant.name} (${tenant.slug})`,
  );
  console.log(`Created: ${created.length}`);
  console.log(`Temporary password set, change required: ${reset.length}`);
  console.log(`Already signed in, left unchanged: ${already.length}`);
  console.log(`Skipped: ${skipped.length}`);
  for (const line of skipped) console.log(`  - ${line}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
