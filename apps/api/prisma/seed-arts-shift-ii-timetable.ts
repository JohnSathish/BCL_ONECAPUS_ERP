import type { PrismaClient } from '@prisma/client';
import { buildArtsOddTimetableSeedEntries } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';
import { parseTimeToDate } from '../src/common/utils/shift-scope.util';
import { syncSubjectGroupsForShift } from './seed-timetable-subject-groups';

const DAY_OF_WEEK: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const PLAN_NAME = 'DBC Arts Shift II · ODD · Jun–Jul 2026';
const SEED_MARKER = 'arts-shift-ii-v1';

export type SeedArtsShiftIiTimetableContext = {
  prisma: PrismaClient;
  tenantId: string;
  institutionId: string;
  campusId: string;
  academicYearId: string;
  createdById?: string;
};

/** Inline sync — see seed-timetable-subject-groups.ts */
async function syncSubjectGroupsForShiftLocal(
  prisma: PrismaClient,
  tenantId: string,
  shiftId: string,
  academicYearId: string,
  semesterNos: number[],
) {
  return syncSubjectGroupsForShift(
    prisma,
    tenantId,
    shiftId,
    academicYearId,
    semesterNos,
  );
}

export async function seedArtsShiftIiTimetable(
  ctx: SeedArtsShiftIiTimetableContext,
) {
  const {
    prisma,
    tenantId,
    institutionId,
    campusId,
    academicYearId,
    createdById,
  } = ctx;

  const artsStream = await prisma.academicStream.findFirst({
    where: { tenantId, code: 'ARTS', deletedAt: null, isActive: true },
  });
  if (!artsStream) {
    console.warn('Arts Shift II timetable seed skipped: ARTS stream not found');
    return null;
  }

  let shiftIi = await prisma.shift.findFirst({
    where: {
      tenantId,
      campusId,
      code: 'SHIFT_II',
      deletedAt: null,
      status: 'ACTIVE',
    },
  });
  if (!shiftIi) {
    shiftIi = await prisma.shift.create({
      data: {
        tenantId,
        institutionId,
        campusId,
        name: 'Arts Shift II',
        code: 'SHIFT_II',
        startTime: parseTimeToDate('09:45:00'),
        endTime: parseTimeToDate('15:30:00'),
        shiftType: 'REGULAR',
        status: 'ACTIVE',
        sortOrder: 2,
      },
    });
  }

  let plan = await prisma.timetablePlan.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      shiftId: shiftIi.id,
      name: PLAN_NAME,
    },
  });

  const planMetadata = {
    semesterMode: 'ODD',
    allowedSemesters: [3, 5],
    blockedSemesters: [1, 2, 4, 6],
    streamId: artsStream.id,
    streamCode: artsStream.code,
    streamName: artsStream.name,
    generationScope: 'MANUAL',
    temporaryRoutine: true,
    effectiveLabel: '12 Jun 2026 – 4 Jul 2026',
  };

  if (!plan) {
    plan = await prisma.timetablePlan.create({
      data: {
        tenantId,
        institutionId,
        campusId,
        academicYearId,
        shiftId: shiftIi.id,
        name: PLAN_NAME,
        scopeType: 'STREAM',
        status: 'DRAFT',
        approvalState: 'DRAFT',
        effectiveFrom: new Date('2026-06-12'),
        effectiveTo: new Date('2026-07-04'),
        metadata: planMetadata,
        createdById,
      },
    });
  } else {
    plan = await prisma.timetablePlan.update({
      where: { id: plan.id },
      data: {
        academicYearId,
        effectiveFrom: new Date('2026-06-12'),
        effectiveTo: new Date('2026-07-04'),
        metadata: { ...(plan.metadata as object), ...planMetadata },
      },
    });
  }

  const { groupByCourseId } = await syncSubjectGroupsForShiftLocal(
    prisma,
    tenantId,
    shiftIi.id,
    academicYearId,
    [3, 5],
  );

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    TimetableGeneratorService,
  } = require('../src/modules/timetable-engine/timetable-generator.service');
  const generator = new TimetableGeneratorService(prisma as never);
  const templates = await generator.ensureSlotTemplatesForPlan(
    tenantId,
    plan.id,
  );

  const templateByDayPeriod = new Map<
    string,
    { id: string; startTime: Date; endTime: Date }
  >();
  for (const template of templates) {
    if (template.isBreak || template.isLunch || !template.periodNo) continue;
    templateByDayPeriod.set(`${template.dayOfWeek}-${template.periodNo}`, {
      id: template.id,
      startTime: template.startTime,
      endTime: template.endTime,
    });
  }

  const courses = await prisma.course.findMany({
    where: { tenantId, deletedAt: null },
    select: { id: true, code: true },
  });
  const courseByCode = new Map(
    courses.map((course) => [course.code.toUpperCase(), course.id]),
  );

  const offerings = await prisma.courseOffering.findMany({
    where: { tenantId, deletedAt: null },
    include: {
      course: { select: { id: true, code: true } },
      sections: {
        where: {
          deletedAt: null,
          shiftId: shiftIi.id,
          status: { in: ['active', 'ACTIVE'] },
        },
      },
    },
  });

  const resolveOfferingLink = (
    subjectCode: string,
    category: string,
    semester: number,
    sectionCode: string,
  ) => {
    const normalizedCode = subjectCode.toUpperCase();
    const normalizedSection =
      sectionCode === 'Core' ? 'A' : sectionCode.toUpperCase();
    const categoryUpper = category.toUpperCase();

    const codeMatches = offerings.filter(
      (offering) => offering.course.code.toUpperCase() === normalizedCode,
    );
    if (!codeMatches.length)
      return { courseOfferingId: undefined, offeringSectionId: undefined };

    let candidates = codeMatches.filter(
      (offering) =>
        offering.semesterSequence == null ||
        offering.semesterSequence === semester,
    );
    candidates = candidates.filter(
      (offering) =>
        String(offering.category ?? '').toUpperCase() === categoryUpper,
    );
    if (!candidates.length) candidates = codeMatches;

    const offering = candidates[0];
    const section =
      offering.sections.find(
        (row) => row.sectionCode.toUpperCase() === normalizedSection,
      ) ?? offering.sections[0];

    return {
      courseOfferingId: offering.id,
      offeringSectionId: section?.id,
      sectionCode: section?.sectionCode ?? normalizedSection,
    };
  };

  const existingSeeded = await prisma.timetablePlanEntry.findMany({
    where: { tenantId, planId: plan.id, source: 'MANUAL', deletedAt: null },
    select: { id: true, metadata: true },
  });
  const seededIds = existingSeeded
    .filter(
      (entry) =>
        (entry.metadata as { seededBy?: string } | null)?.seededBy ===
        SEED_MARKER,
    )
    .map((entry) => entry.id);
  if (seededIds.length) {
    await prisma.timetablePlanEntry.deleteMany({
      where: { id: { in: seededIds } },
    });
  }

  const rows = buildArtsOddTimetableSeedEntries(
    'ARTS',
    shiftIi.name,
    'A',
  ).filter((row) => row.semester === 3 || row.semester === 5);

  let created = 0;
  let skipped = 0;
  let linked = 0;
  let grouped = 0;

  for (const row of rows) {
    const dayOfWeek = DAY_OF_WEEK[row.day];
    const periodNo = Number(String(row.period).replace(/^P/i, '')) || null;
    const courseId = courseByCode.get(row.subjectCode.toUpperCase());
    if (!dayOfWeek || !periodNo || !courseId) {
      skipped += 1;
      continue;
    }

    const template = templateByDayPeriod.get(`${dayOfWeek}-${periodNo}`);
    if (!template) {
      skipped += 1;
      continue;
    }

    const link = resolveOfferingLink(
      row.subjectCode,
      row.category,
      row.semester,
      row.section,
    );
    if (link.courseOfferingId) linked += 1;

    const teachingSubjectGroupId = groupByCourseId.get(courseId);
    if (teachingSubjectGroupId) grouped += 1;

    const group = teachingSubjectGroupId
      ? await (prisma as any).teachingSubjectGroup.findFirst({
          where: { id: teachingSubjectGroupId },
          select: { primaryStaffProfileId: true, offeringSectionId: true },
        })
      : null;

    await prisma.timetablePlanEntry.create({
      data: {
        tenantId,
        planId: plan.id,
        shiftId: shiftIi.id,
        slotTemplateId: template.id,
        dayOfWeek,
        periodNo,
        startTime: template.startTime,
        endTime: template.endTime,
        courseId,
        teachingSubjectGroupId,
        courseOfferingId: link.courseOfferingId,
        offeringSectionId: group?.offeringSectionId ?? link.offeringSectionId,
        staffProfileId: group?.primaryStaffProfileId ?? undefined,
        semesterSequence: row.semester,
        sectionCode: link.sectionCode ?? row.section,
        fyugpCategory: row.category,
        slotType: row.category === 'LAB' ? 'LAB' : 'THEORY',
        isLocked: true,
        source: 'MANUAL',
        metadata: {
          seededBy: SEED_MARKER,
          teachingSubjectGroupId,
        },
      },
    });
    created += 1;
  }

  console.log(
    `Arts Shift II timetable seeded: plan "${plan.name}" (${plan.id}), ${created} entries (${linked} offerings, ${grouped} subject groups), ${skipped} skipped`,
  );
  return { planId: plan.id, created, skipped, grouped };
}
