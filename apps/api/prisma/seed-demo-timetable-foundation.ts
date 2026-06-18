import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { syncSubjectGroupsForShift } from './seed-timetable-subject-groups';

const DEMO_FACULTY: Array<{
  deptCode: string;
  shortCode: string;
  fullName: string;
  employeeCode: string;
  email: string;
  shiftCategory: 'DAY' | 'SHIFT_II';
}> = [
  {
    deptCode: 'ECONOMICS',
    shortCode: 'FM',
    fullName: 'Dr. Francis Momin',
    employeeCode: 'DBC-T-ECO-01',
    email: 'francis.momin@demo.edu',
    shiftCategory: 'SHIFT_II',
  },
  {
    deptCode: 'EDUCATION',
    shortCode: 'WM',
    fullName: 'Dr. Wanda Marak',
    employeeCode: 'DBC-T-EDU-01',
    email: 'wanda.marak@demo.edu',
    shiftCategory: 'SHIFT_II',
  },
  {
    deptCode: 'ENGLISH',
    shortCode: 'SP',
    fullName: 'Dr. Sandra Sangma',
    employeeCode: 'DBC-T-ENG-01',
    email: 'sandra.sangma@demo.edu',
    shiftCategory: 'DAY',
  },
  {
    deptCode: 'GEOGRAPHY',
    shortCode: 'GK',
    fullName: 'Dr. Grace Kharkongor',
    employeeCode: 'DBC-T-GEO-01',
    email: 'grace.kharkongor@demo.edu',
    shiftCategory: 'DAY',
  },
  {
    deptCode: 'HISTORY',
    shortCode: 'HM',
    fullName: 'Dr. Henry Marak',
    employeeCode: 'DBC-T-HIS-01',
    email: 'henry.marak@demo.edu',
    shiftCategory: 'SHIFT_II',
  },
  {
    deptCode: 'PHILOSOPHY',
    shortCode: 'PS',
    fullName: 'Dr. Peter Sangma',
    employeeCode: 'DBC-T-PHI-01',
    email: 'peter.sangma@demo.edu',
    shiftCategory: 'DAY',
  },
  {
    deptCode: 'POLITICAL SCIENCE',
    shortCode: 'PM',
    fullName: 'Dr. Paul Momin',
    employeeCode: 'DBC-T-POL-01',
    email: 'paul.momin@demo.edu',
    shiftCategory: 'SHIFT_II',
  },
  {
    deptCode: 'SOCIOLOGY',
    shortCode: 'SM',
    fullName: 'Dr. Sarah Marak',
    employeeCode: 'DBC-T-SOC-01',
    email: 'sarah.marak@demo.edu',
    shiftCategory: 'SHIFT_II',
  },
  {
    deptCode: 'GARO',
    shortCode: 'GR',
    fullName: 'Dr. Ringku R Marak',
    employeeCode: 'DBC-T-GAR-01',
    email: 'ringku.marak@demo.edu',
    shiftCategory: 'DAY',
  },
];

const DEMO_ROOMS = [
  { code: 'A-101', name: 'Arts Room 101', isLab: false },
  { code: 'A-102', name: 'Arts Room 102', isLab: false },
  { code: 'A-103', name: 'Arts Room 103', isLab: false },
  { code: 'A-104', name: 'Arts Room 104', isLab: false },
  { code: 'A-105', name: 'Arts Room 105', isLab: false },
  { code: 'A-201', name: 'Arts Room 201', isLab: false },
  { code: 'LAB-1', name: 'Arts Laboratory 1', isLab: true },
  { code: 'SEM-1', name: 'Seminar Hall 1', isLab: false },
];

const PLAN_NAMES = {
  dayOdd: 'Arts · Day Shift · ODD · Weekly Routine',
  shiftIi: 'DBC Arts Shift II · ODD · Jun–Jul 2026',
};

export type SeedDemoTimetableFoundationContext = {
  prisma: PrismaClient;
  tenantId: string;
  institutionId: string;
  campusId: string;
  academicYearId: string;
  createdById?: string;
  shifts: Record<string, { id: string }>;
  semesterBySeq: Record<number, { id: string }>;
};

export async function seedDemoTimetableFoundation(
  ctx: SeedDemoTimetableFoundationContext,
) {
  const facultyByDept = await seedDemoFaculty(ctx);
  const roomByCode = await seedDemoClassrooms(ctx);
  await ensureShiftIiOfferingSections(ctx);
  await backfillSubjectGroups(ctx);
  await assignSubjectGroupFaculty(ctx, facultyByDept);
  await finalizeTimetableEntries(ctx, facultyByDept, roomByCode);
  await seedTeachingAssignments(ctx);
  await backfillSubjectGroups(ctx);
  const registrationStats = await seedShiftRegistrations(ctx);
  await publishTimetablePlans(ctx);

  console.log(
    `Demo timetable foundation: faculty ${facultyByDept.size}, rooms ${roomByCode.size}, registrations ${registrationStats.lines} lines for ${registrationStats.students} students`,
  );
  return { facultyByDept, roomByCode, registrationStats };
}

async function seedDemoFaculty(ctx: SeedDemoTimetableFoundationContext) {
  const { prisma, tenantId, campusId, createdById } = ctx;
  const facultyByDept = new Map<string, string>();
  const passwordHash = await bcrypt.hash('Faculty@123', 12);
  const portalRole = await prisma.role.findFirst({
    where: { tenantId, slug: 'faculty', deletedAt: null },
  });

  for (const row of DEMO_FACULTY) {
    const department = await prisma.department.findFirst({
      where: { tenantId, code: row.deptCode, deletedAt: null },
    });
    const shift =
      ctx.shifts[row.shiftCategory === 'SHIFT_II' ? 'SHIFT_II' : 'DAY'];

    let staff = await prisma.staffProfile.findFirst({
      where: {
        tenantId,
        OR: [
          { employeeCode: row.employeeCode },
          { shortCode: row.shortCode, campusId },
        ],
        deletedAt: null,
      },
    });

    if (!staff) {
      const user = await prisma.user.upsert({
        where: { tenantId_email: { tenantId, email: row.email } },
        update: { passwordHash, isActive: true, deletedAt: null },
        create: {
          tenantId,
          email: row.email,
          passwordHash,
          displayName: row.fullName,
          emailVerifiedAt: new Date(),
          isActive: true,
        },
      });
      if (portalRole) {
        const hasRole = await prisma.userRole.findFirst({
          where: { userId: user.id, roleId: portalRole.id, deletedAt: null },
        });
        if (!hasRole) {
          await prisma.userRole.create({
            data: { userId: user.id, roleId: portalRole.id },
          });
        }
      }

      staff = await prisma.staffProfile.create({
        data: {
          tenantId,
          employeeCode: row.employeeCode,
          employeeCodeAutoGenerated: false,
          fullName: row.fullName,
          email: row.email,
          staffType: 'TEACHING',
          employmentType: 'PERMANENT',
          departmentId: department?.id,
          campusId,
          primaryShiftId: shift?.id,
          teachingShiftCategory: row.shiftCategory,
          shortCode: row.shortCode,
          status: 'ACTIVE',
          portalUserId: user.id,
        },
      });
    } else {
      staff = await prisma.staffProfile.update({
        where: { id: staff.id },
        data: {
          shortCode: row.shortCode,
          departmentId: department?.id ?? staff.departmentId,
          primaryShiftId: shift?.id ?? staff.primaryShiftId,
          teachingShiftCategory: row.shiftCategory,
          status: 'ACTIVE',
        },
      });
    }

    facultyByDept.set(row.deptCode, staff.id);
    void createdById;
  }

  return facultyByDept;
}

async function seedDemoClassrooms(ctx: SeedDemoTimetableFoundationContext) {
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

  for (const room of DEMO_ROOMS) {
    const row = await prisma.classroom.upsert({
      where: { tenantId_code: { tenantId, code: room.code } },
      create: {
        tenantId,
        campusId,
        code: room.code,
        name: room.name,
        capacity: room.isLab ? 30 : 50,
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

async function backfillSubjectGroups(ctx: SeedDemoTimetableFoundationContext) {
  const dayShift = ctx.shifts.DAY;
  const shiftIi = ctx.shifts.SHIFT_II;
  if (dayShift) {
    await syncSubjectGroupsForShift(
      ctx.prisma,
      ctx.tenantId,
      dayShift.id,
      ctx.academicYearId,
      [1, 3, 5],
    );
  }
  if (shiftIi) {
    await syncSubjectGroupsForShift(
      ctx.prisma,
      ctx.tenantId,
      shiftIi.id,
      ctx.academicYearId,
      [3, 5],
    );
  }
}

async function assignSubjectGroupFaculty(
  ctx: SeedDemoTimetableFoundationContext,
  facultyByDept: Map<string, string>,
) {
  const groups = await (ctx.prisma as any).teachingSubjectGroup.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null, status: 'ACTIVE' },
    include: { department: { select: { code: true } } },
  });

  const fallbackStaff = [...facultyByDept.values()][0];
  for (const group of groups) {
    const deptCode = group.department?.code;
    const staffId =
      (deptCode ? facultyByDept.get(deptCode) : null) ?? fallbackStaff;
    if (!staffId) continue;
    await (ctx.prisma as any).teachingSubjectGroup.update({
      where: { id: group.id },
      data: { primaryStaffProfileId: staffId },
    });
  }
}

async function finalizeTimetableEntries(
  ctx: SeedDemoTimetableFoundationContext,
  facultyByDept: Map<string, string>,
  roomByCode: Map<string, string>,
) {
  const roomIds = [...roomByCode.values()];
  const theoryRooms = ['A-101', 'A-102', 'A-103', 'A-104', 'A-105', 'A-201']
    .map((code) => roomByCode.get(code))
    .filter(Boolean) as string[];

  const groups = await (ctx.prisma as any).teachingSubjectGroup.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    select: {
      id: true,
      primaryStaffProfileId: true,
      offeringSectionId: true,
      department: { select: { code: true } },
    },
  });
  const groupById = new Map(groups.map((g: any) => [g.id, g]));

  const paperLinks = await (
    ctx.prisma as any
  ).teachingSubjectGroupPaper.findMany({
    where: { tenantId: ctx.tenantId },
    select: { courseId: true, teachingSubjectGroupId: true },
  });
  const groupByCourseId = new Map(
    paperLinks.map((p: any) => [p.courseId, p.teachingSubjectGroupId]),
  );

  const plans = await ctx.prisma.timetablePlan.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      name: { in: [PLAN_NAMES.dayOdd, PLAN_NAMES.shiftIi] },
    },
  });

  let updated = 0;
  for (const plan of plans) {
    const entries = await ctx.prisma.timetablePlanEntry.findMany({
      where: { tenantId: ctx.tenantId, planId: plan.id, deletedAt: null },
    });

    for (const entry of entries) {
      const groupId =
        entry.teachingSubjectGroupId ??
        (entry.courseId ? groupByCourseId.get(entry.courseId) : null);
      const group = groupId ? groupById.get(groupId) : null;
      const deptStaff = group?.department?.code
        ? facultyByDept.get(group.department.code)
        : null;
      const staffProfileId =
        entry.staffProfileId ??
        group?.primaryStaffProfileId ??
        deptStaff ??
        [...facultyByDept.values()][0];
      const roomIndex = (entry.periodNo ?? 1) - 1;
      const classroomId =
        entry.classroomId ??
        theoryRooms[roomIndex % theoryRooms.length] ??
        roomIds[0];
      const roomCode =
        [...roomByCode.entries()].find(([, id]) => id === classroomId)?.[0] ??
        null;

      await ctx.prisma.timetablePlanEntry.update({
        where: { id: entry.id },
        data: {
          teachingSubjectGroupId: groupId ?? undefined,
          staffProfileId,
          classroomId,
          offeringSectionId:
            entry.offeringSectionId ?? group?.offeringSectionId ?? undefined,
          metadata: {
            ...((entry.metadata as object) ?? {}),
            roomStatus: classroomId ? 'FINAL' : 'DRAFT',
            preferredRoom: roomCode,
            teachingSubjectGroupId: groupId,
          },
        },
      });
      updated += 1;
    }
  }

  console.log(`Finalized ${updated} timetable entries with faculty + rooms`);
}

async function seedTeachingAssignments(
  ctx: SeedDemoTimetableFoundationContext,
) {
  const groups = await (ctx.prisma as any).teachingSubjectGroup.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      primaryStaffProfileId: { not: null },
    },
    include: {
      papers: { select: { courseId: true, offeringSectionId: true } },
    },
  });

  for (const group of groups) {
    for (const paper of group.papers ?? []) {
      if (!paper.offeringSectionId || !group.primaryStaffProfileId) continue;
      const existing = await (
        ctx.prisma as any
      ).subjectTeachingAssignment.findFirst({
        where: {
          tenantId: ctx.tenantId,
          staffProfileId: group.primaryStaffProfileId,
          offeringSectionId: paper.offeringSectionId,
          courseId: paper.courseId,
          deletedAt: null,
        },
      });
      if (existing) continue;
      await (ctx.prisma as any).subjectTeachingAssignment.create({
        data: {
          tenantId: ctx.tenantId,
          staffProfileId: group.primaryStaffProfileId,
          courseId: paper.courseId,
          offeringSectionId: paper.offeringSectionId,
          semesterNo: group.semesterNo,
          shiftId: group.shiftId,
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
}

async function ensureShiftIiOfferingSections(
  ctx: SeedDemoTimetableFoundationContext,
) {
  const shiftIi = ctx.shifts.SHIFT_II;
  const dayShift = ctx.shifts.DAY;
  if (!shiftIi || !dayShift) return;

  const daySections = await ctx.prisma.offeringSection.findMany({
    where: {
      tenantId: ctx.tenantId,
      shiftId: dayShift.id,
      deletedAt: null,
      courseOffering: { semesterSequence: { in: [3, 5] } },
    },
    include: { courseOffering: { select: { id: true } } },
  });

  let created = 0;
  for (const daySection of daySections) {
    const existing = await ctx.prisma.offeringSection.findFirst({
      where: {
        courseOfferingId: daySection.courseOfferingId,
        shiftId: shiftIi.id,
        sectionCode: daySection.sectionCode,
        deletedAt: null,
      },
    });
    if (existing) continue;
    const section = await ctx.prisma.offeringSection.create({
      data: {
        tenantId: ctx.tenantId,
        courseOfferingId: daySection.courseOfferingId,
        shiftId: shiftIi.id,
        sectionCode: daySection.sectionCode,
        capacity: daySection.capacity,
        waitlistCapacity: daySection.waitlistCapacity,
        status: 'active',
      },
    });
    await ctx.prisma.offeringSeatLedger.upsert({
      where: { offeringSectionId: section.id },
      create: { tenantId: ctx.tenantId, offeringSectionId: section.id },
      update: {},
    });
    created += 1;
  }
  console.log(`Created ${created} Shift II offering sections`);
}

async function seedShiftRegistrations(ctx: SeedDemoTimetableFoundationContext) {
  const shiftIi = ctx.shifts.SHIFT_II;
  if (!shiftIi) return { students: 0, lines: 0 };

  let students = await ctx.prisma.student.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      OR: [
        { enrollmentNumber: { startsWith: 'DEMO-S3-' } },
        { importSource: 'DEMO_SEED' },
      ],
    },
    take: 20,
    orderBy: { createdAt: 'asc' },
  });

  students = students.filter(
    (student) =>
      !shiftIi.id ||
      student.primaryShiftId == null ||
      student.primaryShiftId === shiftIi.id,
  );

  if (students.length < 8) {
    const created = await seedDemoStudents(ctx, 12 - students.length);
    students = [...students, ...created];
  }

  const offerings = await ctx.prisma.courseOffering.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      semesterSequence: { in: [3, 5] },
    },
    include: {
      sections: {
        where: { deletedAt: null, shiftId: shiftIi.id },
        take: 1,
      },
    },
  });

  const semOfferings = offerings.filter((o) => o.sections[0]);

  let lineCount = 0;
  for (const semesterNo of [3, 5]) {
    const semesterId = ctx.semesterBySeq[semesterNo]?.id;
    if (!semesterId) continue;

    const semOfferingsForTerm = semOfferings.filter(
      (o) => o.semesterSequence === semesterNo,
    );

    for (const student of students.slice(0, 12)) {
      const registration = await ctx.prisma.semesterRegistration.upsert({
        where: {
          studentId_semesterId: { studentId: student.id, semesterId },
        },
        create: {
          tenantId: ctx.tenantId,
          studentId: student.id,
          semesterId,
          shiftId: shiftIi.id,
          semesterSequence: semesterNo,
          status: 'confirmed',
        },
        update: {
          shiftId: shiftIi.id,
          status: 'confirmed',
        },
      });

      for (const offering of semOfferingsForTerm) {
        const section = offering.sections[0];
        if (!section) continue;
        await ctx.prisma.semesterRegistrationLine.upsert({
          where: {
            registrationId_offeringSectionId: {
              registrationId: registration.id,
              offeringSectionId: section.id,
            },
          },
          create: {
            tenantId: ctx.tenantId,
            registrationId: registration.id,
            offeringId: offering.id,
            offeringSectionId: section.id,
            category: String(offering.category ?? 'MAJOR').toUpperCase(),
            status: 'confirmed',
            registrationSource: 'DEMO_SEED',
            generatedBy: 'SHIFT_II_FOUNDATION',
          },
          update: {
            status: 'confirmed',
            category: String(offering.category ?? 'MAJOR').toUpperCase(),
          },
        });
        lineCount += 1;
      }
    }
  }

  return { students: Math.min(students.length, 12), lines: lineCount };
}

async function seedDemoStudents(
  ctx: SeedDemoTimetableFoundationContext,
  count: number,
) {
  const { prisma, tenantId, campusId, createdById } = ctx;
  const shiftIi = ctx.shifts.SHIFT_II;
  const artsProgram = await prisma.programVersion.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      program: { department: { code: 'ECONOMICS' } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const passwordHash = await bcrypt.hash('Student@123', 12);
  const created: Array<{ id: string }> = [];

  for (let i = 0; i < count; i += 1) {
    const seq = String(i + 1).padStart(3, '0');
    const enrollmentNumber = `DEMO-S3-${seq}`;
    const email = `demo.student.${seq}@demo.edu`;

    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId, email } },
      update: { isActive: true, deletedAt: null },
      create: {
        tenantId,
        email,
        passwordHash,
        displayName: `Demo Student ${seq}`,
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });

    let student = await prisma.student.findFirst({
      where: { tenantId, enrollmentNumber, deletedAt: null },
    });
    if (!student) {
      student = await prisma.student.create({
        data: {
          tenantId,
          userId: user.id,
          enrollmentNumber,
          rollNumber: `ARTS25${seq}`,
          admissionNumber: `ADM25${seq}`,
          campusId,
          programVersionId: artsProgram?.id,
          primaryShiftId: shiftIi?.id,
          importSource: 'DEMO_SEED',
          createdById,
        },
      });
      await prisma.studentProfile.create({
        data: {
          tenantId,
          studentId: student.id,
          fullName: `Demo Student ${seq}`,
          email,
          studentStatus: 'STUDYING',
        },
      });
    }
    created.push(student);
  }

  return created;
}

async function publishTimetablePlans(ctx: SeedDemoTimetableFoundationContext) {
  const now = new Date();
  for (const name of [PLAN_NAMES.dayOdd, PLAN_NAMES.shiftIi]) {
    const plan = await ctx.prisma.timetablePlan.findFirst({
      where: { tenantId: ctx.tenantId, name, deletedAt: null },
    });
    if (!plan) continue;
    await ctx.prisma.timetablePlan.update({
      where: { id: plan.id },
      data: {
        status: 'PUBLISHED',
        approvalState: 'PUBLISHED',
        publishedAt: now,
        publishedById: ctx.createdById,
      },
    });
    console.log(`Published timetable plan: ${name}`);
  }
}
