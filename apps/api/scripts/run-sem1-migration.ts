/**
 * Sem 1 FYUGP Arts migration — run step-by-step or all at once.
 *
 *   npx ts-node --transpile-only scripts/run-sem1-migration.ts --step=1
 *   npx ts-node --transpile-only scripts/run-sem1-migration.ts --step=all
 *   npx ts-node --transpile-only scripts/run-sem1-migration.ts --step=3 --apply
 *   npx ts-node --transpile-only scripts/run-sem1-migration.ts --step=3 --apply --import-mode=MERGE
 *   npx ts-node --transpile-only scripts/run-sem1-migration.ts --step=3 --apply --file="D:\Admissions\sem1-2026.xlsx"
 */
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import { AppModule } from '../src/app.module';
import { StudentImportService } from '../src/modules/students/import/student-import.service';
import { PoolSectionProvisioningService } from '../src/modules/academic-engine/services/pool-section-provisioning.service';
import { seedArtsFyugpCatalog } from '../prisma/seed-arts-fyugp-catalog';
import { seedArtsOddTimetable } from '../prisma/seed-arts-odd-timetable';

const prisma = new PrismaClient();

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const apply = process.argv.includes('--apply');
const stepArg = readArg('step') ?? 'all';
const tenantSlug = readArg('tenant') ?? 'demo';
const importModeArg = readArg('import-mode') as
  | 'CREATE'
  | 'MERGE'
  | 'auto'
  | undefined;
const fileArg = readArg('file');

function resolveImportPath(): string {
  if (fileArg) {
    const resolved = path.resolve(fileArg);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Import file not found: ${resolved}`);
    }
    return resolved;
  }
  return GENERATED_XLSX;
}

type StudentImportMode = 'CREATE' | 'MERGE';

function isDuplicateOnlyErrors(errors: string[]) {
  return (
    errors.length > 0 &&
    errors.every((error) =>
      /duplicate (registration number|email|roll number|aadhaar|rfid)/i.test(
        error,
      ),
    )
  );
}

async function resolveImportMode(
  importService: StudentImportService,
  tenantId: string,
  adminId: string,
  buffer: Buffer,
  requested: 'CREATE' | 'MERGE' | 'auto',
): Promise<StudentImportMode> {
  if (requested === 'CREATE' || requested === 'MERGE') return requested;

  const createPreview = await importService.validateUpload(
    tenantId,
    adminId,
    'sem1-admission-sample.xlsx',
    buffer,
    { importMode: 'CREATE' },
  );
  const duplicateOnly =
    createPreview.summary.valid === 0 &&
    createPreview.summary.invalid === createPreview.summary.total &&
    createPreview.rows.every((row) => isDuplicateOnlyErrors(row.errors));

  if (duplicateOnly) {
    console.log(
      'Existing students detected — switching import mode from CREATE to MERGE (updates NEP registrations).',
    );
    return 'MERGE';
  }
  return 'CREATE';
}

const SEM1_SAMPLE_PATH = path.join(
  __dirname,
  '../prisma/data/sem1-admission-sample.csv',
);
const GENERATED_XLSX = path.join(
  __dirname,
  '../prisma/data/sem1-admission-sample.xlsx',
);

async function resolveTenant() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" not found`);
  const institution = await prisma.institution.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  const campus = await prisma.campus.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'admin@demo.edu' },
  });
  if (!institution || !campus || !admin) {
    throw new Error('Missing institution, campus, or admin user');
  }
  return { tenant, institution, campus, admin };
}

async function step1VerifyCatalog() {
  console.log('\n=== Step 1: Verify Arts Sem 1 catalog + sections ===\n');
  const { tenant } = await resolveTenant();

  const sem1Courses = await prisma.course.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      OR: [
        { code: { endsWith: '-100' } },
        { code: { startsWith: 'MDC-11' } },
        { code: { startsWith: 'AEC-12' } },
        { code: { startsWith: 'SEC-13' } },
        { code: 'VAC-140' },
      ],
    },
  });

  const baPrograms = await prisma.program.count({
    where: { tenantId: tenant.id, code: { startsWith: 'BA-' } },
  });

  const unpublished = await prisma.programVersion.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      status: { not: 'PUBLISHED' },
      program: { code: { startsWith: 'BA-' } },
    },
    include: { program: { select: { code: true } } },
  });

  const sem1Offerings = await prisma.courseOffering.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      semesterSequence: 1,
    },
  });

  const sem1Sections = await prisma.offeringSection.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      courseOffering: { semesterSequence: 1, deletedAt: null },
    },
  });

  console.log(`Sem 1 / pool courses: ${sem1Courses}`);
  console.log(`BA programmes: ${baPrograms}`);
  console.log(`Sem 1 offerings: ${sem1Offerings}`);
  console.log(`Sem 1 sections: ${sem1Sections}`);
  console.log(`Unpublished BA versions: ${unpublished.length}`);

  if (unpublished.length) {
    console.log('  →', unpublished.map((pv) => pv.program.code).join(', '));
    if (apply) {
      await prisma.programVersion.updateMany({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          program: { code: { startsWith: 'BA-' } },
        },
        data: { status: 'PUBLISHED' },
      });
      console.log('Published all BA programme versions.');
    } else {
      console.log('Re-run with --apply to publish BA programme versions.');
    }
  }

  if (sem1Courses < 100) {
    console.log('\nCatalog looks thin — seeding Arts FYUGP catalog...');
    if (apply) {
      await runArtsCatalogSeed(tenant.id);
    } else {
      console.log('Re-run with --apply to seed catalog.');
    }
  }

  if (apply) {
    const poolService = new PoolSectionProvisioningService(prisma as never);
    const poolResult = await poolService.provisionPoolOfferings(tenant.id, {
      semesterNo: 1,
      categories: ['MDC', 'AEC', 'SEC', 'VAC'],
      shiftCode: 'DAY',
    });
    console.log(
      `Pool sections provisioned: ${poolResult.created} created, ${poolResult.skipped} skipped`,
    );
  }

  console.log('\nStep 1 complete.');
}

async function runArtsCatalogSeed(tenantId: string) {
  const institution = await prisma.institution.findFirst({
    where: { tenantId, deletedAt: null },
  });
  const semesters = await prisma.semester.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { sequence: 'asc' },
  });
  const semesterBySeq = Object.fromEntries(
    semesters.map((sem) => [sem.sequence, { id: sem.id }]),
  ) as Record<number, { id: string }>;
  const campus = await prisma.campus.findFirst({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  const dayShift = await prisma.shift.findFirst({
    where: { tenantId, campusId: campus!.id, code: 'DAY', deletedAt: null },
  });
  const admin = await prisma.user.findFirst({
    where: { tenantId, email: 'admin@demo.edu' },
  });
  await seedArtsFyugpCatalog({
    prisma,
    tenantId,
    institutionId: institution!.id,
    semesterBySeq,
    shifts: { DAY: dayShift! },
    createdById: admin?.id,
  });
  await prisma.programVersion.updateMany({
    where: {
      tenantId,
      deletedAt: null,
      program: { code: { startsWith: 'BA-' } },
    },
    data: { status: 'PUBLISHED' },
  });
  console.log('Arts FYUGP catalog seeded and BA versions published.');
}

async function step2BuildAdmissionExcel() {
  console.log('\n=== Step 2: Build admission Excel (fiels.txt shape) ===\n');
  if (!fs.existsSync(SEM1_SAMPLE_PATH)) {
    throw new Error(`Sample CSV missing: ${SEM1_SAMPLE_PATH}`);
  }

  const csv = fs.readFileSync(SEM1_SAMPLE_PATH, 'utf8');
  const lines = csv.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const values = line.split(',');
    return headers.map((_, i) => values[i] ?? '');
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Students');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  sheet.getRow(1).font = { bold: true };
  await workbook.xlsx.writeFile(GENERATED_XLSX);

  console.log(`Rows: ${rows.length}`);
  console.log(`Written: ${GENERATED_XLSX}`);
  console.log('\nStep 2 complete.');
}

async function step3ImportStudents() {
  console.log('\n=== Step 3: Import students + NEP selections ===\n');
  const importPath = resolveImportPath();
  console.log(`Import file: ${importPath}`);

  if (!apply) {
    console.log('Dry run — re-run with --apply to validate and commit import.');
    return;
  }
  if (!fileArg && !fs.existsSync(GENERATED_XLSX)) {
    await step2BuildAdmissionExcel();
  }

  const { tenant, admin } = await resolveTenant();
  const buffer = fs.readFileSync(importPath);
  const fileName = path.basename(importPath);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const importService = app.get(StudentImportService);
    const importMode = await resolveImportMode(
      importService,
      tenant.id,
      admin.id,
      buffer,
      importModeArg ?? 'auto',
    );
    console.log(`Import mode: ${importMode}`);

    const preview = await importService.validateUpload(
      tenant.id,
      admin.id,
      fileName,
      buffer,
      { importMode },
    );

    console.log(
      `Validation: ${preview.summary.valid} valid, ${preview.summary.invalid} invalid / ${preview.summary.total} total`,
    );

    for (const row of preview.rows) {
      const label =
        row.displayTitle ?? row.displayCode ?? `row ${row.rowNumber}`;
      if (row.status === 'VALID') {
        console.log(`  ✓ ${label}`);
      } else {
        console.log(`  ✗ ${label}: ${row.errors.join('; ')}`);
      }
    }

    if (preview.summary.invalid > 0) {
      throw new Error('Import validation failed — fix errors before commit.');
    }

    const committed = await importService.commit(
      tenant.id,
      admin.id,
      preview.batchId,
      'VALID_ONLY',
      importMode,
    );
    console.log(`Committed ${committed.successfulRows} student(s).`);
  } finally {
    await app.close();
  }
  console.log('\nStep 3 complete.');
}

async function step4PublishTimetable() {
  console.log('\n=== Step 4: Timetable (seed + publish) ===\n');
  const { tenant, institution, campus, admin } = await resolveTenant();
  const academicYear = await prisma.academicYear.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, name: '2026-27' },
  });

  if (apply) {
    await seedArtsOddTimetable({
      prisma,
      tenantId: tenant.id,
      institutionId: institution.id,
      campusId: campus.id,
      academicYearId: academicYear!.id,
      createdById: admin.id,
    });

    const plan = await prisma.timetablePlan.findFirst({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        name: { startsWith: 'Arts · Day Shift · ODD' },
      },
    });
    if (plan && plan.status !== 'PUBLISHED') {
      await prisma.timetablePlan.update({
        where: { id: plan.id },
        data: {
          status: 'PUBLISHED',
          approvalState: 'PUBLISHED',
          publishedAt: new Date(),
        },
      });
      console.log(`Published timetable plan: ${plan.name}`);
    } else if (plan) {
      console.log(`Timetable plan already published: ${plan.name}`);
    }
  } else {
    const entryCount = await prisma.timetablePlanEntry.count({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        plan: { name: { startsWith: 'Arts · Day Shift · ODD' } },
      },
    });
    console.log(`Existing timetable entries: ${entryCount}`);
    console.log('Re-run with --apply to seed and publish.');
  }
  console.log('\nStep 4 complete.');
}

async function step5Verify() {
  console.log('\n=== Step 5: Verify enrolment + section match ===\n');
  const { tenant } = await resolveTenant();

  const students = await prisma.student.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      importSource: 'IMPORT',
      enrollmentNumber: { startsWith: 'APP-2026-' },
    },
    include: {
      masterProfile: { select: { fullName: true } },
      semesterRegistrations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          lines: {
            include: {
              offering: { include: { course: { select: { code: true } } } },
              offeringSection: { select: { sectionCode: true } },
            },
          },
        },
      },
    },
    orderBy: { enrollmentNumber: 'asc' },
  });

  if (!students.length) {
    console.log(
      'No APP-2026-* imported students found. Run step 3 with --apply first.',
    );
    return;
  }

  const plan = await prisma.timetablePlan.findFirst({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      status: 'PUBLISHED',
      name: { startsWith: 'Arts · Day Shift · ODD' },
    },
  });

  for (const student of students) {
    const lines = student.semesterRegistrations[0]?.lines ?? [];
    const offeringIds = lines.map((l) => l.offeringId);
    const sectionByOffering = new Map(
      lines.map((l) => [l.offeringId, l.offeringSectionId ?? null]),
    );

    let visibleEntries = 0;
    if (plan && offeringIds.length) {
      const allEntries = await prisma.timetablePlanEntry.findMany({
        where: {
          tenantId: tenant.id,
          planId: plan.id,
          deletedAt: null,
          courseOfferingId: { in: offeringIds },
        },
      });
      visibleEntries = allEntries.filter((entry) => {
        if (!entry.courseOfferingId) return false;
        const enrolledSection = sectionByOffering.get(entry.courseOfferingId);
        if (entry.offeringSectionId == null) return true;
        if (enrolledSection == null) return true;
        return entry.offeringSectionId === enrolledSection;
      }).length;
    }

    const nepSummary = lines
      .map(
        (l) =>
          `${l.category}:${l.offering.course.code}[${l.offeringSection?.sectionCode ?? '-'}]`,
      )
      .join(' ');

    console.log(
      `  ${student.masterProfile?.fullName} (${student.enrollmentNumber}) — ${lines.length} papers, ${visibleEntries} timetable slots`,
    );
    console.log(`    ${nepSummary}`);
  }

  console.log('\nStep 5 complete.');
  console.log('Run full portal checks: npm run verify:student-portal -w api');
  console.log(
    'With HTTP login:       npm run verify:student-portal -w api -- --http',
  );
}

const STEPS: Record<string, () => Promise<void>> = {
  '1': step1VerifyCatalog,
  '2': step2BuildAdmissionExcel,
  '3': step3ImportStudents,
  '4': step4PublishTimetable,
  '5': step5Verify,
};

async function main() {
  console.log(
    `Sem 1 migration | tenant=${tenantSlug} | apply=${apply} | step=${stepArg}`,
  );

  if (stepArg === 'all') {
    for (const key of ['1', '2', '3', '4', '5']) {
      await STEPS[key]();
    }
    return;
  }

  const fn = STEPS[stepArg];
  if (!fn) {
    console.error(`Unknown step "${stepArg}". Use 1-5 or all.`);
    process.exit(1);
  }
  await fn();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
