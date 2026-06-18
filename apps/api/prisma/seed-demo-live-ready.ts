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

const DEMO_EXAM_SESSION = 'Odd Semester End Examination 2026 · Demo';

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

  let session = await (prisma as any).examSession.findFirst({
    where: { tenantId, name: DEMO_EXAM_SESSION, deletedAt: null },
  });
  if (!session) {
    session = await (prisma as any).examSession.create({
      data: {
        tenantId,
        name: DEMO_EXAM_SESSION,
        academicYearId,
        shiftId: shiftIi?.id,
        examType: 'SEMESTER_END',
        semesterNo: 3,
        startDate: new Date('2026-05-01'),
        endDate: new Date('2026-05-15'),
        status: 'COMPLETED',
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
        examDate: new Date('2026-05-10'),
        startTime: new Date('1970-01-01T10:00:00Z'),
        endTime: new Date('1970-01-01T13:00:00Z'),
        semesterNo: 3,
        expectedCount: students.length,
        status: 'COMPLETED',
      },
    });
  }

  const now = new Date();
  let markCount = 0;
  for (const [index, student] of students.entries()) {
    const external = 55 + (index % 8) * 4;
    const internal = 18 + (index % 5);
    const total = external + internal;
    const percentage = total;
    await (prisma as any).examMarkEntry.upsert({
      where: {
        paperId_studentId: { paperId: paper.id, studentId: student.id },
      },
      create: {
        tenantId,
        sessionId: session.id,
        paperId: paper.id,
        studentId: student.id,
        internalMarks: internal,
        externalMarks: external,
        totalMarks: total,
        maxMarks: 100,
        grade: percentage >= 60 ? 'B+' : 'B',
        gradePoint: percentage >= 60 ? 7 : 6,
        resultStatus: percentage >= 40 ? 'PASS' : 'FAIL',
        entryStatus: 'PUBLISHED',
        publishedAt: now,
        enteredById: createdById,
      },
      update: {
        internalMarks: internal,
        externalMarks: external,
        totalMarks: total,
        entryStatus: 'PUBLISHED',
        publishedAt: now,
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
        maxMarks: 100,
        percentage,
        sgpa: 7.2,
        cgpa: 7.0,
        resultStatus: percentage >= 40 ? 'PASS' : 'FAIL',
        publishStatus: 'PUBLISHED',
        publishedAt: now,
        calculatedAt: now,
      },
      update: {
        totalMarks: total,
        maxMarks: 100,
        percentage,
        sgpa: 7.2,
        resultStatus: percentage >= 40 ? 'PASS' : 'FAIL',
        publishStatus: 'PUBLISHED',
        publishedAt: now,
        calculatedAt: now,
      },
    });
  }

  console.log(
    `Demo exam results: session ${session.id}, ${markCount} marks published`,
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
