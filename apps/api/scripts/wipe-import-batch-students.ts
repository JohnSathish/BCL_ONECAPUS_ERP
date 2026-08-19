/**
 * Hard-delete students from one import batch (used to undo a partial CREATE).
 *
 *   npx ts-node --transpile-only scripts/wipe-import-batch-students.ts --apply <batchId>
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');
  const batchId =
    process.argv
      .find((arg) => arg.startsWith('--batch='))
      ?.slice('--batch='.length) ??
    process.argv.find((arg) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        arg,
      ),
    );
  if (!batchId) throw new Error('Pass --batch=<uuid>');

  const batch = await prisma.importBatch.findFirst({
    where: { id: batchId },
    select: {
      id: true,
      fileName: true,
      status: true,
      successfulRows: true,
      totalRows: true,
      tenantId: true,
    },
  });
  if (!batch) throw new Error(`Import batch not found: ${batchId}`);

  const students = await prisma.student.findMany({
    where: { tenantId: batch.tenantId, importBatchId: batch.id },
    select: { id: true, userId: true, enrollmentNumber: true },
  });
  console.log(
    `Batch ${batch.id} ${batch.fileName} status=${batch.status} ${batch.successfulRows}/${batch.totalRows}`,
  );
  console.log(`Students to wipe: ${students.length}`);
  if (!apply) {
    console.log('Dry run. Re-run with --apply');
    return;
  }

  const studentIds = students.map((s) => s.id);
  const userIds = [...new Set(students.map((s) => s.userId))];
  const now = new Date();
  const tenantId = batch.tenantId;

  await prisma.$transaction(
    async (tx) => {
      const regs = await tx.semesterRegistration.findMany({
        where: { studentId: { in: studentIds }, tenantId },
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
        where: { studentId: { in: studentIds }, tenantId },
      });
      await tx.feeReceipt.deleteMany({
        where: { tenantId, studentId: { in: studentIds } },
      });
      await tx.paymentTransaction.deleteMany({
        where: { tenantId, studentId: { in: studentIds } },
      });
      await tx.studentFeeLedgerEntry.deleteMany({
        where: { tenantId, studentId: { in: studentIds } },
      });
      await tx.studentFeeDemand.deleteMany({
        where: { tenantId, studentId: { in: studentIds } },
      });
      await tx.studentFeeSummary.deleteMany({
        where: { tenantId, studentId: { in: studentIds } },
      });
      if (studentIds.length) {
        await tx.student.deleteMany({
          where: { id: { in: studentIds }, tenantId },
        });
      }
      for (const userId of userIds) {
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
            email: `purged.${userId.replace(/-/g, '').slice(0, 12)}@purged.local`,
            username: `purged.${userId.replace(/-/g, '').slice(0, 12)}`,
            deletedAt: now,
            isActive: false,
            accountStatus: 'inactive',
          },
        });
      }
      await tx.importBatch.update({
        where: { id: batch.id },
        data: {
          status: 'FAILED',
          errorMessage:
            'Partial CREATE aborted; students wiped and file will be re-imported',
        },
      });
    },
    { timeout: 300_000 },
  );
  console.log(`Wiped ${studentIds.length} students from partial batch.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
