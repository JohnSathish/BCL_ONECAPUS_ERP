/**
 * Demo live-readiness seed — timetable, rosters, fees, LMS, exam results.
 * Called from seed.ts and prepare-live-demo script.
 */
import type { PrismaClient } from '@prisma/client';
import { seedDemoTimetableFoundation } from './seed-demo-timetable-foundation';

export type SeedDemoLiveReadyContext = {
  prisma: PrismaClient;
  tenantId: string;
  institutionId: string;
  campusId: string;
  academicYearId: string;
  createdById?: string;
  shifts: Record<string, { id: string }>;
  semesterBySeq: Record<number, { id: string }>;
};

const DEMO_IA_SESSION = 'IA Test 1 — Demo';

export async function ensureDemoStudentStandings(
  ctx: SeedDemoLiveReadyContext,
) {
  const students = await ctx.prisma.student.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      OR: [
        { enrollmentNumber: { startsWith: 'DEMO-S3-' } },
        { importSource: 'DEMO_SEED' },
      ],
    },
    select: { id: true, enrollmentNumber: true },
  });

  let upserted = 0;
  for (const student of students) {
    const sem = student.enrollmentNumber?.includes('S5') ? 5 : 3;
    await (ctx.prisma as any).studentAcademicStanding.upsert({
      where: { studentId: student.id },
      create: {
        tenantId: ctx.tenantId,
        studentId: student.id,
        currentSemesterSequence: sem,
        lifecycleState: 'ACTIVE',
        programmeStatus: 'IN_PROGRESS',
      },
      update: {
        currentSemesterSequence: sem,
        lifecycleState: 'ACTIVE',
        programmeStatus: 'IN_PROGRESS',
      },
    });
    upserted += 1;
  }
  console.log(`Demo student standings: ${upserted}`);
  return upserted;
}

export async function seedDemoExamResults(ctx: SeedDemoLiveReadyContext) {
  const { prisma, tenantId, academicYearId, createdById } = ctx;
  const shiftIi = ctx.shifts.SHIFT_II;

  const students = await prisma.student.findMany({
    where: {
      tenantId,
      deletedAt: null,
      enrollmentNumber: { startsWith: 'DEMO-S3-' },
    },
    take: 12,
    orderBy: { enrollmentNumber: 'asc' },
  });
  if (!students.length) {
    console.warn('Demo exam seed skipped: no demo students');
    return { sessionId: null, results: 0 };
  }

  await (prisma as any).tenantExaminationSettings.upsert({
    where: { tenantId },
    create: {
      tenantId,
      legacyUniversityExamMode: false,
      iaPassMarkPercent: 40,
      attendanceMinPercent: 75,
      blockAdmitOnDefaulter: false,
    },
    update: {
      legacyUniversityExamMode: false,
    },
  });

  let session = await (prisma as any).examSession.findFirst({
    where: { tenantId, name: DEMO_IA_SESSION, deletedAt: null },
  });
  if (!session) {
    session = await (prisma as any).examSession.create({
      data: {
        tenantId,
        name: DEMO_IA_SESSION,
        academicYearId,
        shiftId: shiftIi?.id,
        examType: 'IA_TEST_1',
        semesterNo: 3,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-03-15'),
        status: 'ACTIVE',
        createdById,
      },
    });
  }

  const registrationLine = await prisma.semesterRegistrationLine.findFirst({
    where: {
      tenantId,
      status: 'confirmed',
      registration: {
        studentId: students[0].id,
        semesterSequence: 3,
        status: 'confirmed',
      },
    },
    include: {
      offering: {
        include: { course: { select: { id: true, code: true, title: true } } },
      },
    },
  });
  const course = registrationLine?.offering?.course;
  if (!course) {
    console.warn('Demo exam seed skipped: no registration lines');
    return { sessionId: session.id, results: 0 };
  }

  let paper = await (prisma as any).examPaperSchedule.findFirst({
    where: {
      tenantId,
      sessionId: session.id,
      paperCode: course.code,
      deletedAt: null,
    },
  });
  if (!paper) {
    paper = await (prisma as any).examPaperSchedule.create({
      data: {
        tenantId,
        sessionId: session.id,
        courseId: course.id,
        offeringId: registrationLine.offeringId,
        paperCode: course.code,
        paperName: course.title,
        examDate: new Date('2026-03-10'),
        startTime: new Date('1970-01-01T10:00:00Z'),
        endTime: new Date('1970-01-01T12:00:00Z'),
        semesterNo: 3,
        expectedCount: students.length,
        status: 'SCHEDULED',
      },
    });
  }

  let scheme = await (prisma as any).iaAssessmentScheme.findFirst({
    where: {
      tenantId,
      courseId: course.id,
      name: { contains: 'Sociology' },
      deletedAt: null,
    },
    include: { components: true },
  });
  if (!scheme) {
    scheme = await (prisma as any).iaAssessmentScheme.create({
      data: {
        tenantId,
        academicYearId,
        courseId: course.id,
        offeringId: registrationLine.offeringId,
        semesterNo: 3,
        name: `Sociology IA Scheme — ${course.title}`,
        totalMaxMarks: 40,
        passMark: 16,
        status: 'ACTIVE',
        createdById,
        components: {
          create: [
            {
              tenantId,
              code: 'IA_TEST_1',
              label: 'IA Test 1',
              maxMarks: 20,
              sortOrder: 1,
            },
            {
              tenantId,
              code: 'IA_TEST_2',
              label: 'IA Test 2',
              maxMarks: 10,
              sortOrder: 2,
            },
            {
              tenantId,
              code: 'ASSIGNMENT',
              label: 'Assignment',
              maxMarks: 5,
              sortOrder: 3,
            },
            {
              tenantId,
              code: 'ATTENDANCE',
              label: 'Attendance',
              maxMarks: 5,
              sortOrder: 4,
            },
          ],
        },
      },
      include: { components: true },
    });
  }

  const iaTest1 = scheme.components.find(
    (c: { code: string }) => c.code === 'IA_TEST_1',
  );
  const assignment = scheme.components.find(
    (c: { code: string }) => c.code === 'ASSIGNMENT',
  );

  const now = new Date();
  let markCount = 0;
  for (const [index, student] of students.entries()) {
    const iaTestMarks = 14 + (index % 6);
    const assignmentMarks = 3 + (index % 3);
    const total = iaTestMarks + assignmentMarks;
    const percentage = (total / 40) * 100;

    if (iaTest1) {
      await (prisma as any).iaComponentMark.upsert({
        where: {
          componentId_studentId_paperId: {
            componentId: iaTest1.id,
            studentId: student.id,
            paperId: paper.id,
          },
        },
        create: {
          tenantId,
          sessionId: session.id,
          paperId: paper.id,
          schemeId: scheme.id,
          componentId: iaTest1.id,
          studentId: student.id,
          marks: iaTestMarks,
          maxMarks: 20,
          enteredById: createdById,
          status: 'DRAFT',
        },
        update: { marks: iaTestMarks },
      });
    }
    if (assignment) {
      await (prisma as any).iaComponentMark.upsert({
        where: {
          componentId_studentId_paperId: {
            componentId: assignment.id,
            studentId: student.id,
            paperId: paper.id,
          },
        },
        create: {
          tenantId,
          sessionId: session.id,
          paperId: paper.id,
          schemeId: scheme.id,
          componentId: assignment.id,
          studentId: student.id,
          marks: assignmentMarks,
          maxMarks: 5,
          enteredById: createdById,
          status: 'DRAFT',
        },
        update: { marks: assignmentMarks },
      });
    }

    await (prisma as any).examMarkEntry.upsert({
      where: {
        paperId_studentId: { paperId: paper.id, studentId: student.id },
      },
      create: {
        tenantId,
        sessionId: session.id,
        paperId: paper.id,
        studentId: student.id,
        internalMarks: total,
        externalMarks: 0,
        totalMarks: total,
        maxMarks: 40,
        grade: percentage >= 60 ? 'B+' : 'B',
        gradePoint: percentage >= 60 ? 7 : 6,
        resultStatus: percentage >= 40 ? 'PASS' : 'FAIL',
        entryStatus: 'DRAFT',
        enteredById: createdById,
      },
      update: {
        internalMarks: total,
        totalMarks: total,
        entryStatus: 'DRAFT',
        resultStatus: percentage >= 40 ? 'PASS' : 'FAIL',
      },
    });
    markCount += 1;

    await (prisma as any).examResultSummary.upsert({
      where: {
        sessionId_studentId: { sessionId: session.id, studentId: student.id },
      },
      create: {
        tenantId,
        sessionId: session.id,
        studentId: student.id,
        totalMarks: total,
        maxMarks: 40,
        percentage,
        sgpa: 7.2,
        cgpa: 7.0,
        resultStatus: percentage >= 40 ? 'PASS' : 'FAIL',
        publishStatus: 'DRAFT',
        calculatedAt: now,
      },
      update: {
        totalMarks: total,
        maxMarks: 40,
        percentage,
        resultStatus: percentage >= 40 ? 'PASS' : 'FAIL',
        publishStatus: 'DRAFT',
        calculatedAt: now,
      },
    });
  }

  console.log(
    `Demo IA marks: session ${session.id}, scheme ${scheme.id}, ${markCount} students`,
  );
  return { sessionId: session.id, results: markCount };
}

export async function seedDemoLiveReady(ctx: SeedDemoLiveReadyContext) {
  console.log('--- Demo live-ready preparation ---');

  await seedDemoTimetableFoundation(ctx);
  await ensureDemoStudentStandings(ctx);
  await seedDemoExamResults(ctx);

  console.log(
    '--- Demo live-ready seed complete (run prepare-live-demo for fees + LMS) ---',
  );
}
