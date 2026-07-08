/**
 * Run student import commit synchronously (bypasses BullMQ queue).
 *
 *   npx ts-node --transpile-only scripts/run-student-import-commit-sync.ts <batchId>
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { StudentImportService } from '../src/modules/students/import/student-import.service';

const batchId = process.argv[2];
if (!batchId) {
  console.error(
    'Usage: npx ts-node --transpile-only scripts/run-student-import-commit-sync.ts <batchId>',
  );
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const importService = app.get(StudentImportService);
  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error(`Batch not found: ${batchId}`);
  if (batch.status === 'COMMITTING' && batch.successfulRows === 0) {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'VALIDATED',
        errorMessage: 'Reset for manual sync commit.',
      },
    });
  }
  const admin = await prisma.user.findFirst({
    where: { tenantId: batch.tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('No admin user for tenant');
  console.log(`Committing batch ${batchId} (${batch.fileName}) sync...`);
  const started = Date.now();
  const result = await importService.commit(
    batch.tenantId,
    admin.id,
    batchId,
    'VALID_ONLY',
    'MERGE',
    { preferSync: true },
  );
  console.log('Done in', Math.round((Date.now() - started) / 1000), 's');
  console.log(JSON.stringify(result, null, 2));
  await app.close();
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
