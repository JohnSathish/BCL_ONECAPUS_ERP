/**
 * Dry-run ERP validation for the mapped Sem 1 B.A. Day Shift workbook.
 * Does not insert students.
 *
 *   npx ts-node --transpile-only scripts/validate-sem1-ba-arts-import.ts
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { parseExcelDataSheet } from '../src/common/import/excel.util';
import { PrismaService } from '../src/database/prisma.service';
import { StudentImportHandler } from '../src/modules/students/import/student-import.handler';

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
const REPORT = FILE.replace(/\.xlsx$/i, ' - ERP VALIDATION.txt');
const importMode = process.argv.includes('--merge') ? 'MERGE' : 'CREATE';

async function main() {
  if (!fs.existsSync(FILE)) throw new Error(`File not found: ${FILE}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const prisma = app.get(PrismaService);
    const handler = app.get(StudentImportHandler);
    const tenant =
      (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
      (await prisma.tenant.findFirst({
        where: { name: { contains: 'Don Bosco' } },
      }));
    if (!tenant) throw new Error('Tenant not found');

    const parsed = await parseExcelDataSheet(fs.readFileSync(FILE), {
      sheetName: 'Students',
      dataStartRow: 3,
    });
    const results = await handler.parseAndValidate(tenant.id, parsed, {
      importMode,
    });

    const valid = results.filter((r) => r.status === 'VALID');
    const invalid = results.filter((r) => r.status !== 'VALID');
    const warningRows = valid.filter((r) => (r.warnings?.length ?? 0) > 0);

    const errorCounts = new Map<string, number>();
    for (const row of invalid) {
      for (const err of row.errors.length ? row.errors : ['(no error text)']) {
        errorCounts.set(err, (errorCounts.get(err) ?? 0) + 1);
      }
    }

    const lines = [
      'I SEM ARTS — ERP dry-run validation (no students inserted)',
      '='.repeat(72),
      `File: ${FILE}`,
      `Tenant: ${tenant.slug} (${tenant.name})`,
      `Mode: ${importMode}`,
      `Rows parsed: ${parsed.length}`,
      `Valid: ${valid.length}`,
      `Invalid: ${invalid.length}`,
      `Valid with warnings: ${warningRows.length}`,
      '',
      'Error summary',
      ...[...errorCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([msg, n]) => `  ${n}  ${msg}`),
      '',
      invalid.length ? 'Invalid rows' : 'No invalid rows.',
      ...invalid.map((row) => {
        const raw = row.raw as Record<string, unknown>;
        const name = String(raw.fullName ?? '');
        const reg = String(raw.registrationNumber ?? raw.rollNumber ?? '');
        return `  Excel row ${row.rowNumber}  ${reg}  ${name}  ${row.errors.join(' | ')}`;
      }),
    ];

    fs.writeFileSync(REPORT, lines.join('\n'), 'utf8');
    console.log(lines.slice(0, 40).join('\n'));
    if (invalid.length > 20) {
      console.log(`\n... ${invalid.length} invalid rows. Full list: ${REPORT}`);
    }
    console.log(`\nReport: ${REPORT}`);
    process.exit(invalid.length ? 1 : 0);
  } finally {
    try {
      await app.close();
    } catch {
      // Redis may already be closed after a long validation run.
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
