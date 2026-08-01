import type { PrismaClient } from '@prisma/client';
import {
  readCatalogSeedExclusions,
  reinstateCatalogSeedCourseCodes,
} from '../src/common/services/catalog-seed-exclusions.util';
import type { ArtsFyugpCourseDef } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';
import { normalizeNehuCourseCode } from '../src/modules/academic-engine/domain/course-code.util';
import {
  buildScienceFyugpEvenCourses,
  buildScienceFyugpSem2MinorCourseDefs,
  buildScienceFyugpSem5MinorCourseDefs,
} from '../src/modules/academic-engine/domain/science-fyugp-even-catalog';
import {
  buildScienceFyugpOddCourses,
  SCIENCE_FYUGP_DEPARTMENTS,
} from '../src/modules/academic-engine/domain/science-fyugp-odd-catalog';
import { DEFAULT_FYUGP_SEMESTER_RULES } from '../src/modules/academic-engine/domain/fyugp-templates';
import { upsertSemesterStructureRules } from '../src/modules/academic-engine/services/structure-rules.helper';
import { syncProgramPromotionMappings } from '../src/modules/academic-lifecycle/utils/sync-promotion-mappings';

export type SeedScienceFyugpCatalogContext = {
  prisma: PrismaClient;
  tenantId: string;
  institutionId: string;
  semesterBySeq: Record<number, { id: string }>;
  shifts: Record<string, { id: string }>;
  createdById?: string;
};

const PROMOTION_PAIRS = [
  { fromSequence: 1, toSequence: 2 },
  { fromSequence: 2, toSequence: 3 },
  { fromSequence: 3, toSequence: 4 },
  { fromSequence: 4, toSequence: 5 },
  { fromSequence: 5, toSequence: 6 },
  { fromSequence: 6, toSequence: 7 },
  { fromSequence: 7, toSequence: 8 },
] as const;

const LEGACY_MATHEMATICS_COURSE_MIGRATIONS: ReadonlyArray<
  readonly [string, string]
> = [
  ['MTH-352 B', 'MTH-353'],
  ['MTH-352B', 'MTH-353'],
  ['MTH-302 B', 'MTH-302'],
  ['MTH-302B', 'MTH-302'],
];

async function migrateLegacyMathematicsCatalog(
  prisma: PrismaClient,
  tenantId: string,
) {
  for (const [legacyCode, targetCode] of LEGACY_MATHEMATICS_COURSE_MIGRATIONS) {
    if (legacyCode === targetCode) continue;
    const legacyCourse = await prisma.course.findFirst({
      where: { tenantId, code: legacyCode },
      orderBy: { createdAt: 'asc' },
    });
    const targetCourse = await prisma.course.findFirst({
      where: { tenantId, code: targetCode, deletedAt: null },
    });
    if (!legacyCourse) continue;
    if (!targetCourse) {
      await prisma.course.update({
        where: { id: legacyCourse.id },
        data: { code: targetCode, deletedAt: null },
      });
      continue;
    }
    if (legacyCourse.id !== targetCourse.id) {
      await prisma.course.update({
        where: { id: legacyCourse.id },
        data: { deletedAt: new Date() },
      });
    }
  }
}

async function retireLegacyScienceCourseCodes(
  prisma: PrismaClient,
  tenantId: string,
) {
  const legacyCodes = [
    'BOT-302 M',
    'BOT-302M',
    'BOT-304',
    'CHE-304',
    'MTH-302 B',
    'MTH-302B',
    'MTH-352 B',
    'MTH-352B',
    'MTH-304',
    'ZOO-302 B',
    'ZOO-302B',
    'ZOO-304',
    'PHY-302 B',
    'PHY-302B',
    'PHY-304',
  ];
  for (const code of legacyCodes) {
    const legacy = await prisma.course.findFirst({
      where: { tenantId, code, deletedAt: null },
      select: { id: true },
    });
    if (legacy) {
      await prisma.course.update({
        where: { id: legacy.id },
        data: { deletedAt: new Date() },
      });
    }
  }
}

export async function seedScienceFyugpCatalog(
  ctx: SeedScienceFyugpCatalogContext,
) {
  const { prisma, tenantId, semesterBySeq, shifts } = ctx;
  const dayShiftId = shifts.DAY?.id;
  if (!dayShiftId) {
    throw new Error('Day shift required for Science FYUGP catalog seed');
  }

  const departments = await prisma.department.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true },
  });
  const departmentIdByCode = new Map(
    departments.map((row) => [row.code, row.id]),
  );

  const programVersions = new Map<string, { id: string; programId: string }>();

  for (const dept of SCIENCE_FYUGP_DEPARTMENTS) {
    const departmentId = departmentIdByCode.get(dept.code);
    if (!departmentId) {
      console.warn(`Science seed skip: department ${dept.code} not found`);
      continue;
    }

    let program = await prisma.program.findFirst({
      where: { tenantId, code: dept.programCode },
    });
    if (!program) {
      program = await prisma.program.create({
        data: {
          tenantId,
          departmentId,
          code: dept.programCode,
          name: dept.programName,
          level: 'UG',
        },
      });
    } else if (
      program.departmentId !== departmentId ||
      program.name !== dept.programName
    ) {
      program = await prisma.program.update({
        where: { id: program.id },
        data: {
          departmentId,
          name: dept.programName,
        },
      });
    }

    let version = await prisma.programVersion.findFirst({
      where: { tenantId, programId: program.id, version: 1, deletedAt: null },
    });
    if (!version) {
      version = await prisma.programVersion.create({
        data: {
          tenantId,
          programId: program.id,
          version: 1,
          cbcsEnabled: true,
          nepProfile: { multipleEntryExit: true, abcEnabled: true },
        },
      });
    }
    programVersions.set(dept.programCode, {
      id: version.id,
      programId: program.id,
    });
  }

  const oddCourses = buildScienceFyugpOddCourses();
  const evenCourses = buildScienceFyugpEvenCourses();
  const allCourses = [...oddCourses, ...evenCourses];

  await reinstateCatalogSeedCourseCodes(
    prisma,
    tenantId,
    allCourses.map((course) => course.code),
  );
  const seedExclusions = readCatalogSeedExclusions(
    (
      await prisma.tenantAcademicSettings.findUnique({
        where: { tenantId },
        select: { nepProfile: true },
      })
    )?.nepProfile as Record<string, unknown> | null,
  );

  const courseByCode = new Map<string, string>();
  for (const courseDef of allCourses) {
    if (seedExclusions.excludedCourseCodes.has(courseDef.code)) {
      console.log(`Science seed skip (removed course): ${courseDef.code}`);
      continue;
    }
    const courseId = await upsertScienceCourse(
      prisma,
      tenantId,
      courseDef,
      departmentIdByCode.get(courseDef.departmentCode),
    );
    courseByCode.set(courseDef.code, courseId);
  }

  await migrateLegacyMathematicsCatalog(prisma, tenantId);
  await retireLegacyScienceCourseCodes(prisma, tenantId);

  const shiftIdsForSections = [dayShiftId].filter(Boolean) as string[];

  for (const courseDef of oddCourses) {
    const programCode = courseDef.programCode;
    if (!programCode) continue;
    const version = programVersions.get(programCode);
    if (!version) continue;
    await upsertDirectOffering(
      prisma,
      tenantId,
      version.id,
      courseByCode.get(courseDef.code)!,
      courseDef,
      semesterBySeq,
      shiftIdsForSections,
    );
  }

  for (const [programCode, version] of programVersions) {
    const sem2Major = evenCourses.find(
      (course) =>
        course.programCode === programCode && course.category === 'MAJOR',
    );
    if (sem2Major && courseByCode.has(sem2Major.code)) {
      await upsertDirectOffering(
        prisma,
        tenantId,
        version.id,
        courseByCode.get(sem2Major.code)!,
        sem2Major,
        semesterBySeq,
        shiftIdsForSections,
      );
    }

    for (const honoursDef of evenCourses.filter(
      (course) =>
        course.programCode === programCode &&
        course.category === 'MAJOR' &&
        (course.semesterSequence === 4 || course.semesterSequence === 6),
    )) {
      const courseId = courseByCode.get(honoursDef.code);
      if (!courseId) continue;
      await upsertDirectOffering(
        prisma,
        tenantId,
        version.id,
        courseId,
        honoursDef,
        semesterBySeq,
        shiftIdsForSections,
      );
    }

    for (const minorDef of buildScienceFyugpSem2MinorCourseDefs(programCode)) {
      const courseId = courseByCode.get(minorDef.code);
      if (!courseId) continue;
      await upsertDirectOffering(
        prisma,
        tenantId,
        version.id,
        courseId,
        minorDef,
        semesterBySeq,
        shiftIdsForSections,
      );
    }

    for (const minorDef of buildScienceFyugpSem5MinorCourseDefs(programCode)) {
      const courseId = courseByCode.get(minorDef.code);
      if (!courseId) continue;
      await upsertDirectOffering(
        prisma,
        tenantId,
        version.id,
        courseId,
        minorDef,
        semesterBySeq,
        shiftIdsForSections,
      );
    }

    await upsertSemesterStructureRules(
      prisma,
      tenantId,
      version.id,
      DEFAULT_FYUGP_SEMESTER_RULES,
      undefined,
      { preserveExisting: true },
    );

    await prisma.programVersion.updateMany({
      where: { id: version.id, tenantId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  let promotionMappings = 0;
  for (const version of programVersions.values()) {
    const result = await syncProgramPromotionMappings(
      prisma,
      tenantId,
      version.id,
      [...PROMOTION_PAIRS],
    );
    promotionMappings += result.created;
  }

  console.log(
    `Science FYUGP catalog seeded: ${oddCourses.length} ODD + ${evenCourses.length} EVEN courses, ${programVersions.size} science programmes, ${promotionMappings} promotion mappings`,
  );

  return {
    programVersionIds: [...programVersions.values()].map((v) => v.id),
    programVersions,
  };
}

async function upsertScienceCourse(
  prisma: PrismaClient,
  tenantId: string,
  courseDef: ArtsFyugpCourseDef,
  departmentId?: string,
) {
  const code = normalizeNehuCourseCode(courseDef.code);
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

  const data = {
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

  const existing = await prisma.course.findFirst({
    where: { tenantId, code },
  });

  let title = courseDef.title;
  if (departmentId) {
    const titleClash = await prisma.course.findFirst({
      where: {
        tenantId,
        departmentId,
        title: courseDef.title,
        deletedAt: null,
        ...(existing ? { id: { not: existing.id } } : {}),
      },
    });
    if (titleClash) {
      title = `${courseDef.title} (${code})`;
    }
  }

  if (existing) {
    // Never overwrite live curriculum titles/credits/hours on re-seed.
    return existing.id;
  }

  const course = await prisma.course.create({
    data: {
      tenantId,
      code,
      title,
      ...data,
      departmentId,
    },
  });
  return course.id;
}

async function upsertDirectOffering(
  prisma: PrismaClient,
  tenantId: string,
  programVersionId: string,
  courseId: string,
  courseDef: ArtsFyugpCourseDef,
  semesterBySeq: Record<number, { id: string }>,
  shiftIds: string[],
) {
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
}
