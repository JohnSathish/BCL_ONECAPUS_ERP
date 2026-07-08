import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StudentImportService } from '../src/modules/students/import/student-import.service';

const SOURCE =
  process.env.PENDING11_FILE ??
  process.argv[2] ??
  path.join(
    process.env.USERPROFILE ?? '',
    'OneDrive',
    'Desktop',
    'Import Live 1-3-5',
    'Morning Shift',
    '5th Semester',
    '5th Sem Morning Shift Final Import02 - PENDING 11 students.xlsx',
  );
const IMPORT_MODE =
  (
    process.env.PENDING11_IMPORT_MODE ??
    process.argv[3] ??
    'MERGE'
  ).toUpperCase() === 'CREATE'
    ? 'CREATE'
    : 'MERGE';

async function resolveTenantAndUser(prisma: PrismaService) {
  const tenantSlug = process.env.TENANT_SLUG?.trim();
  const tenant = tenantSlug
    ? await prisma.tenant.findFirst({
        where: { slug: tenantSlug },
        select: { id: true, name: true, slug: true },
      })
    : ((await prisma.tenant.findFirst({
        where: { slug: 'demo' },
        select: { id: true, name: true, slug: true },
      })) ??
      (await prisma.tenant.findFirst({
        where: { name: { contains: 'Don Bosco' } },
        select: { id: true, name: true, slug: true },
      })));
  if (!tenant) throw new Error('Tenant not found');

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  if (!user) throw new Error('No active user found for tenant');

  return { tenant, user };
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    throw new Error(`File not found: ${SOURCE}`);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const prisma = app.get(PrismaService);
    const service = app.get(StudentImportService);
    const { tenant, user } = await resolveTenantAndUser(prisma);
    const buffer = fs.readFileSync(SOURCE);
    const fileName = path.basename(SOURCE);

    console.log(`Tenant: ${tenant.name} (${tenant.slug ?? tenant.id})`);
    console.log(`User: ${user.email ?? user.id}`);
    console.log(`File: ${SOURCE}`);

    const validated = await service.validateUpload(
      tenant.id,
      user.id,
      fileName,
      buffer,
      { importMode: IMPORT_MODE },
    );
    const batchId = (validated as any).batchId as string;
    const batch = await service.getBatch(tenant.id, batchId);
    console.log(`Batch: ${batchId}`);
    console.log(
      `Validated rows: ${batch.validRows}, invalid rows: ${batch.invalidRows}`,
    );

    if (batch.invalidRows > 0) {
      console.log('Validation has invalid rows. Batch status:', batch.status);
      console.log(
        'Use check-import-batch.mjs with this batch ID for row errors.',
      );
      return;
    }

    const committed = await service.commit(
      tenant.id,
      user.id,
      batchId,
      'VALID_ONLY',
      IMPORT_MODE,
    );
    console.log('Commit result:', committed);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
