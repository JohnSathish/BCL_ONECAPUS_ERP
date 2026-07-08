/**
 * Benchmark student import validate + commit timings (throwaway-safe).
 *
 *   npx ts-node --transpile-only scripts/benchmark-student-import.ts --generate --rows=10 --commit --cleanup
 *   npx ts-node --transpile-only scripts/benchmark-student-import.ts --file="path.xlsx" --commit
 */
import * as fs from 'fs';
import * as path from 'path';
import { performance } from 'node:perf_hooks';
import { NestFactory } from '@nestjs/core';
import ExcelJS from 'exceljs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StudentImportService } from '../src/modules/students/import/student-import.service';
import { StudentImportHandler } from '../src/modules/students/import/student-import.handler';
import 'dotenv/config';

const fileArg = process.argv
  .find((arg) => arg.startsWith('--file='))
  ?.slice('--file='.length);
const rowsArg = Number(
  process.argv
    .find((arg) => arg.startsWith('--rows='))
    ?.slice('--rows='.length) ?? '10',
);
const shouldGenerate = process.argv.includes('--generate');
const shouldCommit = process.argv.includes('--commit');
const shouldCleanup = process.argv.includes('--cleanup');

const OUTPUT_DIR = path.join(__dirname, '../prisma/data');

function fmt(ms: number) {
  return `${(ms / 1000).toFixed(2)}s`;
}

async function resolveTenant(prisma: PrismaService) {
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
  return { tenant, admin };
}

async function pickBcomTemplateRow(prisma: PrismaService, tenantId: string) {
  const sourcePath = path.join(
    process.env.USERPROFILE ?? '',
    'OneDrive',
    'Desktop',
    'Import Live 1-3-5',
    'V SEM',
    'B.Com 5 Semester students Bulk Import - READY TO IMPORT.xlsx',
  );
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `Template source not found for throwaway benchmark: ${sourcePath}`,
    );
  }
  const batch = await prisma.admissionBatch.findFirst({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      batchCode: true,
      entrySession: { select: { name: true } },
    },
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(sourcePath);
  const sheet = workbook.worksheets[0];
  const headers: string[] = [];
  sheet.getRow(1).eachCell((cell, col) => {
    headers[col] = String(cell.value ?? '').trim();
  });
  const sample = sheet.getRow(3);
  const row: Record<string, string> = {};
  headers.forEach((header, col) => {
    if (!header) return;
    row[header] = String(sample.getCell(col).value ?? '').trim();
  });

  if (batch?.batchCode) {
    row['Admission Batch'] = batch.batchCode;
    row['Batch'] = batch.batchCode;
  }
  if (batch?.entrySession?.name) {
    row['Academic Year'] = batch.entrySession.name;
  }
  return { headers: headers.filter(Boolean), row };
}

async function generateThrowawayFile(
  prisma: PrismaService,
  tenantId: string,
  rowCount: number,
) {
  const stamp = Date.now().toString(36);
  const { headers, row: template } = await pickBcomTemplateRow(
    prisma,
    tenantId,
  );
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Students');
  sheet.addRow(headers);
  sheet.addRow(headers.map(() => ''));
  sheet.getRow(1).font = { bold: true };

  const clearedHeaders = new Set([
    'ABC ID',
    'Aadhaar Number',
    'Student Mobile Number',
    "Father's Mobile",
    "Mother's Mobile",
    'Guardian Mobile',
    'RFID Number',
    'University Roll Number',
    'University Registration Number',
    'Admission Number',
    'Application Number',
  ]);

  for (let index = 0; index < rowCount; index += 1) {
    const suffix = `${stamp}-${String(index + 1).padStart(3, '0')}`;
    const values = headers.map((header) => {
      if (clearedHeaders.has(header)) return '';
      switch (header) {
        case 'Registration Number':
          return `BENCH-${suffix}`;
        case 'Roll Number':
          return `BENCH-${suffix}`;
        case 'Full Name':
          return `Bench Import Student ${index + 1}`;
        case 'Email Address':
          return `bench.${suffix}@student.donboscocollege.ac.in`;
        default:
          return template[header] ?? '';
      }
    });
    sheet.addRow(values);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(
    OUTPUT_DIR,
    `benchmark-throwaway-${rowCount}-${stamp}.xlsx`,
  );
  await workbook.xlsx.writeFile(outPath);
  return outPath;
}

async function cleanupBatchStudents(
  prisma: PrismaService,
  tenantId: string,
  batchId: string,
) {
  const students = await prisma.student.findMany({
    where: { tenantId, importBatchId: batchId, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!students.length) return 0;

  const studentIds = students.map((student) => student.id);
  const userIds = students.map((student) => student.userId);

  await prisma.$transaction([
    prisma.student.updateMany({
      where: { id: { in: studentIds } },
      data: { deletedAt: new Date() },
    }),
    prisma.user.updateMany({
      where: { id: { in: userIds } },
      data: { deletedAt: new Date(), isActive: false },
    }),
  ]);
  return students.length;
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const importService = app.get(StudentImportService);
  void app.get(StudentImportHandler);

  try {
    const { tenant, admin } = await resolveTenant(prisma);

    let filePath = fileArg ? path.resolve(fileArg) : '';
    if (shouldGenerate || !filePath) {
      filePath = await generateThrowawayFile(
        prisma,
        tenant.id,
        Number.isFinite(rowsArg) && rowsArg > 0 ? rowsArg : 10,
      );
      console.log(`Generated throwaway file: ${filePath}`);
    }
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const buffer = fs.readFileSync(filePath);
    const label = path.basename(filePath);

    const validateStart = performance.now();
    const preview = await importService.validateUpload(
      tenant.id,
      admin.id,
      label,
      buffer,
      { importMode: 'CREATE' },
    );
    const validateMs = performance.now() - validateStart;

    console.log('\n=== Benchmark Results ===');
    console.log(`File: ${label}`);
    console.log(`Validate: ${fmt(validateMs)}`);
    console.log(
      `Rows: total=${preview.summary.total}, valid=${preview.summary.valid}, invalid=${preview.summary.invalid}`,
    );

    if (preview.summary.invalid > 0) {
      for (const row of preview.rows
        .filter((r) => r.status !== 'VALID')
        .slice(0, 5)) {
        console.log(`  invalid row ${row.rowNumber}: ${row.errors.join('; ')}`);
      }
      return;
    }

    if (!shouldCommit) {
      console.log('Commit skipped (pass --commit to measure full import).');
      return;
    }

    const batchId = preview.batchId;
    const commitCallStart = performance.now();
    const commitResult = await importService.commit(
      tenant.id,
      admin.id,
      batchId,
      'STRICT',
      'CREATE',
    );
    const commitCallMs = performance.now() - commitCallStart;

    let commitTotalMs = commitCallMs;
    let finalBatch = await importService.getBatch(tenant.id, batchId);

    if (commitResult.async) {
      console.log(
        `Commit queued (async enqueue): ${fmt(commitCallMs)} — running worker inline for timing`,
      );
      const workerStart = performance.now();
      await importService.runCommitJob(
        tenant.id,
        admin.id,
        batchId,
        'STRICT',
        'CREATE',
      );
      const workerMs = performance.now() - workerStart;
      commitTotalMs = commitCallMs + workerMs;
      finalBatch = await importService.getBatch(tenant.id, batchId);
      console.log(`Commit worker execution: ${fmt(workerMs)}`);
    } else {
      console.log(`Commit sync call: ${fmt(commitCallMs)}`);
    }

    const importedStudents = await prisma.student.count({
      where: { tenantId: tenant.id, importBatchId: batchId, deletedAt: null },
    });

    const perRowMs =
      preview.summary.valid > 0 ? commitTotalMs / preview.summary.valid : 0;

    console.log(`Commit total: ${fmt(commitTotalMs)}`);
    console.log(
      `Per student: ${fmt(perRowMs)} (${preview.summary.valid} rows)`,
    );
    console.log(`Batch status: ${finalBatch.status}`);
    console.log(`Students created: ${importedStudents}`);
    console.log(`End-to-end: ${fmt(validateMs + commitTotalMs)}`);

    if (shouldCleanup && importedStudents > 0) {
      const removed = await cleanupBatchStudents(prisma, tenant.id, batchId);
      console.log(`Cleanup: soft-deleted ${removed} throwaway student(s).`);
    }
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
