import type { PrismaClient } from '@prisma/client';
import { readCatalogSeedExclusions } from '../src/common/services/catalog-seed-exclusions.util';
import {
  ARTS_FYUGP_DEPARTMENTS,
  buildArtsFyugpOddCourses,
  type ArtsFyugpCourseDef,
} from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';

export type SeedArtsFyugpCatalogContext = {
  prisma: PrismaClient;
  tenantId: string;
  institutionId: string;
  semesterBySeq: Record<number, { id: string }>;
  shifts: Record<string, { id: string }>;
  createdById?: string;
};

export async function seedArtsFyugpCatalog(ctx: SeedArtsFyugpCatalogContext) {
  const {
    prisma,
    tenantId,
    institutionId,
    semesterBySeq,
    shifts,
    createdById,
  } = ctx;
  const dayShiftId = shifts.DAY?.id;
  if (!dayShiftId) {
    throw new Error('Day shift required for Arts FYUGP catalog seed');
  }

  const academicSettings = await prisma.tenantAcademicSettings.findUnique({
    where: { tenantId },
  });
  const seedExclusions = readCatalogSeedExclusions(
    academicSettings?.nepProfile as Record<string, unknown> | null,
  );

  const departments = await prisma.department.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true },
  });
  const departmentIdByCode = new Map(
    departments.map((row) => [row.code, row.id]),
  );

  const programVersions = new Map<string, { id: string; programId: string }>();

  for (const dept of ARTS_FYUGP_DEPARTMENTS) {
    const departmentId = departmentIdByCode.get(dept.code);
    if (!departmentId) {
      console.warn(`Arts seed skip: department ${dept.code} not found`);
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
    } else if (program.departmentId !== departmentId) {
      program = await prisma.program.update({
        where: { id: program.id },
        data: { departmentId },
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

  const courseByCode = new Map<string, string>();
  const courses = buildArtsFyugpOddCourses();

  for (const courseDef of courses) {
    if (seedExclusions.excludedCourseCodes.has(courseDef.code)) {
      console.log(`Arts seed skip (removed course): ${courseDef.code}`);
      continue;
    }
    const courseId = await upsertArtsCourse(
      prisma,
      tenantId,
      courseDef,
      departmentIdByCode.get(courseDef.departmentCode),
    );
    courseByCode.set(courseDef.code, courseId);
  }

  for (const courseDef of courses) {
    if (courseDef.sharedPool) continue;
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
      dayShiftId,
    );
  }

  // Shared category pools (MDC/AEC/SEC/VAC/VTC) are managed via seedCategoryPools
  // and the Programs UI — not bulk-populated from the Arts catalog seed.

  console.log(
    `Arts FYUGP ODD catalog seeded: ${courses.length} courses, ${programVersions.size} BA programmes`,
  );
}

async function upsertArtsCourse(
  prisma: PrismaClient,
  tenantId: string,
  courseDef: ArtsFyugpCourseDef,
  departmentId?: string,
) {
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
    where: { tenantId, code: courseDef.code },
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
      title = `${courseDef.title} (${courseDef.code})`;
    }
  }

  if (existing) {
    // Never overwrite titles on seed replay — college catalog names are authoritative.
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: { ...data, title: existing.title },
    });
    return course.id;
  }

  const course = await prisma.course.create({
    data: {
      tenantId,
      code: courseDef.code,
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
  dayShiftId: string,
) {
  const existingOff = await prisma.courseOffering.findFirst({
    where: {
      tenantId,
      programVersionId,
      courseId,
      semesterSequence: courseDef.semesterSequence,
      deletedAt: null,
      mappingSource: 'DIRECT',
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

  let section = await prisma.offeringSection.findFirst({
    where: {
      courseOfferingId: offering.id,
      shiftId: dayShiftId,
      sectionCode: 'A',
    },
  });
  if (!section) {
    section = await prisma.offeringSection.create({
      data: {
        tenantId,
        courseOfferingId: offering.id,
        shiftId: dayShiftId,
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
