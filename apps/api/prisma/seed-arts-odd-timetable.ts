import type { PrismaClient } from '@prisma/client';
import { buildArtsOddTimetableSeedEntries } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';
import { parseTimeToDate } from '../src/common/utils/shift-scope.util';

const DAY_OF_WEEK: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const ARTS_ODD_PLAN_NAME = 'Arts · Day Shift · ODD · Weekly Routine';
const SEED_MARKER = 'arts-odd-demo-v2';

export type SeedArtsOddTimetableContext = {
  prisma: PrismaClient;
  tenantId: string;
  institutionId: string;
  campusId: string;
  academicYearId: string;
  createdById?: string;
};

export async function seedArtsOddTimetable(ctx: SeedArtsOddTimetableContext) {
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
    console.warn('Arts ODD timetable seed skipped: ARTS stream not found');
    return null;
  }

  const dayShift = await prisma.shift.findFirst({
    where: {
      tenantId,
      campusId,
      code: 'DAY',
      deletedAt: null,
      status: 'ACTIVE',
    },
  });
  if (!dayShift) {
    console.warn('Arts ODD timetable seed skipped: DAY shift not found');
    return null;
  }

  let plan = await prisma.timetablePlan.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      shiftId: dayShift.id,
      name: { startsWith: ARTS_ODD_PLAN_NAME },
    },
  });

  if (!plan) {
    plan = await prisma.timetablePlan.create({
      data: {
        tenantId,
        institutionId,
        campusId,
        academicYearId,
        shiftId: dayShift.id,
        name: ARTS_ODD_PLAN_NAME,
        scopeType: 'STREAM',
        status: 'DRAFT',
        approvalState: 'DRAFT',
        metadata: {
          semesterMode: 'ODD',
          allowedSemesters: [1, 3, 5],
          blockedSemesters: [2, 4, 6],
          streamId: artsStream.id,
          streamCode: artsStream.code,
          streamName: artsStream.name,
          generationScope: 'MANUAL',
        },
        createdById,
      },
    });
  } else {
    plan = await prisma.timetablePlan.update({
      where: { id: plan.id },
      data: {
        academicYearId,
        metadata: {
          ...(plan.metadata as object),
          semesterMode: 'ODD',
          allowedSemesters: [1, 3, 5],
          blockedSemesters: [2, 4, 6],
          streamId: artsStream.id,
          streamCode: artsStream.code,
          streamName: artsStream.name,
          generationScope: 'MANUAL',
        },
      },
    });
  }

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
          shiftId: dayShift.id,
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
    if (categoryUpper === 'MINOR' && semester === 1) {
      candidates = candidates.filter(
        (offering) => String(offering.category ?? '').toUpperCase() === 'MAJOR',
      );
    } else {
      candidates = candidates.filter(
        (offering) =>
          String(offering.category ?? '').toUpperCase() === categoryUpper,
      );
    }
    if (!candidates.length) {
      candidates = codeMatches;
    }

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
    .filter((entry) => {
      const seededBy = (entry.metadata as { seededBy?: string } | null)
        ?.seededBy;
      return seededBy === SEED_MARKER || seededBy === 'arts-odd-demo-v1';
    })
    .map((entry) => entry.id);
  if (seededIds.length) {
    await prisma.timetablePlanEntry.deleteMany({
      where: { id: { in: seededIds } },
    });
  }

  const rows = buildArtsOddTimetableSeedEntries('ARTS', dayShift.name, 'A');
  let created = 0;
  let skipped = 0;
  let linked = 0;

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

    await prisma.timetablePlanEntry.create({
      data: {
        tenantId,
        planId: plan.id,
        shiftId: dayShift.id,
        slotTemplateId: template.id,
        dayOfWeek,
        periodNo,
        startTime: template.startTime,
        endTime: template.endTime,
        courseId,
        courseOfferingId: link.courseOfferingId,
        offeringSectionId: link.offeringSectionId,
        semesterSequence: row.semester,
        sectionCode: link.sectionCode ?? row.section,
        fyugpCategory: row.category,
        slotType: row.category === 'LAB' ? 'LAB' : 'THEORY',
        isLocked: true,
        source: 'MANUAL',
        metadata: { seededBy: SEED_MARKER },
      },
    });
    created += 1;
  }

  console.log(
    `Arts ODD timetable seeded: plan "${plan.name}" (${plan.id}), ${created} entries (${linked} linked to offerings), ${skipped} skipped`,
  );
  return { planId: plan.id, created, skipped };
}
