/**
 * Run student import commit synchronously (bypasses BullMQ queue).
 * Use when import is stuck at 0/N behind other background jobs.
 *
 *   npx ts-node --transpile-only scripts/commit-student-import-now.ts <batchId>
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StudentImportService } from '../src/modules/students/import/student-import.service';
import type { StudentImportMode } from '../src/modules/students/dto/students.dto';

const batchId = process.argv[2];
const tenantSlug =
  process.argv
    .find((a) => a.startsWith('--tenant='))
    ?.slice('--tenant='.length) ?? 'demo';
const importMode = (process.argv
  .find((a) => a.startsWith('--mode='))
  ?.slice('--mode='.length) ?? 'CREATE') as StudentImportMode;

if (!batchId) {
  console.error(
    'Usage: npx ts-node --transpile-only scripts/commit-student-import-now.ts <batchId> [--tenant=demo] [--mode=CREATE|MERGE]',
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
    const tenant = await prisma.tenant.findFirst({
      where: { slug: tenantSlug },
    });
    if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

    const batch = await prisma.importBatch.findFirst({
      where: { id: batchId, tenantId: tenant.id },
    });
    if (!batch) throw new Error(`Batch not found: ${batchId}`);

    const admin = await prisma.user.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) throw new Error('No admin user');

    if (batch.status === 'COMMITTING' && (batch.successfulRows ?? 0) === 0) {
      await prisma.importBatch.update({
        where: { id: batchId },
        data: { status: 'VALIDATED', errorMessage: null },
      });
      console.log('Reset stuck COMMITTING batch → VALIDATED');
    }

    console.log(
      `Committing batch ${batchId} (${batch.fileName}) synchronously…`,
    );
    const result = await importService.runCommitJob(
      tenant.id,
      admin.id,
      batchId,
      'VALID_ONLY',
      importMode,
    );
    console.log('Done:', result);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
