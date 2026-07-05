import type { PrismaClient } from '@prisma/client';
import {
  readCatalogSeedExclusions,
  reinstateCatalogSeedCourseCodes,
} from '../src/common/services/catalog-seed-exclusions.util';
import { normalizeNehuCourseCode } from '../src/modules/academic-engine/domain/course-code.util';
import {
  buildArtsFyugpEvenCourses,
  buildArtsFyugpSem2MinorCourseDefs,
} from '../src/modules/academic-engine/domain/arts-fyugp-even-catalog';
import { buildDbcDaySem3VtcCourses } from '../src/modules/academic-engine/domain/dbc-day-sem3-electives-catalog';
import { buildDbcDaySem6VtcCourses } from '../src/modules/academic-engine/domain/dbc-day-sem6-vtc-electives-catalog';
import {
  ARTS_FYUGP_DEPARTMENTS,
  buildArtsFyugpOddCourses,
  buildArtsFyugpSem5MinorCourseDefs,
  type ArtsFyugpCourseDef,
} from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';
import { FYUGP_SEM2_PROGRAM_DEPARTMENTS } from '../src/modules/academic-engine/domain/fyugp-sem2-departments';
import { DEFAULT_FYUGP_SEMESTER_RULES } from '../src/modules/academic-engine/domain/fyugp-templates';
import { upsertSemesterStructureRules } from '../src/modules/academic-engine/services/structure-rules.helper';
import { syncProgramPromotionMappings } from '../src/modules/academic-lifecycle/utils/sync-promotion-mappings';

export type SeedArtsFyugpCatalogContext = {
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

const LEGACY_EDUCATION_COURSE_CODES: ReadonlyArray<readonly [string, string]> =
  [
    ['EDU-100', 'EDN-100'],
    ['EDU-150', 'EDN-150'],
    ['EDU-151', 'EDN-151'],
    ['EDU-200', 'EDN-200'],
    ['EDU-201', 'EDN-201'],
    ['EDU-250', 'EDN-250'],
    ['EDU-251', 'EDN-251'],
    ['EDU-252', 'EDN-252'],
    ['EDU-253', 'EDN-253'],
    ['EDU-300', 'EDN-300'],
    ['EDU-301', 'EDN-301'],
    ['EDU-302', 'EDN-302'],
    ['EDU-303', 'EDN-303'],
    ['EDU-304', 'EDN-303'],
  ];

async function migrateLegacyEducationCatalog(
  prisma: PrismaClient,
  tenantId: string,
) {
  const eduDept = await prisma.department.findFirst({
    where: { tenantId, code: 'EDU', deletedAt: null },
  });
  const ednDept = await prisma.department.findFirst({
    where: { tenantId, code: 'EDN', deletedAt: null },
  });
  if (eduDept && !ednDept) {
    await prisma.department.update({
      where: { id: eduDept.id },
      data: { code: 'EDN' },
    });
  }

  for (const [legacyCode, targetCode] of LEGACY_EDUCATION_COURSE_CODES) {
    const legacyCourse = await prisma.course.findFirst({
      where: { tenantId, code: legacyCode },
      orderBy: { createdAt: 'asc' },
    });
    const targetCourse = await prisma.course.findFirst({
      where: { tenantId, code: targetCode },
      orderBy: { deletedAt: 'asc' },
    });
    if (!legacyCourse) continue;
    if (!targetCourse || targetCourse.deletedAt) {
      if (targetCourse?.deletedAt && targetCourse.id !== legacyCourse.id) {
        await prisma.course.update({
          where: { id: targetCourse.id },
          data: {
            code: `${targetCode}__retired_${targetCourse.id.slice(0, 8)}`,
          },
        });
      }
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

async function retireLegacyEnglishInternship(
  prisma: PrismaClient,
  tenantId: string,
) {
  const internship = await prisma.course.findFirst({
    where: { tenantId, code: 'ENG-303', deletedAt: null },
    select: { id: true, deliveryType: true },
  });
  if (!internship || internship.deliveryType !== 'INTERNSHIP') return;

  const legacy = await prisma.course.findFirst({
    where: { tenantId, code: 'ENG-304', deletedAt: null },
    select: { id: true },
  });
  if (legacy) {
    await prisma.course.update({
      where: { id: legacy.id },
      data: { deletedAt: new Date() },
    });
  }
}

async function retireLegacyGaroInternship(
  prisma: PrismaClient,
  tenantId: string,
) {
  const internship = await prisma.course.findFirst({
    where: { tenantId, code: 'GAR-303', deletedAt: null },
    select: { id: true, deliveryType: true },
  });
  if (!internship || internship.deliveryType !== 'INTERNSHIP') return;

  const legacy = await prisma.course.findFirst({
    where: { tenantId, code: 'GAR-304', deletedAt: null },
    select: { id: true },
  });
  if (legacy) {
    await prisma.course.update({
      where: { id: legacy.id },
      data: { deletedAt: new Date() },
    });
  }
}

async function retireLegacyGeographyInternship(
  prisma: PrismaClient,
  tenantId: string,
) {
  const internship = await prisma.course.findFirst({
    where: { tenantId, code: 'GEO-303', deletedAt: null },
    select: { id: true, deliveryType: true },
  });
  if (!internship || internship.deliveryType !== 'INTERNSHIP') return;

  const legacy = await prisma.course.findFirst({
    where: { tenantId, code: 'GEO-304', deletedAt: null },
    select: { id: true },
  });
  if (legacy) {
    await prisma.course.update({
      where: { id: legacy.id },
      data: { deletedAt: new Date() },
    });
  }
}

async function retireLegacyHistoryInternship(
  prisma: PrismaClient,
  tenantId: string,
) {
  const internship = await prisma.course.findFirst({
    where: { tenantId, code: 'HIS-303', deletedAt: null },
    select: { id: true, deliveryType: true },
  });
  if (!internship || internship.deliveryType !== 'INTERNSHIP') return;

  const legacy = await prisma.course.findFirst({
    where: { tenantId, code: 'HIS-304', deletedAt: null },
    select: { id: true },
  });
  if (legacy) {
    await prisma.course.update({
      where: { id: legacy.id },
      data: { deletedAt: new Date() },
    });
  }
}

async function retireLegacyPhilosophyInternship(
  prisma: PrismaClient,
  tenantId: string,
) {
  const internship = await prisma.course.findFirst({
    where: { tenantId, code: 'PHI-303', deletedAt: null },
    select: { id: true, deliveryType: true },
  });
  if (!internship || internship.deliveryType !== 'INTERNSHIP') return;

  const legacy = await prisma.course.findFirst({
    where: { tenantId, code: 'PHI-304', deletedAt: null },
    select: { id: true },
  });
  if (legacy) {
    await prisma.course.update({
      where: { id: legacy.id },
      data: { deletedAt: new Date() },
    });
  }
}

async function retireLegacyPoliticalScienceInternship(
  prisma: PrismaClient,
  tenantId: string,
) {
  const internship = await prisma.course.findFirst({
    where: { tenantId, code: 'POL-303', deletedAt: null },
    select: { id: true, deliveryType: true },
  });
  if (!internship || internship.deliveryType !== 'INTERNSHIP') return;

  const legacy = await prisma.course.findFirst({
    where: { tenantId, code: 'POL-304', deletedAt: null },
    select: { id: true },
  });
  if (legacy) {
    await prisma.course.update({
      where: { id: legacy.id },
      data: { deletedAt: new Date() },
    });
  }
}

async function retireLegacySociologyInternship(
  prisma: PrismaClient,
  tenantId: string,
) {
  const internship = await prisma.course.findFirst({
    where: { tenantId, code: 'SOC-303', deletedAt: null },
    select: { id: true, deliveryType: true },
  });
  if (!internship || internship.deliveryType !== 'INTERNSHIP') return;

  const legacy = await prisma.course.findFirst({
    where: { tenantId, code: 'SOC-304', deletedAt: null },
    select: { id: true },
  });
  if (legacy) {
    await prisma.course.update({
      where: { id: legacy.id },
      data: { deletedAt: new Date() },
    });
  }
}

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
  const morningShiftId = shifts.MORNING?.id;
  if (!dayShiftId) {
    throw new Error('Day shift required for Arts FYUGP catalog seed');
  }

  await migrateLegacyEducationCatalog(prisma, tenantId);

  const academicSettings = await prisma.tenantAcademicSettings.findUnique({
    where: { tenantId },
  });

  const departments = await prisma.department.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true },
  });
  const departmentIdByCode = new Map(
    departments.map((row) => [row.code, row.id]),
  );

  const programVersions = new Map<string, { id: string; programId: string }>();

  for (const dept of FYUGP_SEM2_PROGRAM_DEPARTMENTS) {
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

  const courseByCode = new Map<string, string>();
  const oddCourses = buildArtsFyugpOddCourses();
  const evenCourses = buildArtsFyugpEvenCourses();
  const sem3VtcCourses = buildDbcDaySem3VtcCourses();
  const sem6VtcCourses = buildDbcDaySem6VtcCourses();
  const allCourses = [
    ...oddCourses,
    ...evenCourses,
    ...sem3VtcCourses,
    ...sem6VtcCourses,
  ];

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

  for (const courseDef of allCourses) {
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

  await retireLegacyEnglishInternship(prisma, tenantId);
  await retireLegacyGaroInternship(prisma, tenantId);
  await retireLegacyGeographyInternship(prisma, tenantId);
  await retireLegacyHistoryInternship(prisma, tenantId);
  await retireLegacyPhilosophyInternship(prisma, tenantId);
  await retireLegacyPoliticalScienceInternship(prisma, tenantId);
  await retireLegacySociologyInternship(prisma, tenantId);

  const shiftIdsForSections = [dayShiftId, morningShiftId].filter(
    Boolean,
  ) as string[];

  for (const courseDef of oddCourses) {
    if (courseDef.sharedPool) continue;
    const programCode = courseDef.programCode;
    if (!programCode?.startsWith('BA-')) continue;
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
    if (!programCode.startsWith('BA-')) continue;

    const sem2Major = evenCourses.find(
      (c) => c.programCode === programCode && c.category === 'MAJOR',
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
      (c) =>
        c.programCode === programCode &&
        c.category === 'MAJOR' &&
        (c.semesterSequence === 4 || c.semesterSequence === 6),
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

    for (const minorDef of buildArtsFyugpSem2MinorCourseDefs(programCode)) {
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

    for (const minorDef of buildArtsFyugpSem5MinorCourseDefs(programCode)) {
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
    `Arts FYUGP catalog seeded: ${oddCourses.length} ODD + ${evenCourses.length} EVEN courses, ${programVersions.size} FYUGP programmes (BA/B.Sc./B.Com.), ${promotionMappings} promotion mappings`,
  );

  return {
    programVersionIds: [...programVersions.values()].map((v) => v.id),
    programVersions,
  };
}

async function upsertArtsCourse(
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
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: { ...data, title, code },
    });
    return course.id;
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
