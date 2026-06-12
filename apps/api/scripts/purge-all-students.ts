/**
 * Permanently delete all student records (including soft-deleted) and reset roll number sequences.
 *
 *   npx ts-node --transpile-only scripts/purge-all-students.ts --dry-run
 *   npx ts-node --transpile-only scripts/purge-all-students.ts --apply
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');
  const tenantSlug = process.env.TENANT_SLUG ?? 'demo';

  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) {
    console.error(`Tenant "${tenantSlug}" not found.`);
    process.exit(1);
  }

  const students = await prisma.student.findMany({
    where: { tenantId: tenant.id },
    select: {
      id: true,
      userId: true,
      enrollmentNumber: true,
      rollNumber: true,
      deletedAt: true,
      masterProfile: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const rollSequences = await prisma.rollNumberSequence.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, prefix: true, admissionYear: true, nextSequence: true },
  });

  console.log(`Tenant: ${tenant.slug} (${tenant.id})`);
  console.log(`Students to purge: ${students.length}`);
  for (const s of students) {
    console.log(
      `  - ${s.masterProfile?.fullName ?? '(no name)'} | reg=${s.enrollmentNumber} | roll=${s.rollNumber ?? '—'}${s.deletedAt ? ' [soft-deleted]' : ''}`,
    );
  }
  console.log(`Roll number sequences to reset: ${rollSequences.length}`);
  for (const seq of rollSequences) {
    console.log(
      `  - ${seq.prefix}${seq.admissionYear}: next=${seq.nextSequence} → 1`,
    );
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to permanently delete.');
    return;
  }

  if (students.length === 0 && rollSequences.length === 0) {
    console.log('Nothing to purge.');
    return;
  }

  const userIds = [...new Set(students.map((s) => s.userId))];

  await prisma.$transaction(async (tx) => {
    await tx.studentRollNumberAuditLog.deleteMany({
      where: { tenantId: tenant.id },
    });

    if (students.length > 0) {
      await tx.student.deleteMany({ where: { tenantId: tenant.id } });
      await tx.user.deleteMany({
        where: { id: { in: userIds }, tenantId: tenant.id },
      });
    }

    await tx.rollNumberSequence.updateMany({
      where: { tenantId: tenant.id },
      data: { nextSequence: 1 },
    });
  });

  const remaining = await prisma.student.count({
    where: { tenantId: tenant.id },
  });
  const sequences = await prisma.rollNumberSequence.findMany({
    where: { tenantId: tenant.id },
    select: { prefix: true, admissionYear: true, nextSequence: true },
  });

  console.log('\nPurge complete.');
  console.log(`Remaining students: ${remaining}`);
  console.log(
    'Roll sequences:',
    sequences
      .map((s) => `${s.prefix}${s.admissionYear}=${s.nextSequence}`)
      .join(', ') || 'none',
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
