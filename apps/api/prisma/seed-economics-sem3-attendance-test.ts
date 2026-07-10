/**
 * Sample FYUP Economics Sem III Section A timetable for attendance workflow testing.
 * Uses real timetable + registration tables (not hardcoded UI).
 */
import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { syncSubjectGroupsForShift } from './seed-timetable-subject-groups';

export const ECON_SEM3_ATTENDANCE_PLAN_NAME =
  'FYUP Economics · Sem III · Section A · Attendance Test';

const SEED_MARKER = 'economics-sem3-attendance-test-v1';
const STUDENT_COUNT = 58;
const STUDENT_PREFIX = 'ECO-S3-A';

const DAY_OF_WEEK: Record<string, number> = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

const COLLEGE_SLOT_POLICY = {
  workingDays: [1, 2, 3, 4, 5, 6],
  saturdayHalfDay: true,
  saturdayPeriods: 3,
  periods: [
    { periodNo: 1, label: 'Period 1', startTime: '09:45', endTime: '10:40' },
    { periodNo: 2, label: 'Period 2', startTime: '10:40', endTime: '11:25' },
    { periodNo: 3, label: 'Period 3', startTime: '11:25', endTime: '12:10' },
    {
      periodNo: 0,
      label: 'Break',
      startTime: '12:10',
      endTime: '12:40',
      isBreak: true,
      isLunch: true,
    },
    { periodNo: 4, label: 'Period 4', startTime: '12:40', endTime: '13:25' },
    { periodNo: 5, label: 'Period 5', startTime: '13:25', endTime: '14:10' },
    { periodNo: 6, label: 'Period 6', startTime: '14:10', endTime: '15:00' },
  ],
};

const ECONOMICS_FACULTY_ROSTER: Array<{ key: string; email: string }> = [
  { key: 'mridul', email: 'mridul.chanda77@gmail.com' },
  { key: 'kasinchi', email: 'kasinchi98@gmail.com' },
  { key: 'tamara', email: 'tamaramarak@gmail.com' },
  { key: 'tengsuang', email: 'tengsuangkoksi@gmail.com' },
  { key: 'meuller', email: 'meullerbeul@gmail.com' },
  { key: 'brithuel', email: 'brithuelgsangma3293@gmail.com' },
  { key: 'nokme', email: 'nokmemrong995@gmail.com' },
  { key: 'renchi', email: 'sangmarenchich@gmail.com' },
];

const TEST_FACULTY_EMAILS_TO_CLEAN = [
  'john.marak@demo.edu',
  'francis.nongrum@demo.edu',
  'anita.sangma@demo.edu',
  'peter.dkhar@demo.edu',
  'mary.lyngdoh@demo.edu',
];

const TEST_ROOMS = [
  { code: 'R-201', name: 'Room R-201', isLab: false },
  { code: 'R-203', name: 'Room R-203', isLab: false },
  { code: 'COMP-LAB', name: 'Computer Lab', isLab: true },
  { code: 'SEM-HALL', name: 'Seminar Hall', isLab: false },
];

type TimetableSlot = {
  day: keyof typeof DAY_OF_WEEK;
  period: number;
  subjectCode: string;
  category: string;
  facultyKey: string;
  roomCode: string;
  label?: string;
};

/** Weekly routine aligned to the college printout (mapped to catalog course codes). */
const WEEKLY_SLOTS: TimetableSlot[] = [
  // Monday
  {
    day: 'Monday',
    period: 1,
    subjectCode: 'ECO-200',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
    label: 'Major Paper I (ECO-301)',
  },
  {
    day: 'Monday',
    period: 2,
    subjectCode: 'ECO-201',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
    label: 'Major Paper II (ECO-302)',
  },
  {
    day: 'Monday',
    period: 3,
    subjectCode: 'AEC-220',
    category: 'AEC',
    facultyKey: 'meuller',
    roomCode: 'R-201',
    label: 'AEC',
  },
  {
    day: 'Monday',
    period: 4,
    subjectCode: 'VTC-240',
    category: 'VTC',
    facultyKey: 'brithuel',
    roomCode: 'COMP-LAB',
    label: 'VTC',
  },
  {
    day: 'Monday',
    period: 5,
    subjectCode: 'MDC-210',
    category: 'MDC',
    facultyKey: 'nokme',
    roomCode: 'R-201',
    label: 'MDC',
  },
  {
    day: 'Monday',
    period: 6,
    subjectCode: 'ECO-200',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
    label: 'Major Tutorial',
  },
  // Tuesday
  {
    day: 'Tuesday',
    period: 1,
    subjectCode: 'ECO-200',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
  },
  {
    day: 'Tuesday',
    period: 2,
    subjectCode: 'ECO-201',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
  },
  {
    day: 'Tuesday',
    period: 3,
    subjectCode: 'AEC-220',
    category: 'AEC',
    facultyKey: 'meuller',
    roomCode: 'R-201',
  },
  {
    day: 'Tuesday',
    period: 4,
    subjectCode: 'POL-200',
    category: 'MINOR',
    facultyKey: 'tengsuang',
    roomCode: 'R-203',
    label: 'Minor I',
  },
  {
    day: 'Tuesday',
    period: 5,
    subjectCode: 'ECO-200',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
    label: 'Major Tutorial',
  },
  {
    day: 'Tuesday',
    period: 6,
    subjectCode: 'ECO-303',
    category: 'INTERNSHIP',
    facultyKey: 'renchi',
    roomCode: 'SEM-HALL',
    label: 'Internship',
  },
  // Wednesday
  {
    day: 'Wednesday',
    period: 1,
    subjectCode: 'ECO-200',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
  },
  {
    day: 'Wednesday',
    period: 2,
    subjectCode: 'ECO-201',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
  },
  {
    day: 'Wednesday',
    period: 3,
    subjectCode: 'AEC-220',
    category: 'AEC',
    facultyKey: 'meuller',
    roomCode: 'R-201',
  },
  {
    day: 'Wednesday',
    period: 4,
    subjectCode: 'POL-200',
    category: 'MINOR',
    facultyKey: 'tengsuang',
    roomCode: 'R-203',
    label: 'Minor I',
  },
  {
    day: 'Wednesday',
    period: 5,
    subjectCode: 'ECO-200',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
    label: 'Major Tutorial',
  },
  {
    day: 'Wednesday',
    period: 6,
    subjectCode: 'ECO-303',
    category: 'INTERNSHIP',
    facultyKey: 'renchi',
    roomCode: 'SEM-HALL',
    label: 'Internship',
  },
  // Thursday
  {
    day: 'Thursday',
    period: 1,
    subjectCode: 'ECO-200',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
  },
  {
    day: 'Thursday',
    period: 2,
    subjectCode: 'ECO-201',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
  },
  {
    day: 'Thursday',
    period: 3,
    subjectCode: 'ECO-201',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
    label: 'Major Paper III',
  },
  {
    day: 'Thursday',
    period: 4,
    subjectCode: 'POL-200',
    category: 'MINOR',
    facultyKey: 'tengsuang',
    roomCode: 'R-203',
    label: 'Minor I',
  },
  {
    day: 'Thursday',
    period: 5,
    subjectCode: 'ECO-200',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
    label: 'Major Tutorial',
  },
  {
    day: 'Thursday',
    period: 6,
    subjectCode: 'ECO-303',
    category: 'INTERNSHIP',
    facultyKey: 'renchi',
    roomCode: 'SEM-HALL',
    label: 'Internship',
  },
  // Friday
  {
    day: 'Friday',
    period: 1,
    subjectCode: 'ECO-200',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
  },
  {
    day: 'Friday',
    period: 2,
    subjectCode: 'ECO-201',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
  },
  {
    day: 'Friday',
    period: 3,
    subjectCode: 'ECO-201',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
    label: 'Major Paper III',
  },
  {
    day: 'Friday',
    period: 4,
    subjectCode: 'POL-200',
    category: 'MINOR',
    facultyKey: 'tengsuang',
    roomCode: 'R-203',
    label: 'Minor I',
  },
  {
    day: 'Friday',
    period: 5,
    subjectCode: 'ECO-200',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
    label: 'Major Tutorial',
  },
  {
    day: 'Friday',
    period: 6,
    subjectCode: 'ECO-303',
    category: 'INTERNSHIP',
    facultyKey: 'renchi',
    roomCode: 'SEM-HALL',
    label: 'Internship',
  },
  // Saturday
  {
    day: 'Saturday',
    period: 1,
    subjectCode: 'ECO-200',
    category: 'MAJOR',
    facultyKey: 'mridul',
    roomCode: 'R-201',
  },
  {
    day: 'Saturday',
    period: 2,
    subjectCode: 'VTC-240',
    category: 'VTC',
    facultyKey: 'brithuel',
    roomCode: 'COMP-LAB',
    label: 'VTC',
  },
  {
    day: 'Saturday',
    period: 3,
    subjectCode: 'SEC-230',
    category: 'SEC',
    facultyKey: 'meuller',
    roomCode: 'R-201',
    label: 'SEC',
  },
];

const REGISTRATION_COURSE_CODES = [
  'ECO-200',
  'ECO-201',
  'AEC-220',
  'MDC-210',
  'VTC-240',
  'SEC-230',
  'POL-200',
  'ECO-303',
];

export type SeedEconomicsSem3AttendanceContext = {
  prisma: PrismaClient;
  tenantId: string;
  institutionId: string;
  campusId: string;
  academicYearId: string;
  createdById?: string;
  dayShiftId: string;
  semester3Id: string;
};

export type SeedEconomicsSem3AttendanceResult = {
  planId: string;
  entriesCreated: number;
  studentsRegistered: number;
  registrationLines: number;
  faculty: Array<{ name: string; email: string; password: string }>;
  rooms: string[];
};

export async function seedEconomicsSem3AttendanceTest(
  ctx: SeedEconomicsSem3AttendanceContext,
): Promise<SeedEconomicsSem3AttendanceResult> {
  await cleanupDuplicateTestFaculty(ctx);
  const { facultyByKey, facultyLogins } = await resolveEconomicsFaculty(ctx);
  const roomByCode = await seedTestRooms(ctx);
  const { groupByCourseId } = await syncSubjectGroupsForShift(
    ctx.prisma,
    ctx.tenantId,
    ctx.dayShiftId,
    ctx.academicYearId,
    [3],
  );
  await assignFacultyToEconomicsGroups(ctx, facultyByKey, groupByCourseId);
  const plan = await ensureAttendanceTestPlan(ctx);
  const templates = await ensureSlotTemplates(ctx, plan.id);
  const entriesCreated = await seedTimetableEntries(
    ctx,
    plan.id,
    templates,
    facultyByKey,
    roomByCode,
    groupByCourseId,
  );
  await seedTeachingAssignments(ctx, facultyByKey, plan.id);
  await seedStaffSubjectAssignments(ctx, plan.id);
  const { studentsRegistered, registrationLines } =
    await seedEconomicsStudentsAndRegistrations(ctx);
  await publishPlan(ctx, plan.id);
  await mirrorPublishedEntries(ctx, plan.id);

  const faculty = facultyLogins;

  return {
    planId: plan.id,
    entriesCreated,
    studentsRegistered,
    registrationLines,
    faculty,
    rooms: TEST_ROOMS.map((room) => room.code),
  };
}

async function cleanupDuplicateTestFaculty(
  ctx: SeedEconomicsSem3AttendanceContext,
) {
  const { prisma, tenantId } = ctx;
  for (const email of TEST_FACULTY_EMAILS_TO_CLEAN) {
    const staff = await prisma.staffProfile.findFirst({
      where: { tenantId, email, deletedAt: null },
      select: { id: true, employeeCode: true, portalUserId: true },
    });
    if (!staff?.employeeCode?.startsWith('DBC-T-TEST-')) continue;

    await prisma.staffProfile.update({
      where: { id: staff.id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
    if (staff.portalUserId) {
      await prisma.user.update({
        where: { id: staff.portalUserId },
        data: { isActive: false, deletedAt: new Date() },
      });
    }
  }
}

async function resolveEconomicsFaculty(
  ctx: SeedEconomicsSem3AttendanceContext,
) {
  const { prisma, tenantId } = ctx;
  const facultyByKey = new Map<string, string>();
  const facultyLogins: Array<{
    name: string;
    email: string;
    password: string;
  }> = [];

  const economicsDept = await prisma.department.findFirst({
    where: { tenantId, code: 'ECONOMICS', deletedAt: null },
    select: { id: true },
  });

  for (const row of ECONOMICS_FACULTY_ROSTER) {
    const staff = await prisma.staffProfile.findFirst({
      where: {
        tenantId,
        email: row.email,
        deletedAt: null,
        portalUserId: { not: null },
        ...(economicsDept ? { departmentId: economicsDept.id } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        portalUserId: true,
      },
    });
    if (!staff) {
      console.warn(
        `Economics faculty skipped (missing portal login): ${row.email}`,
      );
      continue;
    }
    facultyByKey.set(row.key, staff.id);
    facultyLogins.push({
      name: staff.fullName,
      email: staff.email ?? row.email,
      password: '(use existing college password)',
    });
  }

  if (!facultyByKey.has('mridul')) {
    throw new Error(
      'Mridul Chanda (mridul.chanda77@gmail.com) must exist in Economics with an active portal login',
    );
  }

  console.log(
    `Economics attendance test faculty: ${facultyByKey.size} existing staff linked`,
  );
  return { facultyByKey, facultyLogins };
}

async function seedTestRooms(ctx: SeedEconomicsSem3AttendanceContext) {
  const { prisma, tenantId, campusId } = ctx;
  const roomByCode = new Map<string, string>();

  let theoryType = await prisma.roomType.findFirst({
    where: { tenantId, code: 'THEORY' },
  });
  if (!theoryType) {
    theoryType = await prisma.roomType.create({
      data: {
        tenantId,
        code: 'THEORY',
        name: 'Theory Classroom',
        status: 'ACTIVE',
      },
    });
  }
  let labType = await prisma.roomType.findFirst({
    where: { tenantId, code: 'LAB' },
  });
  if (!labType) {
    labType = await prisma.roomType.create({
      data: { tenantId, code: 'LAB', name: 'Laboratory', status: 'ACTIVE' },
    });
  }

  for (const room of TEST_ROOMS) {
    const row = await prisma.classroom.upsert({
      where: { tenantId_code: { tenantId, code: room.code } },
      create: {
        tenantId,
        campusId,
        code: room.code,
        name: room.name,
        capacity: room.isLab ? 40 : 60,
        roomTypeId: room.isLab ? labType.id : theoryType.id,
        isPracticalLab: room.isLab,
        status: 'ACTIVE',
        availableForTimetable: true,
      },
      update: {
        name: room.name,
        campusId,
        status: 'ACTIVE',
        availableForTimetable: true,
      },
    });
    roomByCode.set(room.code, row.id);
  }

  return roomByCode;
}

async function assignFacultyToEconomicsGroups(
  ctx: SeedEconomicsSem3AttendanceContext,
  facultyByKey: Map<string, string>,
  groupByCourseId: Map<string, string>,
) {
  const courseCodes = [
    ...new Set(WEEKLY_SLOTS.map((slot) => slot.subjectCode)),
  ];
  const courses = await ctx.prisma.course.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      code: { in: courseCodes },
    },
    select: { id: true, code: true },
  });

  const facultyByCourse: Record<string, string> = {
    'ECO-200': facultyByKey.get('mridul')!,
    'ECO-201': facultyByKey.get('mridul')!,
    'ECO-303': facultyByKey.get('renchi')!,
    'AEC-220': facultyByKey.get('meuller')!,
    'SEC-230': facultyByKey.get('meuller')!,
    'VTC-240': facultyByKey.get('brithuel')!,
    'MDC-210': facultyByKey.get('nokme')!,
    'POL-200': facultyByKey.get('tengsuang')!,
  };

  for (const course of courses) {
    const groupId = groupByCourseId.get(course.id);
    const staffId = facultyByCourse[course.code.toUpperCase()];
    if (!groupId || !staffId) continue;
    await (ctx.prisma as any).teachingSubjectGroup.update({
      where: { id: groupId },
      data: { primaryStaffProfileId: staffId },
    });
  }
}

async function ensureAttendanceTestPlan(
  ctx: SeedEconomicsSem3AttendanceContext,
) {
  const economicsDept = await ctx.prisma.department.findFirst({
    where: { tenantId: ctx.tenantId, code: 'ECONOMICS', deletedAt: null },
  });
  const programVersion = await ctx.prisma.programVersion.findFirst({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      program: { code: 'BA-ECO', deletedAt: null },
    },
    orderBy: { createdAt: 'asc' },
  });

  let plan = await ctx.prisma.timetablePlan.findFirst({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      name: ECON_SEM3_ATTENDANCE_PLAN_NAME,
    },
  });

  const metadata = {
    semesterMode: 'ODD',
    allowedSemesters: [3],
    blockedSemesters: [1, 2, 4, 5, 6],
    departmentCode: 'ECONOMICS',
    programCode: 'BA-ECO',
    sectionCode: 'A',
    generationScope: 'MANUAL',
    slotPolicy: COLLEGE_SLOT_POLICY,
    purpose: 'ATTENDANCE_TEST',
  };

  if (!plan) {
    plan = await ctx.prisma.timetablePlan.create({
      data: {
        tenantId: ctx.tenantId,
        institutionId: ctx.institutionId,
        campusId: ctx.campusId,
        academicYearId: ctx.academicYearId,
        shiftId: ctx.dayShiftId,
        departmentId: economicsDept?.id,
        programVersionId: programVersion?.id,
        name: ECON_SEM3_ATTENDANCE_PLAN_NAME,
        scopeType: 'PROGRAM',
        status: 'DRAFT',
        approvalState: 'DRAFT',
        metadata,
        createdById: ctx.createdById,
      },
    });
  } else {
    plan = await ctx.prisma.timetablePlan.update({
      where: { id: plan.id },
      data: {
        academicYearId: ctx.academicYearId,
        shiftId: ctx.dayShiftId,
        departmentId: economicsDept?.id,
        programVersionId: programVersion?.id,
        metadata: {
          ...(plan.metadata as object),
          ...metadata,
        },
      },
    });
  }

  return plan;
}

async function ensureSlotTemplates(
  ctx: SeedEconomicsSem3AttendanceContext,
  planId: string,
) {
  await ctx.prisma.timetableSlotTemplate.deleteMany({
    where: { tenantId: ctx.tenantId, planId },
  });

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    TimetableGeneratorService,
  } = require('../src/modules/timetable-engine/timetable-generator.service');
  const generator = new TimetableGeneratorService(ctx.prisma as never);
  return generator.ensureSlotTemplatesForPlan(ctx.tenantId, planId);
}

async function seedTimetableEntries(
  ctx: SeedEconomicsSem3AttendanceContext,
  planId: string,
  templates: Array<{
    id: string;
    dayOfWeek: number;
    periodNo: number | null;
    startTime: Date;
    endTime: Date;
    isBreak?: boolean;
    isLunch?: boolean;
  }>,
  facultyByKey: Map<string, string>,
  roomByCode: Map<string, string>,
  groupByCourseId: Map<string, string>,
) {
  const templateByKey = new Map(
    templates
      .filter((row) => !row.isBreak && !row.isLunch && row.periodNo)
      .map((row) => [`${row.dayOfWeek}-${row.periodNo}`, row]),
  );

  const courses = await ctx.prisma.course.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, code: true },
  });
  const courseByCode = new Map(
    courses.map((course) => [course.code.toUpperCase(), course.id]),
  );

  const offerings = await ctx.prisma.courseOffering.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    include: {
      course: { select: { id: true, code: true } },
      sections: {
        where: {
          deletedAt: null,
          shiftId: ctx.dayShiftId,
          sectionCode: 'A',
          status: { in: ['active', 'ACTIVE'] },
        },
      },
    },
  });

  const resolveOfferingLink = (subjectCode: string, category: string) => {
    const normalizedCode = subjectCode.toUpperCase();
    const categoryUpper = category.toUpperCase();
    const codeMatches = offerings.filter(
      (offering) => offering.course.code.toUpperCase() === normalizedCode,
    );
    if (!codeMatches.length) {
      return {
        courseOfferingId: undefined as string | undefined,
        offeringSectionId: undefined as string | undefined,
      };
    }

    let candidates = codeMatches.filter(
      (offering) =>
        offering.semesterSequence == null || offering.semesterSequence === 3,
    );
    if (categoryUpper === 'INTERNSHIP') {
      candidates = codeMatches.filter(
        (offering) => offering.semesterSequence === 5,
      );
      if (!candidates.length) candidates = codeMatches;
    } else {
      candidates = candidates.filter(
        (offering) =>
          String(offering.category ?? '').toUpperCase() === categoryUpper ||
          (categoryUpper === 'MAJOR' &&
            String(offering.category ?? '').toUpperCase() === 'CORE'),
      );
      if (!candidates.length) candidates = codeMatches;
    }

    const offering = candidates[0];
    const section = offering.sections[0];
    return {
      courseOfferingId: offering?.id,
      offeringSectionId: section?.id,
    };
  };

  const existing = await ctx.prisma.timetablePlanEntry.findMany({
    where: {
      tenantId: ctx.tenantId,
      planId,
      source: 'MANUAL',
      deletedAt: null,
    },
    select: { id: true, metadata: true },
  });
  const staleIds = existing
    .filter(
      (entry) =>
        (entry.metadata as { seededBy?: string } | null)?.seededBy ===
        SEED_MARKER,
    )
    .map((entry) => entry.id);
  if (staleIds.length) {
    await ctx.prisma.timetablePlanEntry.deleteMany({
      where: { id: { in: staleIds } },
    });
  }

  let created = 0;
  for (const slot of WEEKLY_SLOTS) {
    const dayOfWeek = DAY_OF_WEEK[slot.day];
    const template = templateByKey.get(`${dayOfWeek}-${slot.period}`);
    const courseId = courseByCode.get(slot.subjectCode.toUpperCase());
    const staffProfileId = facultyByKey.get(slot.facultyKey);
    const classroomId = roomByCode.get(slot.roomCode);
    if (
      !dayOfWeek ||
      !template ||
      !courseId ||
      !staffProfileId ||
      !classroomId
    ) {
      continue;
    }

    const link = resolveOfferingLink(slot.subjectCode, slot.category);
    const teachingSubjectGroupId = groupByCourseId.get(courseId);

    await ctx.prisma.timetablePlanEntry.create({
      data: {
        tenantId: ctx.tenantId,
        planId,
        shiftId: ctx.dayShiftId,
        slotTemplateId: template.id,
        dayOfWeek,
        periodNo: slot.period,
        startTime: template.startTime,
        endTime: template.endTime,
        courseId,
        teachingSubjectGroupId,
        courseOfferingId: link.courseOfferingId,
        offeringSectionId: link.offeringSectionId,
        staffProfileId,
        classroomId,
        semesterSequence: 3,
        sectionCode: 'A',
        fyugpCategory: slot.category,
        slotType: slot.category === 'VTC' ? 'LAB' : 'THEORY',
        isLocked: true,
        source: 'MANUAL',
        metadata: {
          seededBy: SEED_MARKER,
          roomStatus: 'FINAL',
          preferredRoom: slot.roomCode,
          displayLabel: slot.label ?? slot.subjectCode,
          teachingSubjectGroupId,
          programme: 'FYUP in Economics',
          section: 'A',
        },
      },
    });
    created += 1;
  }

  console.log(
    `Economics Sem III attendance test timetable: ${created} entries on plan ${planId}`,
  );
  return created;
}

async function seedStaffSubjectAssignments(
  ctx: SeedEconomicsSem3AttendanceContext,
  planId: string,
) {
  const entries = await ctx.prisma.timetablePlanEntry.findMany({
    where: {
      tenantId: ctx.tenantId,
      planId,
      deletedAt: null,
      staffProfileId: { not: null },
      offeringSectionId: { not: null },
    },
    select: {
      staffProfileId: true,
      courseId: true,
      offeringSectionId: true,
      semesterSequence: true,
      shiftId: true,
    },
  });

  const seen = new Set<string>();
  let created = 0;
  for (const entry of entries) {
    if (!entry.staffProfileId || !entry.courseId || !entry.offeringSectionId) {
      continue;
    }
    const key = `${entry.staffProfileId}:${entry.offeringSectionId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const section = await ctx.prisma.offeringSection.findFirst({
      where: { id: entry.offeringSectionId, deletedAt: null },
      include: { courseOffering: true },
    });
    if (!section?.courseOffering) continue;

    await ctx.prisma.staffSubjectAssignment.upsert({
      where: {
        staffProfileId_offeringSectionId: {
          staffProfileId: entry.staffProfileId,
          offeringSectionId: entry.offeringSectionId,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        staffProfileId: entry.staffProfileId,
        programVersionId: section.courseOffering.programVersionId,
        semesterNo:
          entry.semesterSequence ??
          section.courseOffering.semesterSequence ??
          3,
        courseId: entry.courseId,
        offeringSectionId: entry.offeringSectionId,
        shiftId: entry.shiftId ?? ctx.dayShiftId,
        academicYearId: ctx.academicYearId,
        category: section.courseOffering.category,
        workloadHours: '4',
        isPrimaryFaculty: true,
      },
      update: {
        academicYearId: ctx.academicYearId,
        category: section.courseOffering.category,
        shiftId: entry.shiftId ?? ctx.dayShiftId,
        isPrimaryFaculty: true,
      },
    });
    created += 1;
  }

  console.log(
    `Economics attendance test staff subject assignments: ${created}`,
  );
}

async function seedTeachingAssignments(
  ctx: SeedEconomicsSem3AttendanceContext,
  facultyByKey: Map<string, string>,
  planId: string,
) {
  const facultyByCourse: Record<string, string> = {
    'ECO-200': facultyByKey.get('mridul')!,
    'ECO-201': facultyByKey.get('mridul')!,
    'ECO-303': facultyByKey.get('renchi')!,
    'AEC-220': facultyByKey.get('meuller')!,
    'SEC-230': facultyByKey.get('meuller')!,
    'VTC-240': facultyByKey.get('brithuel')!,
    'MDC-210': facultyByKey.get('nokme')!,
    'POL-200': facultyByKey.get('tengsuang')!,
  };

  const courses = await ctx.prisma.course.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      code: { in: Object.keys(facultyByCourse) },
    },
    select: { id: true, code: true },
  });

  const offerings = await ctx.prisma.courseOffering.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      courseId: { in: courses.map((course) => course.id) },
    },
    include: {
      sections: {
        where: {
          deletedAt: null,
          shiftId: ctx.dayShiftId,
          sectionCode: 'A',
        },
      },
    },
  });

  for (const offering of offerings) {
    const courseCode = courses.find(
      (course) => course.id === offering.courseId,
    )?.code;
    const staffProfileId = courseCode
      ? facultyByCourse[courseCode.toUpperCase()]
      : null;
    const section = offering.sections[0];
    if (!staffProfileId || !section) continue;

    const existing = await (
      ctx.prisma as any
    ).subjectTeachingAssignment.findFirst({
      where: {
        tenantId: ctx.tenantId,
        staffProfileId,
        offeringSectionId: section.id,
        courseId: offering.courseId,
        deletedAt: null,
      },
    });
    if (existing) continue;

    await (ctx.prisma as any).subjectTeachingAssignment.create({
      data: {
        tenantId: ctx.tenantId,
        staffProfileId,
        courseId: offering.courseId,
        courseOfferingId: offering.id,
        offeringSectionId: section.id,
        academicYearId: ctx.academicYearId,
        semesterNo: offering.semesterSequence ?? 3,
        shiftId: ctx.dayShiftId,
        sectionCode: section.sectionCode,
        role: 'PRIMARY_FACULTY',
        isPrimary: true,
        canMarkAttendance: true,
        canEnterInternalMarks: true,
        canUploadLessonPlan: true,
        canAccessSubjectWorkspace: true,
      },
    });
  }

  const planEntries = await ctx.prisma.timetablePlanEntry.findMany({
    where: {
      tenantId: ctx.tenantId,
      planId,
      deletedAt: null,
      staffProfileId: { not: null },
      offeringSectionId: { not: null },
      courseId: { not: null },
    },
    select: {
      staffProfileId: true,
      courseId: true,
      courseOfferingId: true,
      offeringSectionId: true,
      semesterSequence: true,
      shiftId: true,
      sectionCode: true,
    },
  });
  const seen = new Set<string>();
  for (const entry of planEntries) {
    if (!entry.staffProfileId || !entry.courseId || !entry.offeringSectionId) {
      continue;
    }
    const key = `${entry.staffProfileId}:${entry.offeringSectionId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const existing = await (
      ctx.prisma as any
    ).subjectTeachingAssignment.findFirst({
      where: {
        tenantId: ctx.tenantId,
        staffProfileId: entry.staffProfileId,
        offeringSectionId: entry.offeringSectionId,
        deletedAt: null,
      },
    });
    if (existing) continue;

    await (ctx.prisma as any).subjectTeachingAssignment.create({
      data: {
        tenantId: ctx.tenantId,
        staffProfileId: entry.staffProfileId,
        courseId: entry.courseId,
        courseOfferingId: entry.courseOfferingId ?? undefined,
        offeringSectionId: entry.offeringSectionId,
        academicYearId: ctx.academicYearId,
        semesterNo: entry.semesterSequence ?? 3,
        shiftId: entry.shiftId ?? ctx.dayShiftId,
        sectionCode: entry.sectionCode ?? 'A',
        role: 'PRIMARY_FACULTY',
        isPrimary: true,
        canMarkAttendance: true,
        canEnterInternalMarks: true,
        canUploadLessonPlan: true,
        canAccessSubjectWorkspace: true,
      },
    });
  }
}

async function seedEconomicsStudentsAndRegistrations(
  ctx: SeedEconomicsSem3AttendanceContext,
) {
  const { prisma, tenantId, campusId, dayShiftId, semester3Id } = ctx;
  const passwordHash = await bcrypt.hash('Student@123', 12);

  const programVersion = await prisma.programVersion.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      program: { code: 'BA-ECO', deletedAt: null },
    },
    include: { program: { select: { id: true, departmentId: true } } },
  });
  if (!programVersion) {
    throw new Error('BA-ECO program version not found — run main seed first');
  }

  const offerings = await prisma.courseOffering.findMany({
    where: {
      tenantId,
      deletedAt: null,
      course: { code: { in: REGISTRATION_COURSE_CODES } },
    },
    include: {
      course: { select: { code: true } },
      sections: {
        where: {
          deletedAt: null,
          shiftId: dayShiftId,
          sectionCode: 'A',
        },
      },
    },
  });

  const offeringByCode = new Map<string, (typeof offerings)[number]>();
  for (const code of REGISTRATION_COURSE_CODES) {
    const matches = offerings.filter(
      (offering) => offering.course.code.toUpperCase() === code.toUpperCase(),
    );
    const preferred =
      matches.find(
        (offering) =>
          offering.semesterSequence === 3 ||
          (code === 'ECO-303' && offering.semesterSequence === 5),
      ) ?? matches[0];
    if (preferred) offeringByCode.set(code.toUpperCase(), preferred);
  }

  const students: Array<{ id: string }> = [];
  for (let i = 0; i < STUDENT_COUNT; i += 1) {
    const seq = String(i + 1).padStart(3, '0');
    const enrollmentNumber = `${STUDENT_PREFIX}-${seq}`;
    const email = `eco.s3a.${seq}@demo.edu`;

    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { isActive: true, deletedAt: null },
      create: {
        tenantId,
        email,
        passwordHash,
        displayName: `Economics S3A Student ${seq}`,
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });

    let student = await prisma.student.findFirst({
      where: {
        tenantId,
        OR: [{ enrollmentNumber }, { userId: user.id }],
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!student) {
      student = await prisma.student.create({
        data: {
          tenantId,
          userId: user.id,
          enrollmentNumber,
          rollNumber: `ECO3A${seq}`,
          admissionNumber: `ADM-${STUDENT_PREFIX}-${seq}`,
          campusId,
          programVersionId: programVersion.id,
          primaryShiftId: dayShiftId,
          importSource: SEED_MARKER,
        },
      });
      await prisma.studentProfile.create({
        data: {
          tenantId,
          studentId: student.id,
          fullName: `Economics S3A Student ${seq}`,
          email,
          studentStatus: 'STUDYING',
        },
      });
    } else {
      student = await prisma.student.update({
        where: { id: student.id },
        data: {
          enrollmentNumber,
          rollNumber: `ECO3A${seq}`,
          admissionNumber: `ADM-${STUDENT_PREFIX}-${seq}`,
          programVersionId: programVersion.id,
          primaryShiftId: dayShiftId,
          importSource: SEED_MARKER,
          deletedAt: null,
        },
      });
      await prisma.studentProfile.upsert({
        where: { studentId: student.id },
        create: {
          tenantId,
          studentId: student.id,
          fullName: `Economics S3A Student ${seq}`,
          email,
          studentStatus: 'STUDYING',
        },
        update: {
          fullName: `Economics S3A Student ${seq}`,
          email,
          studentStatus: 'STUDYING',
        },
      });
    }

    await (prisma as any).studentAcademicStanding.upsert({
      where: { studentId: student.id },
      create: {
        tenantId,
        studentId: student.id,
        currentSemesterSequence: 3,
        lifecycleState: 'ACTIVE',
        programmeStatus: 'IN_PROGRESS',
      },
      update: {
        currentSemesterSequence: 3,
        lifecycleState: 'ACTIVE',
        programmeStatus: 'IN_PROGRESS',
      },
    });

    students.push(student);
  }

  let registrationLines = 0;
  for (const student of students) {
    const registration = await prisma.semesterRegistration.upsert({
      where: {
        studentId_semesterId: {
          studentId: student.id,
          semesterId: semester3Id,
        },
      },
      create: {
        tenantId,
        studentId: student.id,
        semesterId: semester3Id,
        shiftId: dayShiftId,
        semesterSequence: 3,
        status: 'confirmed',
      },
      update: {
        shiftId: dayShiftId,
        status: 'confirmed',
      },
    });

    for (const offering of offeringByCode.values()) {
      const section = offering.sections[0];
      if (!section) continue;
      await prisma.semesterRegistrationLine.upsert({
        where: {
          registrationId_offeringSectionId: {
            registrationId: registration.id,
            offeringSectionId: section.id,
          },
        },
        create: {
          tenantId,
          registrationId: registration.id,
          offeringId: offering.id,
          offeringSectionId: section.id,
          category: String(offering.category ?? 'MAJOR').toUpperCase(),
          status: 'confirmed',
          registrationSource: SEED_MARKER,
          generatedBy: 'ECON_SEM3_ATTENDANCE_TEST',
        },
        update: {
          status: 'confirmed',
          category: String(offering.category ?? 'MAJOR').toUpperCase(),
        },
      });
      registrationLines += 1;
    }
  }

  console.log(
    `Economics Sem III attendance test: ${students.length} students, ${registrationLines} registration lines`,
  );
  return { studentsRegistered: students.length, registrationLines };
}

async function publishPlan(
  ctx: SeedEconomicsSem3AttendanceContext,
  planId: string,
) {
  await ctx.prisma.timetablePlan.update({
    where: { id: planId },
    data: {
      status: 'PUBLISHED',
      approvalState: 'PUBLISHED',
      publishedAt: new Date(),
      publishedById: ctx.createdById,
    },
  });
  console.log(`Published timetable plan: ${ECON_SEM3_ATTENDANCE_PLAN_NAME}`);
}

async function mirrorPublishedEntries(
  ctx: SeedEconomicsSem3AttendanceContext,
  planId: string,
) {
  const entries = await ctx.prisma.timetablePlanEntry.findMany({
    where: {
      tenantId: ctx.tenantId,
      planId,
      deletedAt: null,
      status: { not: 'CANCELLED' },
    },
  });
  await ctx.prisma.timetableEntry.deleteMany({
    where: { tenantId: ctx.tenantId, timetablePlanId: planId },
  });
  if (!entries.length) return;
  await ctx.prisma.timetableEntry.createMany({
    data: entries
      .filter((entry) => entry.shiftId)
      .map((entry) => ({
        tenantId: ctx.tenantId,
        shiftId: entry.shiftId as string,
        timetablePlanId: planId,
        timetablePlanEntryId: entry.id,
        offeringSectionId: entry.offeringSectionId,
        staffProfileId: entry.staffProfileId,
        classroomId: entry.classroomId,
        dayOfWeek: entry.dayOfWeek,
        startTime: entry.startTime,
        endTime: entry.endTime,
        status: 'scheduled',
      })),
  });
}
