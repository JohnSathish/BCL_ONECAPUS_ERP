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

const POOL_DEFS = [
  {
    semesterNo: 1,
    categoryType: 'MDC' as const,
    prefix: 'MDC',
    from: 110,
    to: 119,
  },
  {
    semesterNo: 1,
    categoryType: 'AEC' as const,
    prefix: 'AEC',
    from: 120,
    to: 129,
  },
  {
    semesterNo: 1,
    categoryType: 'SEC' as const,
    prefix: 'SEC',
    from: 130,
    to: 139,
  },
  {
    semesterNo: 1,
    categoryType: 'VAC' as const,
    prefix: 'VAC',
    from: 140,
    to: 140,
  },
  {
    semesterNo: 3,
    categoryType: 'MDC' as const,
    prefix: 'MDC',
    from: 210,
    to: 219,
  },
  {
    semesterNo: 3,
    categoryType: 'AEC' as const,
    prefix: 'AEC',
    from: 220,
    to: 229,
  },
  {
    semesterNo: 3,
    categoryType: 'SEC' as const,
    prefix: 'SEC',
    from: 230,
    to: 239,
  },
  {
    semesterNo: 3,
    categoryType: 'VTC' as const,
    prefix: 'VTC',
    from: 240,
    to: 249,
  },
] as const;

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

  const ugVersions = await prisma.programVersion.findMany({
    where: { tenantId, deletedAt: null, program: { level: 'UG' } },
    select: { id: true },
  });

  for (const poolDef of POOL_DEFS) {
    const poolName = `Arts ${poolDef.categoryType} Semester ${poolDef.semesterNo} Pool`;
    const courseCodes: string[] = [];
    for (let num = poolDef.from; num <= poolDef.to; num += 1) {
      courseCodes.push(`${poolDef.prefix}-${num}`);
    }

    const pool = await prisma.categoryPool.upsert({
      where: {
        tenantId_institutionId_poolName: {
          tenantId,
          institutionId,
          poolName,
        },
      },
      create: {
        tenantId,
        institutionId,
        poolName,
        semesterNo: poolDef.semesterNo,
        categoryType: poolDef.categoryType,
        active: true,
        createdById,
      },
      update: {
        active: true,
        semesterNo: poolDef.semesterNo,
        categoryType: poolDef.categoryType,
      },
    });

    let order = 0;
    for (const code of courseCodes) {
      if (seedExclusions.excludedCourseCodes.has(code)) {
        console.log(`Arts seed skip (removed pool course): ${code}`);
        continue;
      }
      const courseId = courseByCode.get(code);
      if (!courseId) continue;

      await prisma.categoryPoolCourse.upsert({
        where: { poolId_courseId: { poolId: pool.id, courseId } },
        create: {
          poolId: pool.id,
          courseId,
          displayOrder: order++,
          active: true,
        },
        update: { active: true, displayOrder: order - 1 },
      });

      await prisma.courseOffering.upsert({
        where: {
          categoryPoolId_courseId: { categoryPoolId: pool.id, courseId },
        },
        create: {
          tenantId,
          categoryPoolId: pool.id,
          mappingSource: 'SHARED_POOL',
          courseId,
          semesterSequence: poolDef.semesterNo,
          category: poolDef.categoryType,
          displayOrder: order - 1,
          programVersionId: null,
        },
        update: {
          semesterSequence: poolDef.semesterNo,
          category: poolDef.categoryType,
        },
      });
    }

    for (const version of ugVersions) {
      await prisma.programmePoolAssignment.upsert({
        where: {
          programVersionId_semesterNo_poolId: {
            programVersionId: version.id,
            semesterNo: poolDef.semesterNo,
            poolId: pool.id,
          },
        },
        create: {
          tenantId,
          programVersionId: version.id,
          semesterNo: poolDef.semesterNo,
          poolId: pool.id,
          active: true,
        },
        update: { active: true },
      });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    PoolSectionProvisioningService,
  } = require('../src/modules/academic-engine/services/pool-section-provisioning.service');
  const poolProvisioner = new PoolSectionProvisioningService(prisma as never);
  await poolProvisioner.provisionPoolOfferings(tenantId, {
    semesterNo: 1,
    categories: ['MDC', 'AEC', 'SEC', 'VAC'],
    shiftCode: 'DAY',
  });
  await poolProvisioner.provisionPoolOfferings(tenantId, {
    semesterNo: 3,
    categories: ['MDC', 'AEC', 'SEC', 'VTC'],
    shiftCode: 'DAY',
  });

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
    const course = await prisma.course.update({
      where: { id: existing.id },
      data: { ...data, title },
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
