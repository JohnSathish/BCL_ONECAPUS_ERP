/**
 * Hard-delete current Semester 3 (BATCH-2025) and Semester 5 (BATCH-2024)
 * students so those cohorts can be CREATE-reimported. Semester 1
 * (BATCH-2026) is left untouched.
 *
 *   npx ts-node --transpile-only scripts/wipe-sem3-sem5-cohorts.ts
 *   npx ts-node --transpile-only scripts/wipe-sem3-sem5-cohorts.ts --apply
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const WIPE_BATCHES = ['BATCH-2024', 'BATCH-2025'];
const KEEP_BATCH = 'BATCH-2026';

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

async function countByBatch(tenantId: string) {
  const rows = await prisma.student.findMany({
    where: { tenantId, deletedAt: null },
    select: {
      academicProfile: {
        select: {
          admissionBatch: {
            select: { batchCode: true, currentSemester: true },
          },
        },
      },
    },
  });
  const byBatch = new Map<string, number>();
  const bySemester = new Map<number, number>();
  for (const row of rows) {
    const batch =
      row.academicProfile?.admissionBatch?.batchCode?.toUpperCase() ?? '(none)';
    byBatch.set(batch, (byBatch.get(batch) ?? 0) + 1);
    const sem = row.academicProfile?.admissionBatch?.currentSemester ?? 0;
    bySemester.set(sem, (bySemester.get(sem) ?? 0) + 1);
  }
  return { byBatch, bySemester, total: rows.length };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const tenant =
    (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
    (await prisma.tenant.findFirst({
      where: { name: { contains: 'Don Bosco' } },
    }));
  if (!tenant) throw new Error('Tenant not found');

  const before = await countByBatch(tenant.id);
  const students = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      academicProfile: {
        admissionBatch: {
          batchCode: { in: WIPE_BATCHES, mode: 'insensitive' },
        },
      },
    },
    select: {
      id: true,
      userId: true,
      enrollmentNumber: true,
      rollNumber: true,
      deletedAt: true,
      academicProfile: {
        select: {
          admissionBatch: {
            select: { batchCode: true, currentSemester: true },
          },
        },
      },
      primaryShift: { select: { code: true } },
    },
    orderBy: { enrollmentNumber: 'asc' },
  });

  const keepCount =
    before.byBatch.get(KEEP_BATCH) ?? before.byBatch.get('BATCH-2026') ?? 0;

  console.log(`Tenant: ${tenant.slug} (${tenant.id})`);
  console.log('Active students by batch:');
  for (const [batch, n] of [...before.byBatch.entries()].sort()) {
    console.log(`  ${batch}: ${n}`);
  }
  console.log('Active students by current semester:');
  for (const [sem, n] of [...before.bySemester.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    console.log(`  sem ${sem}: ${n}`);
  }
  console.log(`Wipe targets (${WIPE_BATCHES.join(' + ')}): ${students.length}`);
  console.log(`Keep ${KEEP_BATCH}: ${keepCount} (must stay)`);

  const byWipeBatch = new Map<string, number>();
  for (const student of students) {
    const batch =
      student.academicProfile?.admissionBatch?.batchCode?.toUpperCase() ??
      '(none)';
    byWipeBatch.set(batch, (byWipeBatch.get(batch) ?? 0) + 1);
  }
  for (const [batch, n] of [...byWipeBatch.entries()].sort()) {
    console.log(`  wipe ${batch}: ${n}`);
  }

  const leakedKeep = students.filter((student) =>
    (student.academicProfile?.admissionBatch?.batchCode ?? '')
      .toUpperCase()
      .includes('2026'),
  );
  if (leakedKeep.length) {
    throw new Error(
      `Refusing wipe: ${leakedKeep.length} BATCH-2026 student(s) matched. Check filters.`,
    );
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to hard-delete.');
    return;
  }

  if (!students.length) {
    console.log('Nothing to wipe.');
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
          await tx.user.update({
            where: { id: userId },
            data: {
              email: `purged.${userId.replace(/-/g, '').slice(0, 12)}@purged.local`,
              username: `purged.${userId.replace(/-/g, '').slice(0, 12)}`,
              deletedAt: now,
              isActive: false,
              accountStatus: 'inactive',
            },
          });
        }
      }
    },
    { timeout: 600_000 },
  );

  const ledgers = await resetSeatLedgers(tenant.id);
  const after = await countByBatch(tenant.id);

  console.log('\nWipe complete.');
  console.log(`Students removed: ${studentIds.length}`);
  console.log(`Portal users deactivated: ${userIds.length}`);
  console.log(`Seat ledgers recalculated: ${ledgers}`);
  console.log('Remaining active students by batch:');
  for (const [batch, n] of [...after.byBatch.entries()].sort()) {
    console.log(`  ${batch}: ${n}`);
  }
  const remainingWipe = [...after.byBatch.entries()].filter(([batch]) =>
    WIPE_BATCHES.includes(batch),
  );
  if (remainingWipe.length) {
    throw new Error(
      `Wipe leftover: ${remainingWipe.map(([b, n]) => `${b}=${n}`).join(', ')}`,
    );
  }
  const remainingKeep = after.byBatch.get(KEEP_BATCH) ?? 0;
  if (remainingKeep !== keepCount) {
    throw new Error(
      `${KEEP_BATCH} changed: was ${keepCount}, now ${remainingKeep}`,
    );
  }
  console.log(`${KEEP_BATCH} unchanged at ${remainingKeep}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
