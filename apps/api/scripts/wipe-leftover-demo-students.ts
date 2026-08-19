/**
 * Hard-delete leftover demo / attendance-test students with no live batch
 * (DEMO-S3-* and ECO-S3-A-*). Does not touch BATCH-2024/2025/2026.
 *
 *   npx ts-node --transpile-only scripts/wipe-leftover-demo-students.ts
 *   npx ts-node --transpile-only scripts/wipe-leftover-demo-students.ts --apply
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetSeatLedgers(tenantId: string) {
  const sections = await prisma.offeringSection.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true },
  });
  let updated = 0;
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
    updated += 1;
  }
  return updated;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const tenant =
    (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
    (await prisma.tenant.findFirst({
      where: { name: { contains: 'Don Bosco' } },
    }));
  if (!tenant) throw new Error('Tenant not found');

  const students = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { enrollmentNumber: { startsWith: 'DEMO-S3-', mode: 'insensitive' } },
        { enrollmentNumber: { startsWith: 'ECO-S3-A-', mode: 'insensitive' } },
        { importSource: { equals: 'DEMO_SEED', mode: 'insensitive' } },
        { importSource: { equals: 'economics-sem3-attendance-test-v1' } },
        {
          academicProfile: null,
          user: { email: { endsWith: '@demo.edu', mode: 'insensitive' } },
        },
        {
          academicProfile: { admissionBatchId: null },
          user: { email: { endsWith: '@demo.edu', mode: 'insensitive' } },
        },
      ],
    },
    select: {
      id: true,
      userId: true,
      enrollmentNumber: true,
      importSource: true,
      masterProfile: { select: { fullName: true } },
      academicProfile: {
        select: { admissionBatch: { select: { batchCode: true } } },
      },
    },
    orderBy: { enrollmentNumber: 'asc' },
  });

  const leaked = students.filter((s) => {
    const batch = s.academicProfile?.admissionBatch?.batchCode?.toUpperCase();
    return (
      batch === 'BATCH-2024' || batch === 'BATCH-2025' || batch === 'BATCH-2026'
    );
  });
  if (leaked.length) {
    throw new Error(
      `Refusing: ${leaked.length} live-batch student(s) matched. ${leaked
        .slice(0, 5)
        .map((s) => s.enrollmentNumber)
        .join(', ')}`,
    );
  }

  console.log(`Tenant: ${tenant.slug}`);
  console.log(`Demo/test students to delete: ${students.length}`);
  const prefixes = new Map<string, number>();
  for (const s of students) {
    const prefix = s.enrollmentNumber.replace(/\d+$/, '');
    prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1);
  }
  for (const [prefix, n] of [...prefixes.entries()].sort()) {
    console.log(`  ${prefix}*: ${n}`);
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to hard-delete.');
    return;
  }
  if (!students.length) {
    console.log('Nothing to delete.');
    return;
  }

  const studentIds = students.map((s) => s.id);
  const userIds = [...new Set(students.map((s) => s.userId))];
  const now = new Date();

  await prisma.$transaction(
    async (tx) => {
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
      await tx.studentMajorMinorOverride.deleteMany({
        where: { studentId: { in: studentIds }, tenantId: tenant.id },
      });
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
      for (const userId of userIds) {
        const tag = userId.replace(/-/g, '').slice(0, 12);
        await tx.refreshSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.userRole.updateMany({
          where: { userId, deletedAt: null },
          data: { deletedAt: now },
        });
        await tx.user.update({
          where: { id: userId },
          data: {
            email: `purged.${tag}@purged.local`,
            username: `purged.${tag}`,
            deletedAt: now,
            isActive: false,
            accountStatus: 'inactive',
          },
        });
      }
    },
    { timeout: 300_000 },
  );

  const ledgers = await resetSeatLedgers(tenant.id);
  const remainingDemo = await prisma.student.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [
        { enrollmentNumber: { startsWith: 'DEMO-S3-', mode: 'insensitive' } },
        { enrollmentNumber: { startsWith: 'ECO-S3-A-', mode: 'insensitive' } },
      ],
    },
  });
  const byBatch = await prisma.$queryRawUnsafe<
    Array<{ batch: string; n: bigint }>
  >(
    `
    select coalesce(upper(ab.batch_code), '(none)') as batch, count(*)::bigint as n
    from academic.students s
    left join academic.student_academic_profiles p on p.student_id = s.id
    left join academic.admission_batches ab on ab.id = p.admission_batch_id
    where s.tenant_id = '${tenant.id}'::uuid and s.deleted_at is null
    group by 1
    order by 1
  `,
  );

  console.log('\nDeleted', studentIds.length, 'students.');
  console.log('Portal users deactivated:', userIds.length);
  console.log('Seat ledgers recalculated:', ledgers);
  console.log('Remaining DEMO-S3 / ECO-S3-A:', remainingDemo);
  console.log('Active students by batch:');
  for (const row of byBatch) {
    console.log(`  ${row.batch}: ${row.n}`);
  }
  if (remainingDemo !== 0) {
    throw new Error('Demo students still remain');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
