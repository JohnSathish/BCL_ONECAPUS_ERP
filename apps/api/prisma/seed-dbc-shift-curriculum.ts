import type { PrismaClient } from '@prisma/client';
import { buildArtsFyugpOddCourses } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';
import {
  DAY_SEM2_AEC_CODES,
  DAY_SEM2_MDC_CODES,
  DAY_SEM2_SEC_CODES,
  DAY_SEM2_VAC_CODES,
  MORNING_SEM2_AEC_CODES,
  MORNING_SEM2_MDC_CODES,
  MORNING_SEM2_SEC_CODES,
  MORNING_SEM2_VAC_CODES,
} from '../src/modules/academic-engine/domain/arts-fyugp-even-catalog';
import {
  DBC_SEM3_COURSE_TITLES,
  DBC_SEM3_MDC_ELIGIBILITY,
  MORNING_SEM3_AEC_CODES,
  MORNING_SEM3_MDC_CODES,
  MORNING_SEM3_SEC_CODES,
  MORNING_SEM3_VTC_CODES,
} from '../src/modules/academic-engine/domain/dbc-morning-sem3-catalog';

const MORNING_ARTS_DEPT_CODES = [
  'ECO',
  'EDU',
  'ENG',
  'GAR',
  'GEO',
  'HIS',
  'PHI',
  'POL',
  'SOC',
] as const;

const DAY_SEM1_MDC = [
  'MDC-110',
  'MDC-111',
  'MDC-112',
  'MDC-115',
  'MDC-116',
  'MDC-118',
  'MDC-119',
] as const;

const MORNING_SEM1_MDC = ['MDC-111', 'MDC-116', 'MDC-118', 'MDC-119'] as const;

const DAY_SEM1_AEC = [
  'AEC-120',
  'AEC-121',
  'AEC-122',
  'AEC-123',
  'AEC-124',
  'AEC-125',
  'AEC-126',
  'AEC-127',
  'AEC-128',
  'AEC-129',
] as const;

const MORNING_SEM1_AEC = ['AEC-121', 'AEC-122'] as const;

const DAY_SEM1_SEC = [
  'SEC-130',
  'SEC-131',
  'SEC-132',
  'SEC-133',
  'SEC-134',
  'SEC-135',
  'SEC-136',
  'SEC-137',
  'SEC-138',
  'SEC-139',
] as const;

const MORNING_SEM1_SEC = ['SEC-131', 'SEC-132', 'SEC-133'] as const;

const VAC_CODE = 'VAC-140';

type ShiftCurriculumSeedContext = {
  prisma: PrismaClient;
  tenantId: string;
  institutionId: string;
  shifts: Record<string, { id: string }>;
  createdById?: string;
};

async function upsertPoolAssignment(
  prisma: PrismaClient,
  data: {
    tenantId: string;
    programVersionId: string;
    semesterNo: number;
    poolId: string;
    shiftId?: string | null;
  },
) {
  const existing = await prisma.programmePoolAssignment.findFirst({
    where: {
      tenantId: data.tenantId,
      programVersionId: data.programVersionId,
      semesterNo: data.semesterNo,
      poolId: data.poolId,
      shiftId: data.shiftId ?? null,
    },
  });
  if (existing) {
    return prisma.programmePoolAssignment.update({
      where: { id: existing.id },
      data: { active: true },
    });
  }
  return prisma.programmePoolAssignment.create({
    data: { ...data, shiftId: data.shiftId ?? null, active: true },
  });
}

async function ensureCategoryPool(
  prisma: PrismaClient,
  ctx: ShiftCurriculumSeedContext,
  def: {
    poolName: string;
    semesterNo: number;
    categoryType: string;
    shiftId?: string;
    courseCodes: readonly string[];
  },
) {
  const existing = await prisma.categoryPool.findFirst({
    where: {
      tenantId: ctx.tenantId,
      institutionId: ctx.institutionId,
      poolName: def.poolName,
    },
  });

  const pool =
    existing ??
    (await prisma.categoryPool.create({
      data: {
        tenantId: ctx.tenantId,
        institutionId: ctx.institutionId,
        shiftId: def.shiftId ?? null,
        poolName: def.poolName,
        semesterNo: def.semesterNo,
        categoryType: def.categoryType,
        active: true,
        createdById: ctx.createdById,
      },
    }));

  if (existing) {
    await prisma.categoryPool.update({
      where: { id: pool.id },
      data: {
        shiftId: def.shiftId ?? null,
        semesterNo: def.semesterNo,
        categoryType: def.categoryType,
        active: true,
      },
    });
  }

  let order = 0;
  for (const code of def.courseCodes) {
    const course = await prisma.course.findFirst({
      where: { tenantId: ctx.tenantId, code, deletedAt: null },
    });
    if (!course) {
      console.warn(`Shift curriculum seed: course ${code} not found`);
      continue;
    }

    await prisma.categoryPoolCourse.upsert({
      where: { poolId_courseId: { poolId: pool.id, courseId: course.id } },
      create: {
        poolId: pool.id,
        courseId: course.id,
        displayOrder: order++,
        active: true,
      },
      update: { active: true, displayOrder: order - 1 },
    });

    const offering = await prisma.courseOffering.findFirst({
      where: {
        tenantId: ctx.tenantId,
        categoryPoolId: pool.id,
        courseId: course.id,
        deletedAt: null,
      },
    });
    if (!offering) {
      await prisma.courseOffering.create({
        data: {
          tenantId: ctx.tenantId,
          categoryPoolId: pool.id,
          mappingSource: 'SHARED_POOL',
          courseId: course.id,
          semesterSequence: def.semesterNo,
          category: def.categoryType,
          displayOrder: order - 1,
          programVersionId: null,
        },
      });
    }
  }

  const allowedCourseIds = new Set<string>();
  for (const code of def.courseCodes) {
    const course = await prisma.course.findFirst({
      where: { tenantId: ctx.tenantId, code, deletedAt: null },
      select: { id: true },
    });
    if (course) allowedCourseIds.add(course.id);
  }
  await prisma.categoryPoolCourse.updateMany({
    where: {
      poolId: pool.id,
      courseId: { notIn: [...allowedCourseIds] },
    },
    data: { active: false },
  });

  return pool;
}

export async function syncNehuCourseTitlesAndEligibility(
  prisma: PrismaClient,
  tenantId: string,
) {
  const catalog = buildArtsFyugpOddCourses();
  for (const def of catalog) {
    const existing = await prisma.course.findFirst({
      where: { tenantId, code: def.code, deletedAt: null },
    });
    if (!existing || existing.title === def.title) continue;

    const titleConflict = await prisma.course.findFirst({
      where: {
        tenantId,
        departmentId: existing.departmentId,
        title: def.title,
        deletedAt: null,
        id: { not: existing.id },
      },
      select: { code: true },
    });
    if (titleConflict) {
      console.warn(
        `Seed skip title sync (${def.code}): "${def.title}" already used by ${titleConflict.code}`,
      );
      continue;
    }

    await prisma.course.update({
      where: { id: existing.id },
      data: { title: def.title },
    });
  }

  const eligibilityByCode: Record<string, Record<string, unknown>> = {
    'MDC-111': {
      class12SubjectExclusions: [
        { subjectSlug: 'geography', label: 'Geography' },
        { subjectSlug: 'sociology', label: 'Sociology' },
      ],
    },
    'MDC-116': { triggersNccEnrollment: true },
    'MDC-119': {
      class12SubjectExclusions: [
        { subjectSlug: 'philosophy', label: 'Philosophy' },
      ],
      excludedMajorSubjectSlugs: ['philosophy'],
    },
  };

  for (const [code, rules] of Object.entries(eligibilityByCode)) {
    const course = await prisma.course.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
    if (!course) continue;
    await prisma.course.update({
      where: { id: course.id },
      data: { eligibilityRules: rules },
    });
  }

  for (const [code, title] of Object.entries(DBC_SEM3_COURSE_TITLES)) {
    const course = await prisma.course.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
    if (!course || course.title === title) continue;

    const titleConflict = await prisma.course.findFirst({
      where: {
        tenantId,
        departmentId: course.departmentId,
        title,
        deletedAt: null,
        id: { not: course.id },
      },
      select: { code: true },
    });
    if (titleConflict) {
      console.warn(
        `Seed skip Sem 3 title sync (${code}): "${title}" already used by ${titleConflict.code}`,
      );
      continue;
    }

    await prisma.course.update({
      where: { id: course.id },
      data: { title },
    });
  }

  for (const [code, rules] of Object.entries(DBC_SEM3_MDC_ELIGIBILITY)) {
    const course = await prisma.course.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
    if (!course) continue;
    await prisma.course.update({
      where: { id: course.id },
      data: { eligibilityRules: rules },
    });
  }
}

export async function seedDbcShiftCurriculum(ctx: ShiftCurriculumSeedContext) {
  const { prisma, tenantId, institutionId, shifts, createdById } = ctx;
  const morningShiftId = shifts.MORNING?.id;
  const dayShiftId = shifts.DAY?.id;
  if (!morningShiftId || !dayShiftId) {
    console.warn('Shift curriculum seed skipped: MORNING or DAY shift missing');
    return;
  }

  await syncNehuCourseTitlesAndEligibility(prisma, tenantId);

  const programs = await prisma.program.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      versions: {
        where: { deletedAt: null, version: 1 },
        take: 1,
      },
    },
  });

  const baPrograms = programs.filter((p) => p.code.startsWith('BA-'));
  const dayFyugpPrograms = programs.filter(
    (p) =>
      p.code.startsWith('BA-') ||
      p.code.startsWith('BSC-') ||
      p.code.startsWith('BCOM'),
  );
  const nonBaPrograms = programs.filter(
    (p) =>
      p.code.startsWith('BSC-') ||
      p.code.startsWith('B.Sc') ||
      p.code.startsWith('BCOM-') ||
      p.code.startsWith('B.Com') ||
      !p.code.startsWith('BA-'),
  );

  for (const program of programs) {
    const isBa = program.code.startsWith('BA-');
    await prisma.shiftProgrammeConfig.upsert({
      where: {
        tenantId_shiftId_programId: {
          tenantId,
          shiftId: dayShiftId,
          programId: program.id,
        },
      },
      create: {
        tenantId,
        shiftId: dayShiftId,
        programId: program.id,
        enabled: true,
      },
      update: { enabled: true },
    });

    await prisma.shiftProgrammeConfig.upsert({
      where: {
        tenantId_shiftId_programId: {
          tenantId,
          shiftId: morningShiftId,
          programId: program.id,
        },
      },
      create: {
        tenantId,
        shiftId: morningShiftId,
        programId: program.id,
        enabled: isBa,
      },
      update: { enabled: isBa },
    });
  }

  void nonBaPrograms;

  const departments = await prisma.department.findMany({
    where: {
      tenantId,
      institutionId,
      deletedAt: null,
      departmentType: 'ACADEMIC',
    },
    select: { id: true, code: true },
  });

  for (const dept of departments) {
    const morningEnabled = MORNING_ARTS_DEPT_CODES.includes(
      dept.code as (typeof MORNING_ARTS_DEPT_CODES)[number],
    );
    await prisma.shiftDepartmentConfig.upsert({
      where: {
        tenantId_shiftId_departmentId: {
          tenantId,
          shiftId: morningShiftId,
          departmentId: dept.id,
        },
      },
      create: {
        tenantId,
        shiftId: morningShiftId,
        departmentId: dept.id,
        enabled: morningEnabled,
      },
      update: { enabled: morningEnabled },
    });

    await prisma.shiftDepartmentConfig.upsert({
      where: {
        tenantId_shiftId_departmentId: {
          tenantId,
          shiftId: dayShiftId,
          departmentId: dept.id,
        },
      },
      create: {
        tenantId,
        shiftId: dayShiftId,
        departmentId: dept.id,
        enabled: true,
      },
      update: { enabled: true },
    });
  }

  const poolDefs = [
    {
      poolName: 'Day Shift Sem 1 MDC',
      semesterNo: 1,
      shiftId: dayShiftId,
      categoryType: 'MDC',
      courseCodes: DAY_SEM1_MDC,
    },
    {
      poolName: 'Morning Shift Sem 1 MDC',
      semesterNo: 1,
      shiftId: morningShiftId,
      categoryType: 'MDC',
      courseCodes: MORNING_SEM1_MDC,
    },
    {
      poolName: 'Day Shift Sem 1 AEC',
      semesterNo: 1,
      shiftId: dayShiftId,
      categoryType: 'AEC',
      courseCodes: DAY_SEM1_AEC,
    },
    {
      poolName: 'Morning Shift Sem 1 AEC',
      semesterNo: 1,
      shiftId: morningShiftId,
      categoryType: 'AEC',
      courseCodes: MORNING_SEM1_AEC,
    },
    {
      poolName: 'Day Shift Sem 1 SEC',
      semesterNo: 1,
      shiftId: dayShiftId,
      categoryType: 'SEC',
      courseCodes: DAY_SEM1_SEC,
    },
    {
      poolName: 'Morning Shift Sem 1 SEC',
      semesterNo: 1,
      shiftId: morningShiftId,
      categoryType: 'SEC',
      courseCodes: MORNING_SEM1_SEC,
    },
    {
      poolName: 'Day Shift Sem 1 VAC',
      semesterNo: 1,
      shiftId: dayShiftId,
      categoryType: 'VAC',
      courseCodes: [VAC_CODE],
    },
    {
      poolName: 'Morning Shift Sem 1 VAC',
      semesterNo: 1,
      shiftId: morningShiftId,
      categoryType: 'VAC',
      courseCodes: [VAC_CODE],
    },
    {
      poolName: 'Day Shift Sem 2 MDC',
      semesterNo: 2,
      shiftId: dayShiftId,
      categoryType: 'MDC',
      courseCodes: DAY_SEM2_MDC_CODES,
    },
    {
      poolName: 'Morning Shift Sem 2 MDC',
      semesterNo: 2,
      shiftId: morningShiftId,
      categoryType: 'MDC',
      courseCodes: MORNING_SEM2_MDC_CODES,
    },
    {
      poolName: 'Day Shift Sem 2 AEC',
      semesterNo: 2,
      shiftId: dayShiftId,
      categoryType: 'AEC',
      courseCodes: DAY_SEM2_AEC_CODES,
    },
    {
      poolName: 'Morning Shift Sem 2 AEC',
      semesterNo: 2,
      shiftId: morningShiftId,
      categoryType: 'AEC',
      courseCodes: MORNING_SEM2_AEC_CODES,
    },
    {
      poolName: 'Day Shift Sem 2 SEC',
      semesterNo: 2,
      shiftId: dayShiftId,
      categoryType: 'SEC',
      courseCodes: DAY_SEM2_SEC_CODES,
    },
    {
      poolName: 'Morning Shift Sem 2 SEC',
      semesterNo: 2,
      shiftId: morningShiftId,
      categoryType: 'SEC',
      courseCodes: MORNING_SEM2_SEC_CODES,
    },
    {
      poolName: 'Day Shift Sem 2 VAC',
      semesterNo: 2,
      shiftId: dayShiftId,
      categoryType: 'VAC',
      courseCodes: DAY_SEM2_VAC_CODES,
    },
    {
      poolName: 'Morning Shift Sem 2 VAC',
      semesterNo: 2,
      shiftId: morningShiftId,
      categoryType: 'VAC',
      courseCodes: MORNING_SEM2_VAC_CODES,
    },
    {
      poolName: 'Morning Shift Sem 3 MDC',
      semesterNo: 3,
      shiftId: morningShiftId,
      categoryType: 'MDC',
      courseCodes: MORNING_SEM3_MDC_CODES,
    },
    {
      poolName: 'Morning Shift Sem 3 AEC',
      semesterNo: 3,
      shiftId: morningShiftId,
      categoryType: 'AEC',
      courseCodes: MORNING_SEM3_AEC_CODES,
    },
    {
      poolName: 'Morning Shift Sem 3 SEC',
      semesterNo: 3,
      shiftId: morningShiftId,
      categoryType: 'SEC',
      courseCodes: MORNING_SEM3_SEC_CODES,
    },
    {
      poolName: 'Morning Shift Sem 3 VTC',
      semesterNo: 3,
      shiftId: morningShiftId,
      categoryType: 'VTC',
      courseCodes: MORNING_SEM3_VTC_CODES,
    },
  ] as const;

  const pools: Record<string, { id: string }> = {};
  for (const def of poolDefs) {
    const pool = await ensureCategoryPool(prisma, ctx, {
      poolName: def.poolName,
      semesterNo: def.semesterNo,
      shiftId: def.shiftId,
      categoryType: def.categoryType,
      courseCodes: def.courseCodes,
    });
    pools[def.poolName] = pool;
  }

  const baVersionIds = baPrograms
    .map((p) => p.versions[0]?.id)
    .filter(Boolean) as string[];

  const dayFyugpVersionIds = dayFyugpPrograms
    .map((p) => p.versions[0]?.id)
    .filter(Boolean) as string[];

  for (const versionId of dayFyugpVersionIds) {
    await prisma.programVersion.updateMany({
      where: { id: versionId, tenantId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
  }

  const assignSemesterPools = async (
    versionId: string,
    semesterNo: 1 | 2 | 3,
    shift: 'DAY' | 'MORNING',
  ) => {
    const shiftId = shift === 'DAY' ? dayShiftId : morningShiftId;
    const prefix = shift === 'DAY' ? 'Day' : 'Morning';
    const poolKeys =
      semesterNo === 3
        ? (['MDC', 'AEC', 'SEC', 'VTC'] as const)
        : (['MDC', 'AEC', 'SEC', 'VAC'] as const);
    for (const category of poolKeys) {
      const pool = pools[`${prefix} Shift Sem ${semesterNo} ${category}`];
      if (!pool) continue;
      await upsertPoolAssignment(prisma, {
        tenantId,
        programVersionId: versionId,
        semesterNo,
        poolId: pool.id,
        shiftId,
      });
    }
  };

  for (const versionId of dayFyugpVersionIds) {
    await assignSemesterPools(versionId, 1, 'DAY');
    await assignSemesterPools(versionId, 2, 'DAY');
  }

  for (const versionId of baVersionIds) {
    await assignSemesterPools(versionId, 1, 'MORNING');
    await assignSemesterPools(versionId, 2, 'MORNING');
    await assignSemesterPools(versionId, 3, 'MORNING');
  }

  for (const versionId of baVersionIds) {
    for (const shiftId of [morningShiftId]) {
      for (const semesterNo of [3] as const) {
        const existing = await prisma.shiftCurriculumPolicy.findFirst({
          where: {
            tenantId,
            shiftId,
            programVersionId: versionId,
            semesterNo,
            categoryType: 'AEC',
          },
        });
        if (existing) {
          await prisma.shiftCurriculumPolicy.update({
            where: { id: existing.id },
            data: { autoAssign: true },
          });
        } else {
          await prisma.shiftCurriculumPolicy.create({
            data: {
              tenantId,
              shiftId,
              programVersionId: versionId,
              semesterNo,
              categoryType: 'AEC',
              autoAssign: true,
            },
          });
        }
      }
    }
  }

  for (const versionId of dayFyugpVersionIds) {
    for (const shiftId of [dayShiftId]) {
      const existing = await prisma.shiftCurriculumPolicy.findFirst({
        where: {
          tenantId,
          shiftId,
          programVersionId: versionId,
          semesterNo: 1,
          categoryType: 'VAC',
        },
      });
      if (existing) {
        await prisma.shiftCurriculumPolicy.update({
          where: { id: existing.id },
          data: { autoAssign: true },
        });
      } else {
        await prisma.shiftCurriculumPolicy.create({
          data: {
            tenantId,
            shiftId,
            programVersionId: versionId,
            semesterNo: 1,
            categoryType: 'VAC',
            autoAssign: true,
          },
        });
      }
    }
  }

  for (const versionId of baVersionIds) {
    for (const shiftId of [morningShiftId, dayShiftId]) {
      const existing = await prisma.shiftCurriculumPolicy.findFirst({
        where: {
          tenantId,
          shiftId,
          programVersionId: versionId,
          semesterNo: 1,
          categoryType: 'VAC',
        },
      });
      if (existing) {
        await prisma.shiftCurriculumPolicy.update({
          where: { id: existing.id },
          data: { autoAssign: true },
        });
      } else {
        await prisma.shiftCurriculumPolicy.create({
          data: {
            tenantId,
            shiftId,
            programVersionId: versionId,
            semesterNo: 1,
            categoryType: 'VAC',
            autoAssign: true,
          },
        });
      }
    }
  }

  const {
    PoolSectionProvisioningService,
  } = require('../src/modules/academic-engine/services/pool-section-provisioning.service');
  const poolProvisioner = new PoolSectionProvisioningService(prisma as never);

  for (const [shiftCode, shiftId] of [
    ['DAY', dayShiftId],
    ['MORNING', morningShiftId],
  ] as const) {
    for (const semesterNo of [1, 2] as const) {
      await poolProvisioner.provisionPoolOfferings(tenantId, {
        semesterNo,
        categories: ['MDC', 'AEC', 'SEC', 'VAC'],
        shiftCode,
        shiftId,
      });
    }
  }

  await poolProvisioner.provisionPoolOfferings(tenantId, {
    semesterNo: 3,
    categories: ['MDC', 'AEC', 'SEC', 'VTC'],
    shiftCode: 'MORNING',
    shiftId: morningShiftId,
  });

  console.log(
    `DBC shift curriculum seeded: ${dayFyugpVersionIds.length} Day FYUGP programmes (Sem 1+2), ${baVersionIds.length} Morning BA programmes (Sem 1–3), Morning=${morningShiftId}, Day=${dayShiftId}`,
  );
}
