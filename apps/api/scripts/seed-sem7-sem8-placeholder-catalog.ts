/**
 * Seed provisional Sem 7 / Sem 8 courses + DIRECT offerings for FYUGP programmes.
 *
 * Usage (from apps/api):
 *   npx tsx scripts/seed-sem7-sem8-placeholder-catalog.ts
 *   npx tsx scripts/seed-sem7-sem8-placeholder-catalog.ts --dry-run
 *   npx tsx scripts/seed-sem7-sem8-placeholder-catalog.ts --tenant=demo
 */
import { PrismaClient } from '@prisma/client';
import { normalizeNehuCourseCode } from '../src/modules/academic-engine/domain/course-code.util';
import type { ArtsFyugpCourseDef } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';
import {
  buildSem7MinorCourseDefs,
  buildSem7Sem8HomeCourseDefs,
  buildSem7Sem8PlaceholderCourses,
  listSem7Sem8PlaceholderDepartments,
} from '../src/modules/academic-engine/domain/fyugp-sem7-sem8-placeholder-catalog';
import { DEFAULT_FYUGP_SEMESTER_RULES } from '../src/modules/academic-engine/domain/fyugp-templates';
import { upsertSemesterStructureRules } from '../src/modules/academic-engine/services/structure-rules.helper';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

const tenantSlug = readArg('tenant') ?? 'demo';
const dryRun = process.argv.includes('--dry-run');
const prisma = new PrismaClient();

const PROVISIONAL_MARKER = 'Provisional Sem';

async function ensureSemesters7And8(
  tenantId: string,
): Promise<Record<number, { id: string }>> {
  const institution = await prisma.institution.findFirst({
    where: { tenantId, deletedAt: null },
    select: { id: true },
  });
  if (!institution) throw new Error('Institution not found for tenant');

  const existing = await prisma.semester.findMany({
    where: {
      tenantId,
      deletedAt: null,
      sequence: { in: [7, 8] },
    },
    select: { id: true, sequence: true, isActive: true },
    orderBy: [{ isActive: 'desc' }, { sequence: 'asc' }],
  });
  const semesterBySeq: Record<number, { id: string }> = {};
  for (const s of existing) {
    if (!semesterBySeq[s.sequence]) {
      semesterBySeq[s.sequence] = { id: s.id };
    }
  }
  if (semesterBySeq[7] && semesterBySeq[8]) return semesterBySeq;

  let year4 = await prisma.academicYear.findFirst({
    where: {
      tenantId,
      institutionId: institution.id,
      deletedAt: null,
      OR: [{ academicYearIndex: 4 }, { name: '2029-30' }],
    },
  });
  if (!year4) {
    if (dryRun) {
      console.log('Dry-run: would create academic year 2029-30 (index 4)');
    } else {
      year4 = await prisma.academicYear.create({
        data: {
          tenantId,
          institutionId: institution.id,
          name: '2029-30',
          startDate: new Date('2029-07-01'),
          endDate: new Date('2030-06-30'),
          status: 'PLANNED',
          academicYearIndex: 4,
          isPrimarySession: false,
        },
      });
      console.log(`Created academic year ${year4.name}`);
    }
  }

  const defs = [
    {
      sem: 7,
      seqInYear: 1,
      type: 'ODD',
      start: '2029-07-01',
      end: '2029-12-15',
      terminal: false,
    },
    {
      sem: 8,
      seqInYear: 2,
      type: 'EVEN',
      start: '2030-01-01',
      end: '2030-06-30',
      terminal: true,
    },
  ] as const;

  for (const def of defs) {
    if (semesterBySeq[def.sem]) continue;
    if (dryRun) {
      console.log(`Dry-run: would create Semester ${def.sem}`);
      semesterBySeq[def.sem] = { id: `dry-sem-${def.sem}` };
      continue;
    }
    if (!year4) throw new Error('Academic year 4 required to create Sem 7/8');

    const sem = await prisma.semester.create({
      data: {
        tenantId,
        institutionId: institution.id,
        academicYearId: year4.id,
        name: `Semester ${def.sem}`,
        sequence: def.sem,
        semesterNumber: def.sem,
        semesterType: def.type,
        progressionOrder: def.sem,
        academicYearIndex: 4,
        isTerminal: def.terminal,
        isActive: false,
        status: 'PLANNED',
        startDate: new Date(def.start),
        endDate: new Date(def.end),
      },
    });
    semesterBySeq[def.sem] = { id: sem.id };
    console.log(`Created ${sem.name}`);
  }

  if (!dryRun) {
    await prisma.semester.updateMany({
      where: {
        tenantId,
        institutionId: institution.id,
        sequence: 6,
        isTerminal: true,
        deletedAt: null,
      },
      data: { isTerminal: false },
    });
  }

  return semesterBySeq;
}

async function upsertPlaceholderCourse(
  tenantId: string,
  courseDef: ArtsFyugpCourseDef,
  departmentId: string | undefined,
): Promise<{ courseId: string; created: boolean; skippedTitle: boolean }> {
  const code = normalizeNehuCourseCode(courseDef.code);
  const existing = await prisma.course.findFirst({
    where: { tenantId, code },
  });

  if (dryRun) {
    return {
      courseId: existing?.id ?? `dry-${code}`,
      created: !existing,
      skippedTitle: false,
    };
  }

  const deliveryType = courseDef.deliveryType ?? 'THEORY';
  const creditCalculationMode =
    courseDef.creditCalculationMode ?? 'AUTO_CALCULATED';
  const theoryCredits = courseDef.theoryCredits ?? courseDef.credits;
  const practicalCredits = courseDef.practicalCredits ?? 0;
  const hasPractical = practicalCredits > 0;
  const totalCredits =
    creditCalculationMode === 'MANUAL_OVERRIDE'
      ? courseDef.credits
      : theoryCredits + practicalCredits || courseDef.credits;

  const baseData = {
    credits: totalCredits,
    deliveryType,
    creditCalculationMode,
    requiresTheorySplit: theoryCredits > 0,
    requiresPracticalSplit: practicalCredits > 0,
    hasPractical,
    labRequired: hasPractical,
    theoryCredits,
    practicalCredits,
    theoryHoursPerWeek: courseDef.theoryHoursPerWeek ?? 0,
    practicalHoursPerWeek: courseDef.practicalHoursPerWeek ?? 0,
    totalTheoryContactHours: courseDef.totalTheoryContactHours ?? 0,
    totalPracticalContactHours: courseDef.totalPracticalContactHours ?? 0,
    totalContactHours: courseDef.totalContactHours ?? totalCredits * 15,
    subjectSlug: courseDef.subjectSlug,
    courseType: 'CORE',
    deletedAt: null,
    ...(departmentId ? { departmentId } : {}),
  };

  if (existing) {
    const keepCustomTitle =
      Boolean(existing.title) &&
      !existing.title.includes(PROVISIONAL_MARKER) &&
      existing.title !== courseDef.title;
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: {
        ...baseData,
        code,
        ...(keepCustomTitle ? {} : { title: courseDef.title }),
      },
    });
    return {
      courseId: course.id,
      created: false,
      skippedTitle: keepCustomTitle,
    };
  }

  const course = await prisma.course.create({
    data: {
      tenantId,
      code,
      title: courseDef.title,
      ...baseData,
      departmentId,
    },
  });
  return { courseId: course.id, created: true, skippedTitle: false };
}

async function upsertDirectOffering(
  tenantId: string,
  programVersionId: string,
  courseId: string,
  courseDef: ArtsFyugpCourseDef,
  semesterBySeq: Record<number, { id: string }>,
  shiftIds: string[],
): Promise<boolean> {
  if (dryRun) return true;

  const existingOff = await prisma.courseOffering.findFirst({
    where: {
      tenantId,
      programVersionId,
      courseId,
      semesterSequence: courseDef.semesterSequence,
      deletedAt: null,
      mappingSource: 'DIRECT',
      category: courseDef.category,
    },
  });

  const offering =
    existingOff ??
    (await prisma.courseOffering.create({
      data: {
        tenantId,
        programVersionId,
        courseId,
        mappingSource: 'DIRECT',
        semesterId: semesterBySeq[courseDef.semesterSequence]?.id,
        category: courseDef.category,
        semesterSequence: courseDef.semesterSequence,
        majorPaperIndex: courseDef.majorPaperIndex,
        capacity: 80,
        waitlistCapacity: 20,
      },
    }));

  for (const shiftId of shiftIds) {
    let section = await prisma.offeringSection.findFirst({
      where: {
        courseOfferingId: offering.id,
        shiftId,
        sectionCode: 'A',
        deletedAt: null,
      },
    });
    if (!section) {
      section = await prisma.offeringSection.create({
        data: {
          tenantId,
          courseOfferingId: offering.id,
          shiftId,
          sectionCode: 'A',
          capacity: 80,
          waitlistCapacity: 20,
          status: 'active',
        },
      });
    }
    await prisma.offeringSeatLedger.upsert({
      where: { offeringSectionId: section.id },
      create: { tenantId, offeringSectionId: section.id },
      update: {},
    });
  }

  return !existingOff;
}

async function main() {
  console.log(
    `Sem 7/8 placeholder seed — tenant=${tenantSlug}${dryRun ? ' (dry-run)' : ''}`,
  );

  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${tenantSlug}`);

  const semesterBySeq = await ensureSemesters7And8(tenant.id);
  if (!semesterBySeq[7] || !semesterBySeq[8]) {
    throw new Error(
      `Need semester sequence 7 and 8 rows (have: ${Object.keys(semesterBySeq).join(',')})`,
    );
  }

  const shifts = await prisma.shift.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      code: { in: ['DAY', 'MORNING', 'Day', 'Morning'] },
    },
    select: { id: true, code: true, name: true },
  });
  const shiftIds = [
    ...new Set(
      shifts
        .filter((s) => {
          const key = `${s.code} ${s.name}`.toUpperCase();
          return key.includes('DAY') || key.includes('MORNING');
        })
        .map((s) => s.id),
    ),
  ];
  if (!shiftIds.length) {
    throw new Error('No Day/Morning shifts found');
  }

  const departments = await prisma.department.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { id: true, code: true },
  });
  const departmentIdByCode = new Map(
    departments.map((d) => [d.code.toUpperCase(), d.id]),
  );

  const placeholderDepts = listSem7Sem8PlaceholderDepartments();
  const targetProgramCodes = new Set(
    placeholderDepts.map((d) => d.programCode),
  );

  const programVersions = await prisma.programVersion.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      status: 'PUBLISHED',
      program: { deletedAt: null, code: { in: [...targetProgramCodes] } },
    },
    include: { program: { select: { code: true, name: true } } },
  });

  const versionByProgramCode = new Map<
    string,
    { id: string; code: string; name: string }
  >();
  for (const v of programVersions) {
    versionByProgramCode.set(v.program.code, {
      id: v.id,
      code: v.program.code,
      name: v.program.name,
    });
  }

  console.log(
    `Programmes: ${versionByProgramCode.size}/${targetProgramCodes.size} published matches`,
  );

  const allCourseDefs = buildSem7Sem8PlaceholderCourses();
  const courseByCode = new Map<string, string>();
  let coursesCreated = 0;
  let titlesPreserved = 0;

  for (const courseDef of allCourseDefs) {
    const deptId = departmentIdByCode.get(
      courseDef.departmentCode.toUpperCase(),
    );
    const result = await upsertPlaceholderCourse(tenant.id, courseDef, deptId);
    courseByCode.set(normalizeNehuCourseCode(courseDef.code), result.courseId);
    if (result.created) coursesCreated += 1;
    if (result.skippedTitle) titlesPreserved += 1;
  }

  console.log(
    `Courses: ${allCourseDefs.length} defs, ${coursesCreated} created, ${titlesPreserved} custom titles preserved`,
  );

  let offeringsCreated = 0;
  let offeringsChecked = 0;

  for (const dept of placeholderDepts) {
    const version = versionByProgramCode.get(dept.programCode);
    if (!version) {
      console.log(`Skip (no published version): ${dept.programCode}`);
      continue;
    }

    const homeDefs = buildSem7Sem8HomeCourseDefs(dept.programCode);
    const minorDefs = buildSem7MinorCourseDefs(dept.programCode);
    const toOffer = [...homeDefs, ...minorDefs];

    for (const courseDef of toOffer) {
      const courseId = courseByCode.get(
        normalizeNehuCourseCode(courseDef.code),
      );
      if (!courseId || courseId.startsWith('dry-')) {
        if (dryRun) {
          offeringsChecked += 1;
          continue;
        }
        console.warn(`Missing course for offering: ${courseDef.code}`);
        continue;
      }
      offeringsChecked += 1;
      const created = await upsertDirectOffering(
        tenant.id,
        version.id,
        courseId,
        courseDef,
        semesterBySeq,
        shiftIds,
      );
      if (created) offeringsCreated += 1;
    }

    if (!dryRun) {
      await upsertSemesterStructureRules(
        prisma,
        tenant.id,
        version.id,
        DEFAULT_FYUGP_SEMESTER_RULES,
      );
    }
  }

  console.log(
    `Offerings checked: ${offeringsChecked}, newly created: ${offeringsCreated}`,
  );
  console.log(dryRun ? 'Dry-run complete (no writes).' : 'Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
