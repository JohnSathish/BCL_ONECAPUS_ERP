/**
 * Smoke-test Sem 5 / full-admission Excel template generation.
 *   npx tsx scripts/smoke-sem5-import-template.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { StudentImportService } from '../src/modules/students/import/student-import.service';

const prisma = new PrismaClient();
const outDir = join(process.cwd(), 'prisma', 'data');

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const dayShift = await prisma.shift.findFirst({
    where: { tenantId: tenant.id, code: 'DAY', deletedAt: null },
  });
  const morningShift = await prisma.shift.findFirst({
    where: { tenantId: tenant.id, code: 'MORNING', deletedAt: null },
  });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const importService = app.get(StudentImportService);

  for (const [label, shiftId] of [
    ['day', dayShift?.id],
    ['morning', morningShift?.id],
  ] as const) {
    const sem5 = await importService.buildSem5AdmissionTemplate({
      tenantId: tenant.id,
      shiftId,
    });
    const sem5Path = join(outDir, `sem5-import-template-${label}.xlsx`);
    writeFileSync(sem5Path, sem5);
    console.log(`Wrote ${sem5Path} (${sem5.length} bytes)`);

    const full = await importService.buildFullAdmissionTemplate({
      tenantId: tenant.id,
      shiftId,
    });
    const fullPath = join(outDir, `full-admission-template-${label}.xlsx`);
    writeFileSync(fullPath, full);
    console.log(`Wrote ${fullPath} (${full.length} bytes)`);
  }

  await app.close();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
