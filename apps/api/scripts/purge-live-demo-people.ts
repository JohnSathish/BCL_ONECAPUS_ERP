/**
 * Remove demo students + demo staff/@demo.edu users from a production tenant.
 *
 * Matches the seeded "Demo Student 012" / ARTS25012 / ADM25012 roster and all
 * @demo.edu portal accounts while keeping real college data.
 *
 * Students are matched if ANY of:
 *   - importSource = DEMO_SEED
 *   - enrollmentNumber starts with DEMO-
 *   - masterProfile.fullName matches /^Demo Student/i
 *   - linked user email ends with @demo.edu
 *
 * Staff/users:
 *   - staff email or portalUser email ends with @demo.edu
 *   - users with email ending @demo.edu
 *
 * NEVER purge:
 *   - emails @donboscocollege.ac.in
 *   - students without the demo markers above
 *
 * Default = dry run. Hard-delete when CONFIRM=YES (or --confirm).
 *
 *   cd apps/api
 *   npx ts-node --transpile-only scripts/purge-live-demo-people.ts
 *   CONFIRM=YES TENANT_SLUG=your-slug npx ts-node --transpile-only scripts/purge-live-demo-people.ts
 *
 * PowerShell:
 *   $env:CONFIRM='YES'; $env:TENANT_SLUG='demo'
 *   npx ts-node --transpile-only scripts/purge-live-demo-people.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEMO_EMAIL_SUFFIX = '@demo.edu';
const confirmed =
  process.env.CONFIRM === 'YES' || process.argv.includes('--confirm');
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

async function resolveTenant() {
  const slug =
    process.env.TENANT_SLUG?.trim() ||
    process.argv
      .find((a) => a.startsWith('--tenant='))
      ?.slice('--tenant='.length) ||
    process.argv
      .find((a) => a.startsWith('--tenant-slug='))
      ?.slice('--tenant-slug='.length);

  if (slug) {
    const bySlug = await prisma.tenant.findFirst({
      where: { slug: slug.toLowerCase(), deletedAt: null },
    });
    if (bySlug) return bySlug;
  }

  const byName = await prisma.tenant.findFirst({
    where: {
      name: { contains: 'Don Bosco', mode: 'insensitive' },
      deletedAt: null,
    },
  });
  if (byName) return byName;

  return prisma.tenant.findFirst({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
}

function isCollegeEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith('@donboscocollege.ac.in');
}

function isDemoEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(DEMO_EMAIL_SUFFIX);
}

async function resetSeatLedgers(tenantId: string) {
  const sections = await prisma.offeringSection.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true },
  });
  for (const section of sections) {
    const confirmedCount = await prisma.semesterRegistrationLine.count({
      where: { offeringSectionId: section.id, status: 'confirmed' },
    });
    const waitlisted = await prisma.semesterRegistrationLine.count({
      where: { offeringSectionId: section.id, status: 'waitlisted' },
    });
    await prisma.offeringSeatLedger.upsert({
      where: { offeringSectionId: section.id },
      create: {
        offeringSectionId: section.id,
        tenantId,
        confirmedCount,
        waitlistCount: waitlisted,
      },
      update: { confirmedCount, waitlistCount: waitlisted },
    });
  }
  return sections.length;
}

async function main() {
  const tenant = await resolveTenant();
  if (!tenant) throw new Error('Tenant not found');

  console.log(
    `\nLive demo people purge — ${tenant.name} (${tenant.slug} / ${tenant.id})`,
  );
  console.log(
    dryRun || !confirmed
      ? 'Mode: DRY RUN (preview only)\n'
      : 'Mode: HARD DELETE (permanent)\n',
  );

  const students = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { importSource: { equals: 'DEMO_SEED', mode: 'insensitive' } },
        {
          enrollmentNumber: {
            startsWith: 'DEMO-',
            mode: 'insensitive',
          },
        },
        {
          masterProfile: {
            fullName: { startsWith: 'Demo Student', mode: 'insensitive' },
          },
        },
        {
          user: {
            email: { endsWith: DEMO_EMAIL_SUFFIX, mode: 'insensitive' },
          },
        },
      ],
    },
    select: {
      id: true,
      enrollmentNumber: true,
      rollNumber: true,
      admissionNumber: true,
      importSource: true,
      deletedAt: true,
      userId: true,
      masterProfile: { select: { fullName: true } },
      user: { select: { id: true, email: true } },
    },
    orderBy: { enrollmentNumber: 'asc' },
  });

  const studentsToPurge = students.filter(
    (s) => !isCollegeEmail(s.user?.email),
  );

  const staff = await prisma.staffProfile.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { email: { endsWith: DEMO_EMAIL_SUFFIX, mode: 'insensitive' } },
        {
          portalUser: {
            email: { endsWith: DEMO_EMAIL_SUFFIX, mode: 'insensitive' },
          },
        },
      ],
    },
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      email: true,
      deletedAt: true,
      portalUserId: true,
      portalUser: { select: { id: true, email: true } },
    },
    orderBy: { employeeCode: 'asc' },
  });

  const staffToPurge = staff.filter((s) => {
    if (isCollegeEmail(s.email) || isCollegeEmail(s.portalUser?.email))
      return false;
    return true;
  });

  const demoUsers = await prisma.user.findMany({
    where: {
      tenantId: tenant.id,
      email: { endsWith: DEMO_EMAIL_SUFFIX, mode: 'insensitive' },
    },
    select: { id: true, email: true, displayName: true, deletedAt: true },
    orderBy: { email: 'asc' },
  });
  const usersToPurge = demoUsers.filter((u) => !isCollegeEmail(u.email));

  const realStudentCount = await prisma.student.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      id: { notIn: studentsToPurge.map((s) => s.id) },
    },
  });
  const realStaffCount = await prisma.staffProfile.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      id: { notIn: staffToPurge.map((s) => s.id) },
    },
  });

  console.log(`Demo students to remove: ${studentsToPurge.length}`);
  console.log(`Demo staff to remove:    ${staffToPurge.length}`);
  console.log(`@demo.edu users to remove: ${usersToPurge.length}`);
  console.log(`Real students kept:      ${realStudentCount}`);
  console.log(`Real staff kept:         ${realStaffCount}\n`);

  const previewStudents = studentsToPurge.slice(0, 40);
  for (const s of previewStudents) {
    console.log(
      `  [S] ${s.masterProfile?.fullName ?? '(no name)'} | ${s.enrollmentNumber} | ${s.rollNumber ?? '—'} | ${s.user?.email ?? '—'}`,
    );
  }
  if (studentsToPurge.length > previewStudents.length) {
    console.log(
      `  … +${studentsToPurge.length - previewStudents.length} more students`,
    );
  }

  console.log('');
  for (const s of staffToPurge) {
    console.log(
      `  [T] ${s.fullName} | ${s.employeeCode} | ${s.portalUser?.email ?? s.email ?? '—'}`,
    );
  }

  console.log('');
  const previewUsers = usersToPurge.slice(0, 40);
  for (const u of previewUsers) {
    console.log(
      `  [U] ${u.email}${u.displayName ? ` (${u.displayName})` : ''}`,
    );
  }
  if (usersToPurge.length > previewUsers.length) {
    console.log(`  … +${usersToPurge.length - previewUsers.length} more users`);
  }

  if (!confirmed || dryRun) {
    console.log(
      '\nDry run only. Re-run with CONFIRM=YES (and without DRY_RUN) to hard-delete.',
    );
    console.log('Backup first before applying on live.\n');
    return;
  }

  if (
    studentsToPurge.length === 0 &&
    staffToPurge.length === 0 &&
    usersToPurge.length === 0
  ) {
    console.log('\nNothing to purge.\n');
    return;
  }

  const studentIds = studentsToPurge.map((s) => s.id);
  const staffIds = staffToPurge.map((s) => s.id);
  const userIds = [
    ...new Set([
      ...usersToPurge.map((u) => u.id),
      ...studentsToPurge.map((s) => s.userId).filter(Boolean),
      ...staffToPurge
        .map((s) => s.portalUserId)
        .filter((id): id is string => Boolean(id)),
    ]),
  ];
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
      if (studentIds.length) {
        // Break registration seat lines first (Cascade usually OK; be explicit).
        const regs = await tx.semesterRegistration.findMany({
          where: { studentId: { in: studentIds }, tenantId: tenant.id },
          select: { id: true },
        });
        const regIds = regs.map((r) => r.id);
        if (regIds.length) {
          await tx.semesterRegistrationLine.deleteMany({
            where: { registrationId: { in: regIds } },
          });
          await tx.semesterRegistration.deleteMany({
            where: { id: { in: regIds } },
          });
        }

        await tx.studentRollNumberAuditLog.deleteMany({
          where: { studentId: { in: studentIds } },
        });

        // Fee txn rows for these students (safe leftovers after fee purge).
        await tx.feeReceipt.deleteMany({
          where: { tenantId: tenant.id, studentId: { in: studentIds } },
        });
        await tx.paymentTransaction.deleteMany({
          where: { tenantId: tenant.id, studentId: { in: studentIds } },
        });
        await tx.studentFeeLedgerEntry.deleteMany({
          where: { tenantId: tenant.id, studentId: { in: studentIds } },
        });
        await tx.studentFeeDemand.deleteMany({
          where: { tenantId: tenant.id, studentId: { in: studentIds } },
        });
        await tx.studentFeeSummary.deleteMany({
          where: { tenantId: tenant.id, studentId: { in: studentIds } },
        });

        await tx.student.deleteMany({
          where: { id: { in: studentIds }, tenantId: tenant.id },
        });
      }

      if (staffIds.length) {
        await tx.staffShiftAssignment.deleteMany({
          where: { staffProfileId: { in: staffIds } },
        });
        await tx.staffSubjectAssignment
          .deleteMany({ where: { staffProfileId: { in: staffIds } } })
          .catch(() => ({ count: 0 }));
        // Detach portal user FK before hard delete
        await tx.staffProfile.updateMany({
          where: { id: { in: staffIds }, tenantId: tenant.id },
          data: { portalUserId: null, status: 'INACTIVE', deletedAt: now },
        });
        try {
          await tx.staffProfile.deleteMany({
            where: { id: { in: staffIds }, tenantId: tenant.id },
          });
        } catch (err) {
          console.warn(
            'Staff hard-delete blocked by FKs; left soft-deleted/inactive:',
            (err as Error).message,
          );
        }
      }

      if (userIds.length) {
        await tx.refreshSession.updateMany({
          where: { userId: { in: userIds }, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.userRole.updateMany({
          where: { userId: { in: userIds }, deletedAt: null },
          data: { deletedAt: now },
        });

        for (const userId of userIds) {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { email: true },
          });
          if (!user || isCollegeEmail(user.email) || !isDemoEmail(user.email)) {
            continue;
          }

          await tx.user.update({
            where: { id: userId },
            data: {
              email: `purged.${userId.replace(/-/g, '').slice(0, 12)}@purged.local`,
              deletedAt: now,
              isActive: false,
              accountStatus: 'inactive',
              displayName: `Purged (${user.email})`,
            },
          });
        }
      }
    },
    { timeout: 600_000 },
  );

  const ledgers = await resetSeatLedgers(tenant.id);

  const remainingDemoStudents = await prisma.student.count({
    where: {
      tenantId: tenant.id,
      OR: [
        { importSource: { equals: 'DEMO_SEED', mode: 'insensitive' } },
        {
          enrollmentNumber: { startsWith: 'DEMO-', mode: 'insensitive' },
        },
        {
          masterProfile: {
            fullName: { startsWith: 'Demo Student', mode: 'insensitive' },
          },
        },
        {
          user: {
            email: { endsWith: DEMO_EMAIL_SUFFIX, mode: 'insensitive' },
          },
        },
      ],
    },
  });
  const remainingActiveStudents = await prisma.student.count({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  const remainingDemoStaff = await prisma.staffProfile.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [
        { email: { endsWith: DEMO_EMAIL_SUFFIX, mode: 'insensitive' } },
        {
          portalUser: {
            email: { endsWith: DEMO_EMAIL_SUFFIX, mode: 'insensitive' },
            deletedAt: null,
          },
        },
      ],
    },
  });

  console.log('\nPurge complete.');
  console.log(`  Students removed:     ${studentIds.length}`);
  console.log(`  Staff targeted:       ${staffIds.length}`);
  console.log(`  Users deactivated:    ${userIds.length}`);
  console.log(`  Seat ledgers reset:   ${ledgers}`);
  console.log(`  Remaining demo students: ${remainingDemoStudents}`);
  console.log(`  Remaining demo staff:    ${remainingDemoStaff}`);
  console.log(`  Remaining active students: ${remainingActiveStudents}`);
  console.log('\nRefresh Student / Staff directories in admin.\n');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
