/**
 * Commit the mapped Sem 1 B.A. Day Shift workbook into the ERP.
 *
 *   npx ts-node --transpile-only scripts/commit-sem1-ba-arts-import.ts
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { parseExcelDataSheet } from '../src/common/import/excel.util';
import { ImportBatchRepository } from '../src/common/import/import-batch.repository';
import { PrismaService } from '../src/database/prisma.service';
import { StudentImportHandler } from '../src/modules/students/import/student-import.handler';
import { StudentImportService } from '../src/modules/students/import/student-import.service';

const FILE =
  process.argv.find((arg) => arg.endsWith('.xlsx')) ??
  path.join(
    process.env.USERPROFILE ?? '',
    'OneDrive',
    'Desktop',
    'Import Live 1-3-5',
    'I Sem B.A',
    'I SEM ARTS - READY TO IMPORT.xlsx',
  );
const REPORT = FILE.replace(/\.xlsx$/i, ' - ERP COMMIT.txt');
const importMode =
  process.argv.includes('--merge') || /MERGE/i.test(path.basename(FILE))
    ? 'MERGE'
    : 'CREATE';

async function main() {
  if (!fs.existsSync(FILE)) throw new Error(`File not found: ${FILE}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const prisma = app.get(PrismaService);
    const handler = app.get(StudentImportHandler);
    const batches = app.get(ImportBatchRepository);
    const importService = app.get(StudentImportService);
    const tenant =
      (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
      (await prisma.tenant.findFirst({
        where: { name: { contains: 'Don Bosco' } },
      }));
    if (!tenant) throw new Error('Tenant not found');
    const admin = await prisma.user.findFirst({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) throw new Error('Admin user not found');

    const parsed = await parseExcelDataSheet(fs.readFileSync(FILE), {
      sheetName: 'Students',
      dataStartRow: 3,
    });
    console.log(`Parsed ${parsed.length} rows. Validating ${importMode}...`);
    const results = await handler.parseAndValidate(tenant.id, parsed, {
      importMode,
    });
    const valid = results.filter((r) => r.status === 'VALID');
    const invalid = results.filter((r) => r.status !== 'VALID');
    console.log(`Valid ${valid.length}, invalid ${invalid.length}`);
    if (invalid.length) {
      for (const row of invalid.slice(0, 20)) {
        const raw = row.raw as Record<string, unknown>;
        console.log(
          `  Row ${row.rowNumber} ${raw.fullName ?? ''}: ${row.errors.join(' | ')}`,
        );
      }
      throw new Error(
        `Refusing to commit: ${invalid.length} invalid row(s). Re-run mapping/validation first.`,
      );
    }

    const batch = await batches.createBatch({
      tenantId: tenant.id,
      module: 'STUDENT_MASTER',
      uploadedByUserId: admin.id,
      fileName: path.basename(FILE),
      status: 'UPLOADED',
    });
    await batches.insertRows(batch.id, results);
    await batches.updateBatch(batch.id, tenant.id, {
      status: 'VALIDATED',
      totalRows: results.length,
      validRows: valid.length,
      invalidRows: 0,
    });
    console.log(
      `Batch ${batch.id} validated. Committing ${valid.length} students...`,
    );

    const committed = await importService.commit(
      tenant.id,
      admin.id,
      batch.id,
      'STRICT',
      importMode,
      { preferSync: true },
    );

    const created = await prisma.student.count({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        enrollmentNumber: { startsWith: 'EC26-' },
      },
    });
    const ba1 = await prisma.student.count({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [
          { enrollmentNumber: { startsWith: 'EC26-' } },
          { enrollmentNumber: { startsWith: 'ED26-' } },
          { enrollmentNumber: { startsWith: 'EN26-' } },
          { enrollmentNumber: { startsWith: 'GA26-' } },
          { enrollmentNumber: { startsWith: 'GE26-' } },
          { enrollmentNumber: { startsWith: 'HI26-' } },
          { enrollmentNumber: { startsWith: 'PHI26-' } },
          { enrollmentNumber: { startsWith: 'PS26-' } },
          { enrollmentNumber: { startsWith: 'SO26-' } },
        ],
      },
    });
    const com1 = await prisma.student.count({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [
          { enrollmentNumber: { startsWith: 'COM26-' } },
          { rollNumber: { startsWith: 'COM26-' } },
        ],
      },
    });
    const sci1 = await prisma.student.count({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        OR: [
          { enrollmentNumber: { startsWith: 'BOT26-' } },
          { enrollmentNumber: { startsWith: 'CHE26-' } },
          { enrollmentNumber: { startsWith: 'MAT26-' } },
          { enrollmentNumber: { startsWith: 'PHY26-' } },
          { enrollmentNumber: { startsWith: 'ZOO26-' } },
          { rollNumber: { startsWith: 'BOT26-' } },
          { rollNumber: { startsWith: 'CHE26-' } },
          { rollNumber: { startsWith: 'MAT26-' } },
          { rollNumber: { startsWith: 'PHY26-' } },
          { rollNumber: { startsWith: 'ZOO26-' } },
        ],
      },
    });

    const morning1 = await prisma.student.count({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        primaryShift: { code: 'MORNING' },
        OR: [
          { enrollmentNumber: { startsWith: 'EC26-1' } },
          { enrollmentNumber: { startsWith: 'ED26-1' } },
          { enrollmentNumber: { startsWith: 'EN26-1' } },
          { enrollmentNumber: { startsWith: 'GA26-1' } },
          { enrollmentNumber: { startsWith: 'HI26-1' } },
          { enrollmentNumber: { startsWith: 'PHI26-1' } },
          { enrollmentNumber: { startsWith: 'PS26-1' } },
          { enrollmentNumber: { startsWith: 'SO26-1' } },
          { rollNumber: { startsWith: 'EC26-1' } },
          { rollNumber: { startsWith: 'ED26-1' } },
          { rollNumber: { startsWith: 'EN26-1' } },
          { rollNumber: { startsWith: 'GA26-1' } },
          { rollNumber: { startsWith: 'HI26-1' } },
          { rollNumber: { startsWith: 'PHI26-1' } },
          { rollNumber: { startsWith: 'PS26-1' } },
          { rollNumber: { startsWith: 'SO26-1' } },
        ],
      },
    });

    const fileName = path.basename(FILE).toUpperCase();
    const title = fileName.includes('SCIENCE')
      ? 'I SEM SCIENCE — ERP commit'
      : fileName.includes('COMMERCE')
        ? 'I SEM COMMERCE — ERP commit'
        : fileName.includes('MORNING') || fileName.includes('MERGE')
          ? `I SEM MORNING — ERP ${importMode}`
          : 'I SEM ARTS — ERP commit';

    const lines = [
      title,
      '='.repeat(60),
      `File: ${FILE}`,
      `Tenant: ${tenant.slug}`,
      `Batch: ${committed.batchId}`,
      `Status: ${committed.status}`,
      `Successful rows: ${committed.successfulRows ?? 0}`,
      `Failed rows: ${committed.failedRows ?? 0}`,
      `Students with Sem 1 BA rolls now in ERP: ${ba1}`,
      `Economics (EC26) sample count: ${created}`,
      `Students with Sem 1 B.Com rolls (COM26) now in ERP: ${com1}`,
      `Students with Sem 1 Science rolls now in ERP: ${sci1}`,
      `Students with Sem 1 Morning rolls now in ERP: ${morning1}`,
      `Import mode: ${importMode}`,
    ];
    fs.writeFileSync(REPORT, lines.join('\n'), 'utf8');
    console.log(lines.join('\n'));
    console.log(`\nReport: ${REPORT}`);
    process.exit(committed.status === 'COMMITTED' ? 0 : 1);
  } finally {
    try {
      await app.close();
    } catch {
      // ignore redis shutdown
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
