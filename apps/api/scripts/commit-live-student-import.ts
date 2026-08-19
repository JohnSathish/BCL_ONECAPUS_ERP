/**
 * CREATE-commit a mapped Students sheet into tenant demo.
 *
 *   npx ts-node --transpile-only scripts/commit-live-student-import.ts "<file.xlsx>"
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

const FILE = process.argv.find((arg) => arg.endsWith('.xlsx'));
if (!FILE) {
  console.error(
    'Usage: npx ts-node --transpile-only scripts/commit-live-student-import.ts "<READY TO IMPORT.xlsx>"',
  );
  process.exit(1);
}

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
    console.log(`Parsed ${parsed.length} rows from ${path.basename(FILE)}`);
    const results = await handler.parseAndValidate(tenant.id, parsed, {
      importMode: 'CREATE',
    });
    const valid = results.filter((r) => r.status === 'VALID');
    const invalid = results.filter((r) => r.status !== 'VALID');
    console.log(`Valid ${valid.length}, invalid ${invalid.length}`);
    if (invalid.length) {
      for (const row of invalid.slice(0, 25)) {
        const raw = row.raw as Record<string, unknown>;
        console.log(
          `  Row ${row.rowNumber} ${raw.fullName ?? raw.registrationNumber ?? ''}: ${row.errors.join(' | ')}`,
        );
      }
      throw new Error(
        `Refusing to commit: ${invalid.length} invalid row(s) in ${path.basename(FILE)}`,
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
    console.log(`Batch ${batch.id} validated. Committing ${valid.length}...`);

    const committed = await importService.commit(
      tenant.id,
      admin.id,
      batch.id,
      'STRICT',
      'CREATE',
      { preferSync: true },
    );

    const report = FILE.replace(/\.xlsx$/i, ' - ERP COMMIT.txt');
    const lines = [
      path.basename(FILE) + ' — ERP CREATE commit',
      '='.repeat(72),
      `File: ${FILE}`,
      `Tenant: ${tenant.slug}`,
      `Batch: ${committed.batchId ?? batch.id}`,
      `Status: ${committed.status}`,
      `Successful rows: ${committed.successfulRows ?? 0}`,
      `Failed rows: ${committed.failedRows ?? 0}`,
    ];
    fs.writeFileSync(report, lines.join('\n'), 'utf8');
    console.log(lines.join('\n'));
    console.log(`Report: ${report}`);
    if ((committed.failedRows ?? 0) > 0 || committed.status === 'FAILED') {
      throw new Error(`Commit failed for ${path.basename(FILE)}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
