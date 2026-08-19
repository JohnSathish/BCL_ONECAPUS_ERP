/**
 * Import the three Principal-approved unofficial Sem 1 major-minor pairs
 * and record named overrides (does not change the college-wide table).
 *
 *   npx ts-node --transpile-only scripts/commit-sem1-ba-principal-exceptions.ts
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { parseExcelDataSheet } from '../src/common/import/excel.util';
import { ImportBatchRepository } from '../src/common/import/import-batch.repository';
import { PrismaService } from '../src/database/prisma.service';
import { StudentMajorMinorOverrideService } from '../src/modules/academic-engine/services/student-major-minor-override.service';
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

const TARGET_ROLLS = new Set(
  process.argv
    .find((arg) => arg.startsWith('--rolls='))
    ?.slice('--rolls='.length)
    .split(',')
    .map((roll) => roll.trim().toUpperCase())
    .filter(Boolean) ??
    (/MERGE/i.test(FILE) ? ['SO26-148'] : ['EN26-45', 'HI26-36', 'SO26-42']),
);

const OVERRIDES: Array<{
  roll: string;
  major: string;
  minor: string;
}> = [
  { roll: 'EN26-45', major: 'English', minor: 'History' },
  { roll: 'HI26-36', major: 'History', minor: 'Education' },
  { roll: 'SO26-42', major: 'Sociology', minor: 'Education' },
  { roll: 'SO26-148', major: 'Sociology', minor: 'Education' },
];

function normalizeLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string) {
  return normalizeLabel(value).replace(/\s+/g, '-');
}

async function resolveSubjectId(
  prisma: PrismaService,
  tenantId: string,
  label: string,
) {
  const desired = normalizeLabel(label);
  const desiredSlug = slugify(label);
  const rows = await prisma.academicSubject.findMany({
    where: { tenantId, deletedAt: null, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      department: { select: { name: true } },
    },
  });
  const match =
    rows.find((row) => normalizeLabel(row.name) === desired) ??
    rows.find(
      (row) => normalizeLabel(row.department?.name ?? '') === desired,
    ) ??
    rows.find((row) => row.slug === desiredSlug);
  if (!match) throw new Error(`Academic subject not found for "${label}"`);
  return match.id;
}

async function main() {
  const overrideOnly = process.argv.includes('--override-only');
  if (!overrideOnly && !fs.existsSync(FILE)) {
    throw new Error(`File not found: ${FILE}`);
  }
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const prisma = app.get(PrismaService);
    const handler = app.get(StudentImportHandler);
    const batches = app.get(ImportBatchRepository);
    const importService = app.get(StudentImportService);
    const overrides = app.get(StudentMajorMinorOverrideService);
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

    if (!overrideOnly) {
      const parsed = (
        await parseExcelDataSheet(fs.readFileSync(FILE), {
          sheetName: 'Students',
          dataStartRow: 3,
        })
      ).filter((row) => {
        const raw = row.raw as Record<string, unknown>;
        const roll = String(raw.rollNumber ?? raw.registrationNumber ?? '')
          .trim()
          .toUpperCase();
        return TARGET_ROLLS.has(roll);
      });
      if (parsed.length !== TARGET_ROLLS.size) {
        throw new Error(
          `Expected ${TARGET_ROLLS.size} exception rows, found ${parsed.length}. Re-run the mapper first.`,
        );
      }

      const results = await handler.parseAndValidate(tenant.id, parsed, {
        importMode: 'CREATE',
      });
      const invalid = results.filter((row) => row.status !== 'VALID');
      if (invalid.length) {
        for (const row of invalid) {
          console.log(`Row ${row.rowNumber}: ${row.errors.join(' | ')}`);
        }
        throw new Error('Exception rows did not validate');
      }

      const batch = await batches.createBatch({
        tenantId: tenant.id,
        module: 'STUDENT_MASTER',
        uploadedByUserId: admin.id,
        fileName: `${path.basename(FILE)} [principal exceptions]`,
        status: 'UPLOADED',
      });
      await batches.insertRows(batch.id, results);
      await batches.updateBatch(batch.id, tenant.id, {
        status: 'VALIDATED',
        totalRows: results.length,
        validRows: results.length,
        invalidRows: 0,
      });
      const committed = await importService.commit(
        tenant.id,
        admin.id,
        batch.id,
        'STRICT',
        'CREATE',
        { preferSync: true },
      );
      console.log(
        `Imported ${committed.successfulRows} student(s). Status ${committed.status}`,
      );
    }

    for (const entry of OVERRIDES.filter((item) =>
      TARGET_ROLLS.has(item.roll),
    )) {
      const student = await prisma.student.findFirst({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          OR: [
            { enrollmentNumber: { equals: entry.roll, mode: 'insensitive' } },
            { rollNumber: { equals: entry.roll, mode: 'insensitive' } },
          ],
        },
        select: { id: true, enrollmentNumber: true },
      });
      if (!student) {
        throw new Error(`Imported student ${entry.roll} not found`);
      }
      const existing = await prisma.studentMajorMinorOverride.findFirst({
        where: {
          tenantId: tenant.id,
          studentId: student.id,
          status: 'APPROVED',
          revokedAt: null,
        },
      });
      if (existing) {
        console.log(`Override already exists for ${entry.roll}`);
        continue;
      }
      await overrides.createOverride(tenant.id, student.id, admin.id, {
        majorSubjectId: await resolveSubjectId(prisma, tenant.id, entry.major),
        minorSubjectId: await resolveSubjectId(prisma, tenant.id, entry.minor),
        effectiveFromSemester: 1,
        status: 'APPROVED',
        approvalAuthority: 'PRINCIPAL',
        approvalRef: 'Principal-Sem1-2026-BA-exceptions',
        reason:
          'Principal-approved exception for three 2026 First Semester B.A. students only. Not a change to the official combination table.',
        metadata: {
          roll: entry.roll,
          major: entry.major,
          minor: entry.minor,
        },
      });
      console.log(
        `Override recorded: ${entry.roll} ${entry.major} + ${entry.minor}`,
      );
    }
    process.exit(0);
  } finally {
    try {
      await app.close();
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
