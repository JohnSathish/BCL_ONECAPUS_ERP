import type { PrismaClient } from '@prisma/client';
import {
  readCatalogSeedExclusions,
  reinstateCatalogSeedCourseCodes,
} from '../src/common/services/catalog-seed-exclusions.util';
import type { ArtsFyugpCourseDef } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';
import { normalizeNehuCourseCode } from '../src/modules/academic-engine/domain/course-code.util';
import {
  buildCommerceFyugpEvenCourses,
  buildCommerceFyugpSem2MinorCourseDefs,
  buildCommerceFyugpSem5MinorCourseDefs,
} from '../src/modules/academic-engine/domain/commerce-fyugp-even-catalog';
import {
  buildCommerceFyugpOddCourses,
  COMMERCE_FYUGP_DEPARTMENTS,
} from '../src/modules/academic-engine/domain/commerce-fyugp-odd-catalog';
import { DEFAULT_FYUGP_SEMESTER_RULES } from '../src/modules/academic-engine/domain/fyugp-templates';
import { upsertSemesterStructureRules } from '../src/modules/academic-engine/services/structure-rules.helper';
import { syncProgramPromotionMappings } from '../src/modules/academic-lifecycle/utils/sync-promotion-mappings';

export type SeedCommerceFyugpCatalogContext = {
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

async function retireLegacyCommerceCourseCodes(
  prisma: PrismaClient,
  tenantId: string,
) {
  for (const code of ['COM-304']) {
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

export async function seedCommerceFyugpCatalog(
  ctx: SeedCommerceFyugpCatalogContext,
) {
  const { prisma, tenantId, semesterBySeq, shifts } = ctx;
  const dayShiftId = shifts.DAY?.id;
  if (!dayShiftId) {
    throw new Error('Day shift required for Commerce FYUGP catalog seed');
  }

  const departments = await prisma.department.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true },
  });
  const departmentIdByCode = new Map(
    departments.map((row) => [row.code, row.id]),
  );

  const programVersions = new Map<string, { id: string; programId: string }>();

  for (const dept of COMMERCE_FYUGP_DEPARTMENTS) {
    const departmentId = departmentIdByCode.get(dept.code);
    if (!departmentId) {
      console.warn(`Commerce seed skip: department ${dept.code} not found`);
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
        data: { departmentId, name: dept.programName },
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

  const oddCourses = buildCommerceFyugpOddCourses();
  const evenCourses = buildCommerceFyugpEvenCourses();
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
      console.log(`Commerce seed skip (removed course): ${courseDef.code}`);
      continue;
    }
    const courseId = await upsertCommerceCourse(
      prisma,
      tenantId,
      courseDef,
      departmentIdByCode.get(courseDef.departmentCode),
    );
    courseByCode.set(courseDef.code, courseId);
  }

  await retireLegacyCommerceCourseCodes(prisma, tenantId);

  const shiftIdsForSections = [dayShiftId].filter(Boolean) as string[];

  async function resolveCourseId(code: string): Promise<string | undefined> {
    const cached = courseByCode.get(code);
    if (cached) return cached;
    const existing = await prisma.course.findFirst({
      where: { tenantId, code, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      courseByCode.set(code, existing.id);
      return existing.id;
    }
    return undefined;
  }

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

    for (const minorDef of buildCommerceFyugpSem2MinorCourseDefs(programCode)) {
      const courseId = await resolveCourseId(minorDef.code);
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

    for (const minorDef of buildCommerceFyugpSem5MinorCourseDefs(programCode)) {
      const courseId = await resolveCourseId(minorDef.code);
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
    `Commerce FYUGP catalog seeded: ${oddCourses.length} ODD + ${evenCourses.length} EVEN courses, ${programVersions.size} commerce programmes, ${promotionMappings} promotion mappings`,
  );

  return {
    programVersionIds: [...programVersions.values()].map((v) => v.id),
    programVersions,
  };
}

async function upsertCommerceCourse(
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

  return (
    await prisma.course.create({
      data: { tenantId, code, title, ...data, departmentId },
    })
  ).id;
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
