/**
 * Build a real student import file from live curriculum data and validate (optionally commit).
 *
 *   npx ts-node --transpile-only scripts/test-student-bulk-import.ts
 *   npx ts-node --transpile-only scripts/test-student-bulk-import.ts --apply
 *   npx ts-node --transpile-only scripts/test-student-bulk-import.ts --file="D:\path\to\your.xlsx"
 */
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import ExcelJS from 'exceljs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StudentImportHandler } from '../src/modules/students/import/student-import.handler';
import { StudentImportService } from '../src/modules/students/import/student-import.service';

type FyugpCategory = 'MAJOR' | 'MINOR' | 'MDC' | 'AEC' | 'SEC' | 'VAC';

const apply = process.argv.includes('--apply');
const fileArg = process.argv
  .find((a) => a.startsWith('--file='))
  ?.slice('--file='.length);
const tenantSlug =
  process.argv
    .find((a) => a.startsWith('--tenant='))
    ?.slice('--tenant='.length) ?? 'demo';

const OUTPUT_DIR = path.join(__dirname, '../prisma/data');

function formatLabel(code: string, title: string) {
  return `${code.replace(/[\u2010-\u2015]/g, '-').trim()} - ${title.trim()}`;
}

async function resolveTenant(prisma: PrismaService) {
  const tenant =
    (await prisma.tenant.findFirst({ where: { slug: tenantSlug } })) ??
    (await prisma.tenant.findFirst({
      where: { name: { contains: 'Don Bosco' } },
    }));
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" not found`);
  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('No active admin user');
  return { tenant, admin };
}

async function pickCurriculumSample(prisma: PrismaService, tenantId: string) {
  const programVersion =
    (await prisma.programVersion.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        status: 'PUBLISHED',
        program: { code: 'BA-ECO' },
      },
      include: { program: { select: { code: true, name: true } } },
    })) ??
    (await prisma.programVersion.findFirst({
      where: { tenantId, deletedAt: null, status: 'PUBLISHED' },
      include: { program: { select: { code: true, name: true } } },
      orderBy: { program: { code: 'asc' } },
    }));
  if (!programVersion) throw new Error('No published programme version found');

  const batch = await prisma.admissionBatch.findFirst({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!batch) throw new Error('No admission batch found');

  const stream = await prisma.academicStream.findFirst({
    where: { tenantId, deletedAt: null },
    orderBy: { code: 'asc' },
  });
  if (!stream) throw new Error('No academic stream found');

  const campus = await prisma.campus.findFirst({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  const shift = await prisma.shift.findFirst({
    where: {
      tenantId,
      campusId: campus?.id,
      deletedAt: null,
      status: 'ACTIVE',
    },
    orderBy: { code: 'asc' },
  });
  if (!shift) throw new Error('No active shift found');

  const offerings = await prisma.courseOffering.findMany({
    where: {
      tenantId,
      deletedAt: null,
      semesterSequence: 1,
      course: { deletedAt: null, status: 'ACTIVE' },
    },
    include: {
      course: { select: { code: true, title: true, courseType: true } },
      categoryPool: { include: { assignments: { where: { active: true } } } },
    },
    orderBy: { course: { code: 'asc' } },
  });

  const programmePrefix = programVersion.program.code
    .split('-')[1]
    ?.toUpperCase();
  const inProgrammeScope = (offering: (typeof offerings)[number]) => {
    if (offering.programVersionId === programVersion.id) return true;
    return offering.categoryPool?.assignments.some(
      (a) => a.programVersionId === programVersion.id && a.active,
    );
  };

  const byCategory = new Map<FyugpCategory, { code: string; title: string }>();
  for (const offering of offerings) {
    const category = String(
      offering.category ??
        offering.categoryPool?.categoryType ??
        offering.course.courseType,
    ).toUpperCase() as FyugpCategory;
    if (!['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC'].includes(category))
      continue;
    if (!inProgrammeScope(offering)) continue;

    const code = offering.course.code.toUpperCase();
    const isProgrammeMajor =
      category === 'MAJOR' && programmePrefix && code.includes(programmePrefix);
    const existing = byCategory.get(category);

    if (category === 'MAJOR' && isProgrammeMajor) {
      byCategory.set(category, {
        code: offering.course.code,
        title: offering.course.title,
      });
      continue;
    }
    if (!existing) {
      byCategory.set(category, {
        code: offering.course.code,
        title: offering.course.title,
      });
    }
  }

  for (const offering of offerings) {
    const category = String(
      offering.category ??
        offering.categoryPool?.categoryType ??
        offering.course.courseType,
    ).toUpperCase() as FyugpCategory;
    if (!['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC'].includes(category))
      continue;
    if (!byCategory.has(category)) {
      byCategory.set(category, {
        code: offering.course.code,
        title: offering.course.title,
      });
    }
  }

  const major = byCategory.get('MAJOR');
  const minor = byCategory.get('MINOR');
  if (major && minor && major.code === minor.code) {
    const altMinor = offerings.find((o) => {
      const cat = String(
        o.category ?? o.categoryPool?.categoryType ?? o.course.courseType,
      ).toUpperCase();
      return cat === 'MINOR' && o.course.code !== major.code;
    });
    if (altMinor) {
      byCategory.set('MINOR', {
        code: altMinor.course.code,
        title: altMinor.course.title,
      });
    }
  }

  const missing = (
    ['MAJOR', 'MINOR', 'MDC', 'AEC', 'SEC', 'VAC'] as FyugpCategory[]
  ).filter((c) => !byCategory.has(c));
  if (missing.length) {
    console.warn(`Warning: no Sem 1 offering for: ${missing.join(', ')}`);
  }

  return {
    programme: programVersion.program.code,
    batch: batch.batchCode,
    stream: stream.code,
    shift: shift.code,
    byCategory,
  };
}

function buildTestRows(
  handler: StudentImportHandler,
  curriculum: Awaited<ReturnType<typeof pickCurriculumSample>>,
  stamp: string,
) {
  const pick = (category: FyugpCategory) => curriculum.byCategory.get(category);
  const major = pick('MAJOR');
  const minor = pick('MINOR');
  const mdc = pick('MDC');
  const aec = pick('AEC');
  const sec = pick('SEC');
  const vac = pick('VAC');

  const students = [
    {
      applicationNumber: `TEST-${stamp}-001`,
      fullName: 'Import Test Student Alpha',
      email: `import.test.alpha.${stamp}@student.demo.edu`,
      mobile: '9876501001',
    },
    {
      applicationNumber: `TEST-${stamp}-002`,
      fullName: 'Import Test Student Beta',
      email: `import.test.beta.${stamp}@student.demo.edu`,
      mobile: '9876501002',
    },
  ];

  const headers = handler.columnDefs.map((c) => c.header);
  const headerIndex = Object.fromEntries(headers.map((h, i) => [h, i]));

  const set = (row: string[], header: string, value: string) => {
    const idx = headerIndex[header];
    if (idx != null) row[idx] = value;
  };

  return students.map((student) => {
    const row = headers.map(() => '');
    set(row, 'Application Number', student.applicationNumber);
    set(row, 'Registration Number', student.applicationNumber);
    set(row, 'Full Name', student.fullName);
    set(row, 'Email', student.email);
    set(row, 'Mobile', student.mobile);
    set(row, 'Programme', curriculum.programme);
    set(row, 'Admission Batch', curriculum.batch);
    set(row, 'Stream', curriculum.stream);
    set(row, 'Shift', curriculum.shift);
    set(row, 'Current Semester', '1');
    set(row, 'Student Status', 'STUDYING');

    if (major) {
      set(row, 'MAJOR_CODE', formatLabel(major.code, major.title));
      set(row, 'Major Subject', major.title);
    }
    if (minor) {
      set(row, 'MINOR_CODE', formatLabel(minor.code, minor.title));
      set(row, 'Minor Subject', minor.title);
    }
    if (mdc) {
      set(row, 'MDC_CODE', formatLabel(mdc.code, mdc.title));
      set(row, 'MDC Choice', mdc.title);
    }
    if (aec) {
      set(row, 'AEC_CODE', formatLabel(aec.code, aec.title));
      set(row, 'AEC', aec.title);
    }
    if (sec) {
      set(row, 'SEC_CODE', formatLabel(sec.code, sec.title));
      set(row, 'SEC', sec.title);
    }
    if (vac) {
      set(row, 'VAC_CODE', formatLabel(vac.code, vac.title));
      set(row, 'VAC', vac.title);
    }
    set(row, 'Section Code', 'A');
    return row;
  });
}

async function buildTestWorkbook(
  handler: StudentImportHandler,
  testRows: string[][],
  outPath: string,
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Students');
  const headers = handler.columnDefs.map((c) => c.header);
  sheet.addRow(headers);
  sheet.addRow(headers.map(() => ''));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(2).font = { italic: true, color: { argb: 'FF666666' } };
  for (const row of testRows) {
    sheet.addRow(row);
  }
  sheet.columns.forEach((col) => {
    col.width = 22;
  });
  await workbook.xlsx.writeFile(outPath);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const prisma = app.get(PrismaService);
  const handler = app.get(StudentImportHandler);
  const importService = app.get(StudentImportService);

  try {
    const { tenant, admin } = await resolveTenant(prisma);
    const stamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const defaultOut = path.join(
      OUTPUT_DIR,
      `student-import-test-${stamp}.xlsx`,
    );

    let filePath: string;
    let buffer: Buffer;

    if (fileArg) {
      filePath = path.resolve(fileArg);
      if (!fs.existsSync(filePath))
        throw new Error(`File not found: ${filePath}`);
      buffer = fs.readFileSync(filePath);
      console.log(`Using provided file: ${filePath}`);
    } else {
      const curriculum = await pickCurriculumSample(prisma, tenant.id);
      console.log('\n=== Curriculum sample ===');
      console.log({
        programme: curriculum.programme,
        batch: curriculum.batch,
        stream: curriculum.stream,
        shift: curriculum.shift,
        subjects: Object.fromEntries(
          [...curriculum.byCategory.entries()].map(([k, v]) => [
            k,
            formatLabel(v.code, v.title),
          ]),
        ),
      });

      const testRows = buildTestRows(handler, curriculum, stamp);
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      await buildTestWorkbook(handler, testRows, defaultOut);
      filePath = defaultOut;
      buffer = fs.readFileSync(filePath);
      console.log(`\nTest file written: ${filePath}`);
      console.log(`Rows: ${testRows.length}`);
    }

    console.log('\n=== Validation ===');
    const preview = await importService.validateUpload(
      tenant.id,
      admin.id,
      path.basename(filePath),
      buffer,
      { importMode: 'CREATE' },
    );

    console.log(
      `Result: ${preview.summary.valid} valid, ${preview.summary.invalid} invalid / ${preview.summary.total} total`,
    );
    console.log(`Batch ID: ${preview.batchId}`);

    for (const row of preview.rows) {
      const label =
        row.displayTitle ?? row.displayCode ?? `row ${row.rowNumber}`;
      if (row.status === 'VALID') {
        const mapping = row.normalized as {
          fyugpMapping?: {
            major?: { courseCode?: string; resolvedLabel?: string };
            minor?: { courseCode?: string; resolvedLabel?: string };
            mdc?: { courseCode?: string; resolvedLabel?: string };
          };
        };
        const major = mapping?.fyugpMapping?.major;
        const minor = mapping?.fyugpMapping?.minor;
        const mdc = mapping?.fyugpMapping?.mdc;
        console.log(
          `  ✓ ${label}` +
            (major
              ? ` | Major=${major.courseCode ?? major.resolvedLabel}`
              : '') +
            (minor
              ? ` | Minor=${minor.courseCode ?? minor.resolvedLabel}`
              : '') +
            (mdc ? ` | MDC=${mdc.courseCode ?? mdc.resolvedLabel}` : ''),
        );
        if (row.warnings?.length) {
          console.log(`    warnings: ${row.warnings.join('; ')}`);
        }
      } else {
        console.log(`  ✗ ${label}: ${row.errors.join('; ')}`);
      }
    }

    if (preview.summary.invalid > 0) {
      console.log(
        '\nValidation failed. Fix errors and re-run, or open the file in Excel and adjust subjects.',
      );
      process.exitCode = 1;
      return;
    }

    if (!apply) {
      console.log(
        '\nDry run complete. Re-run with --apply to commit these students.',
      );
      return;
    }

    const committed = await importService.commit(
      tenant.id,
      admin.id,
      preview.batchId,
      'VALID_ONLY',
      'CREATE',
    );
    console.log(`\nCommitted ${committed.successfulRows} student(s).`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
