import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StudentsService } from '../src/modules/students/students.service';

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

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('result' in value && value.result != null)
      return cellText(value.result);
    if ('text' in value && value.text) return String(value.text).trim();
  }
  return String(value).trim();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  if (!fs.existsSync(SOURCE)) throw new Error(`File not found: ${SOURCE}`);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const prisma = app.get(PrismaService);
    const students = app.get(StudentsService);
    const tenant =
      (await prisma.tenant.findFirst({ where: { slug: 'demo' } })) ??
      (await prisma.tenant.findFirst({
        where: { name: { contains: 'Don Bosco' } },
      }));
    if (!tenant) throw new Error('Tenant not found');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(SOURCE);
    const sheet = workbook.getWorksheet('Students') ?? workbook.worksheets[0];
    if (!sheet) throw new Error('Students sheet not found');

    const headers = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, col) => {
      const text = cellText(cell.value);
      if (text) headers.set(text, col);
    });
    const col = (...names: string[]) => {
      for (const name of names) {
        const idx = headers.get(name);
        if (idx) return idx;
      }
      return undefined;
    };

    const batchByCode = new Map(
      (
        await prisma.admissionBatch.findMany({
          where: { tenantId: tenant.id, deletedAt: null },
          select: { id: true, batchCode: true },
        })
      ).map((row) => [row.batchCode.toUpperCase(), row.id]),
    );
    const streamByCode = new Map(
      (
        await prisma.academicStream.findMany({
          where: { tenantId: tenant.id, deletedAt: null },
          select: { id: true, code: true },
        })
      ).map((row) => [row.code.toUpperCase(), row.id]),
    );
    const shiftByCode = new Map(
      (
        await prisma.shift.findMany({
          where: {
            tenantId: tenant.id,
            deletedAt: null,
            status: 'ACTIVE',
            campus: { deletedAt: null },
          },
          select: { id: true, code: true },
        })
      ).map((row) => [row.code.toUpperCase(), row.id]),
    );
    const programVersionByCode = new Map(
      (
        await prisma.programVersion.findMany({
          where: { tenantId: tenant.id, deletedAt: null, status: 'PUBLISHED' },
          include: { program: { select: { code: true } } },
          orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
        })
      ).map((row) => [row.program.code.toUpperCase(), row.id]),
    );

    let created = 0;
    let skipped = 0;
    for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const fullName = cellText(row.getCell(headers.get('Full Name')!).value);
      const rollNumber = cellText(
        row.getCell(headers.get('Roll Number')!).value,
      );
      if (!fullName || !rollNumber) continue;

      const existing = await prisma.student.findFirst({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          OR: [
            { rollNumber: { equals: rollNumber, mode: 'insensitive' } },
            { enrollmentNumber: { equals: rollNumber, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        console.log(`Skipped existing: ${rollNumber}`);
        continue;
      }

      const programmeCol = col('Programme', 'Programme Code');
      const shiftCol = col('Shift', 'Shift Code');
      const streamCol = col('Stream', 'Stream Code');
      const batchCol = col('Admission Batch', 'Batch Code');
      const emailCol = col('Email Address', 'Email');
      const dobCol = col('Date of Birth');
      const mobileCol = col('Mobile Number', 'Mobile');
      const majorCol = col('Major Department (Sem 5)', 'Major Department');
      const minorCol = col('Minor Department (Sem 5)', 'Minor Department');
      if (!programmeCol || !shiftCol || !streamCol || !batchCol || !emailCol) {
        throw new Error('Required import headers are missing in pending file');
      }
      const programmeCode = cellText(
        row.getCell(programmeCol).value,
      ).toUpperCase();
      const shiftCode = cellText(row.getCell(shiftCol).value).toUpperCase();
      const streamCode = cellText(row.getCell(streamCol).value).toUpperCase();
      const batchCode = cellText(row.getCell(batchCol).value).toUpperCase();
      const email = cellText(row.getCell(emailCol).value);
      const dob = dobCol
        ? cellText(row.getCell(dobCol).value) || undefined
        : undefined;
      const mobile = mobileCol
        ? cellText(row.getCell(mobileCol).value) || undefined
        : undefined;
      const major = majorCol ? cellText(row.getCell(majorCol).value) : '';
      const minor = minorCol ? cellText(row.getCell(minorCol).value) : '';

      const programVersionId = programVersionByCode.get(programmeCode);
      const shiftId = shiftByCode.get(shiftCode);
      const streamId = streamByCode.get(streamCode);
      const admissionBatchId = batchByCode.get(batchCode);
      if (!programVersionId || !shiftId || !streamId || !admissionBatchId) {
        throw new Error(
          `Missing mapping for ${rollNumber}: programme=${programmeCode}, shift=${shiftCode}, stream=${streamCode}, batch=${batchCode}`,
        );
      }

      await students.admit(tenant.id, {
        email,
        enrollmentNumber: rollNumber,
        fullName,
        rollNumber,
        programVersionId,
        admissionBatchId,
        streamId,
        primaryShiftId: shiftId,
        dateOfBirth: dob,
        mobileNumber: mobile,
        admissionDate: '2024-06-01',
        majorSubjectSlug: major ? slugify(major) : undefined,
        minorSubjectSlug: minor ? slugify(minor) : undefined,
      });
      created += 1;
      console.log(`Created bootstrap student: ${rollNumber}`);
    }

    console.log(`\nBootstrap done. Created=${created}, Skipped=${skipped}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
