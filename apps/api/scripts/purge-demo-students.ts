/**
 * Permanently remove seeded demo students (DEMO-S3-* / demo.student.*@demo.edu).
 * Keeps real imported students (e.g. BA25-*) and college admin accounts.
 *
 *   npx tsx scripts/purge-demo-students.ts
 *   npx tsx scripts/purge-demo-students.ts --apply
 *   npx tsx scripts/purge-demo-students.ts --apply --tenant=demo
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_ENROLLMENT_PREFIX = 'DEMO-';
const DEMO_STUDENT_EMAIL_PREFIX = 'demo.student.';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function isDemoStudentEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized.startsWith(DEMO_STUDENT_EMAIL_PREFIX) &&
    normalized.endsWith('@demo.edu')
  );
}

async function resetSeatLedgers(tenantId: string) {
  const sections = await prisma.offeringSection.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true },
  });

  for (const section of sections) {
    const confirmed = await prisma.semesterRegistrationLine.count({
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
        confirmedCount: confirmed,
        waitlistCount: waitlisted,
      },
      update: {
        confirmedCount: confirmed,
        waitlistCount: waitlisted,
      },
    });
  }
  return sections.length;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const tenantSlug = readArg('tenant') ?? process.env.TENANT_SLUG ?? 'demo';

  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) {
    console.error(`Tenant "${tenantSlug}" not found.`);
    process.exit(1);
  }

  const students = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        {
          enrollmentNumber: {
            startsWith: DEMO_ENROLLMENT_PREFIX,
            mode: 'insensitive',
          },
        },
        {
          user: {
            email: {
              startsWith: DEMO_STUDENT_EMAIL_PREFIX,
              mode: 'insensitive',
            },
          },
        },
      ],
    },
    select: {
      id: true,
      enrollmentNumber: true,
      rollNumber: true,
      deletedAt: true,
      userId: true,
      masterProfile: { select: { fullName: true } },
      user: { select: { email: true } },
    },
    orderBy: { enrollmentNumber: 'asc' },
  });

  const realStudentCount = await prisma.student.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      NOT: {
        OR: [
          {
            enrollmentNumber: {
              startsWith: DEMO_ENROLLMENT_PREFIX,
              mode: 'insensitive',
            },
          },
          {
            user: {
              email: {
                startsWith: DEMO_STUDENT_EMAIL_PREFIX,
                mode: 'insensitive',
              },
            },
          },
        ],
      },
    },
  });

  const regLines = students.length
    ? await prisma.semesterRegistrationLine.count({
        where: {
          registration: { studentId: { in: students.map((s) => s.id) } },
        },
      })
    : 0;

  console.log(`Tenant: ${tenant.slug}`);
  console.log(`Demo students to remove: ${students.length}`);
  console.log(`Real students kept: ${realStudentCount}`);
  console.log(
    `Semester registration lines tied to demo students: ${regLines}\n`,
  );

  for (const s of students) {
    console.log(
      `  - ${s.masterProfile?.fullName ?? '(no name)'} | ${s.enrollmentNumber} | ${s.user?.email ?? '—'}`,
    );
  }

  if (!apply) {
    console.log(
      '\nDry run only. Re-run with --apply to permanently delete demo students.',
    );
    return;
  }

  if (students.length === 0) {
    console.log('\nNo demo students found.');
    return;
  }

  const userIds = [
    ...new Set(
      students
        .map((s) => s.userId)
        .filter((id) => {
          const student = students.find((row) => row.userId === id);
          return isDemoStudentEmail(student?.user?.email);
        }),
    ),
  ];
  const studentIds = students.map((s) => s.id);
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.studentRollNumberAuditLog.deleteMany({
      where: { studentId: { in: studentIds } },
    });
    await tx.student.deleteMany({
      where: { id: { in: studentIds }, tenantId: tenant.id },
    });

    if (userIds.length > 0) {
      await tx.refreshSession.updateMany({
        where: { userId: { in: userIds }, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.userRole.updateMany({
        where: { userId: { in: userIds }, deletedAt: null },
        data: { deletedAt: now },
      });
      for (const userId of userIds) {
        await tx.user.update({
          where: { id: userId },
          data: {
            email: `purged.${userId.replace(/-/g, '').slice(0, 12)}@purged.local`,
            deletedAt: now,
            isActive: false,
            accountStatus: 'inactive',
          },
        });
      }
    }
  });

  const ledgersReset = await resetSeatLedgers(tenant.id);

  const remainingDemo = await prisma.student.count({
    where: {
      tenantId: tenant.id,
      OR: [
        {
          enrollmentNumber: {
            startsWith: DEMO_ENROLLMENT_PREFIX,
            mode: 'insensitive',
          },
        },
        {
          user: {
            email: {
              startsWith: DEMO_STUDENT_EMAIL_PREFIX,
              mode: 'insensitive',
            },
          },
        },
      ],
    },
  });
  const remainingReal = await prisma.student.count({
    where: { tenantId: tenant.id, deletedAt: null },
  });

  console.log('\nDemo student purge complete.');
  console.log(`  Removed students: ${studentIds.length}`);
  console.log(`  Deactivated portal users: ${userIds.length}`);
  console.log(`  Seat ledgers recalculated: ${ledgersReset}`);
  console.log(`  Remaining demo students: ${remainingDemo}`);
  console.log(`  Remaining active students: ${remainingReal}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
