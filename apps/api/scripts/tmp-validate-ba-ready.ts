import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { StudentImportService } from '../src/modules/students/import/student-import.service';

const OUTPUT =
  'C:/Users/johnm/OneDrive/Desktop/Import Live 1-3-5/V SEM/B.A 5 Semester Students Bulk Import - READY TO IMPORT.xlsx';

async function main() {
  const prisma = new PrismaClient();
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const svc = app.get(StudentImportService);
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant!.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  const preview = await svc.validateUpload(
    tenant!.id,
    admin!.id,
    path.basename(OUTPUT),
    fs.readFileSync(OUTPUT),
    { importMode: 'MERGE' },
  );
  console.log('summary', preview.summary);
  const bad = preview.rows.filter((r) => r.status !== 'VALID');
  console.log('non-valid', bad.length);
  for (const r of bad) {
    console.log({
      row: r.rowNumber,
      status: r.status,
      errors: r.errors,
      warnings: r.warnings,
    });
  }
  await app.close();
  await prisma.$disconnect();
}

main();
