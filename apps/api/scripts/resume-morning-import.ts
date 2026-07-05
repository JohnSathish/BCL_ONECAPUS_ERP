/**
 * Resume a partially committed student import after a mid-batch failure.
 *
 *   npx ts-node --transpile-only scripts/resume-morning-import.ts <batchId>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StudentImportService } from '../src/modules/students/import/student-import.service';
import { parseFlexibleDate } from '../src/common/utils/parse-flexible-date';
import type { NormalizedStudentImportRow } from '../src/modules/students/import/student-import.handler';

const batchId = process.argv[2];
if (!batchId) {
  console.error(
    'Usage: npx ts-node --transpile-only scripts/resume-morning-import.ts <batchId>',
  );
  process.exit(1);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);
  const importService = app.get(StudentImportService);

  try {
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new Error(`Batch not found: ${batchId}`);

    const admin = await prisma.user.findFirst({
      where: { tenantId: batch.tenantId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) throw new Error('No admin user');

    const createdStudents = await prisma.student.findMany({
      where: {
        tenantId: batch.tenantId,
        importBatchId: batchId,
        deletedAt: null,
      },
      select: { id: true, enrollmentNumber: true },
    });
    const createdByEnrollment = new Map(
      createdStudents
        .filter((s) => s.enrollmentNumber)
        .map((s) => [s.enrollmentNumber!.toUpperCase(), s.id]),
    );
    console.log(`Already created from this batch: ${createdStudents.length}`);

    const validRows = await prisma.importBatchRow.findMany({
      where: { batchId, status: 'VALID' },
    });

    let markedImported = 0;
    let fixedDob = 0;
    for (const row of validRows) {
      const normalized = row.normalized as NormalizedStudentImportRow | null;
      if (!normalized) continue;

      const enrollment = normalized.enrollmentNumber?.toUpperCase();
      const existingId = enrollment
        ? createdByEnrollment.get(enrollment)
        : undefined;
      if (existingId) {
        await prisma.importBatchRow.update({
          where: { id: row.id },
          data: { status: 'IMPORTED', courseId: existingId },
        });
        markedImported += 1;
        continue;
      }

      if (
        normalized.dateOfBirth &&
        !parseFlexibleDate(normalized.dateOfBirth)
      ) {
        const next = { ...normalized, dateOfBirth: undefined };
        await prisma.importBatchRow.update({
          where: { id: row.id },
          data: {
            normalized: next,
            errors: [
              `Cleared invalid date of birth "${normalized.dateOfBirth}" so import can continue`,
            ],
          },
        });
        fixedDob += 1;
        console.log(
          `Cleared invalid DOB on row ${row.rowNumber} (${normalized.enrollmentNumber} ${normalized.fullName}): ${normalized.dateOfBirth}`,
        );
      }
    }

    console.log(`Marked already-imported rows: ${markedImported}`);
    console.log(`Cleared invalid DOBs: ${fixedDob}`);

    const remaining = await prisma.importBatchRow.count({
      where: { batchId, status: 'VALID' },
    });
    console.log(`Remaining VALID rows to import: ${remaining}`);

    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'VALIDATED',
        errorMessage: null,
        completedAt: null,
        successfulRows: markedImported,
        failedRows: 0,
      },
    });

    if (remaining === 0) {
      await prisma.importBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMMITTED',
          successfulRows: markedImported,
          completedAt: new Date(),
        },
      });
      console.log('Nothing left to import. Batch marked COMMITTED.');
      return;
    }

    console.log('Resuming commit for remaining rows…');
    const result = await importService.runCommitJob(
      batch.tenantId,
      admin.id,
      batchId,
      'VALID_ONLY',
      'CREATE',
    );
    console.log('Done:', result);

    const finalCreated = await prisma.student.count({
      where: {
        tenantId: batch.tenantId,
        importBatchId: batchId,
        deletedAt: null,
      },
    });
    console.log(`Total students for this batch: ${finalCreated}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
