/**
 * Smoke test: Shift II timetable → subject groups → sessions → roster → rollup.
 *   npx ts-node --transpile-only scripts/verify-subject-group-attendance.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StudentAttendanceService } from '../src/modules/student-attendance/student-attendance.service';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';

const TENANT_SLUG = 'demo';
const SESSION_DATE = '2026-06-17'; // Wednesday (Sem 3 slots)
const PLAN_NAME = 'DBC Arts Shift II · ODD · Jun–Jul 2026';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const prisma = app.get(PrismaService);
  const attendance = app.get(StudentAttendanceService);

  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG },
  });
  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant!.id, email: 'admin@demo.edu' },
  });
  if (!tenant || !admin) throw new Error('Demo tenant/admin missing');

  const user: JwtUser = {
    sub: admin.id,
    tid: tenant.id,
    email: admin.email,
    roles: [],
    permissions: ['*'],
  };

  const plan = await prisma.timetablePlan.findFirst({
    where: {
      tenantId: tenant.id,
      name: PLAN_NAME,
      deletedAt: null,
    },
  });
  if (!plan) throw new Error(`Shift II plan missing (${PLAN_NAME})`);
  if (plan.status !== 'PUBLISHED') {
    throw new Error(
      `Shift II plan is ${plan.status}; run seed-demo-timetable-foundation-runner`,
    );
  }

  const allEntries = await prisma.timetablePlanEntry.findMany({
    where: { tenantId: tenant.id, planId: plan.id, deletedAt: null },
  });
  const withGroup = allEntries.filter((e) => e.teachingSubjectGroupId);
  const withFaculty = allEntries.filter((e) => e.staffProfileId);
  const withRoom = allEntries.filter((e) => e.classroomId);

  console.log(
    `Plan entries: ${allEntries.length} total, ${withGroup.length} with groups, ${withFaculty.length} with faculty, ${withRoom.length} with rooms`,
  );
  if (allEntries.length < 11) {
    throw new Error(
      `Expected at least 11 Shift II slots, found ${allEntries.length}`,
    );
  }
  if (withFaculty.length < allEntries.length) {
    throw new Error(
      `${allEntries.length - withFaculty.length} entries missing faculty — run foundation seed`,
    );
  }
  if (withRoom.length < allEntries.length) {
    throw new Error(
      `${allEntries.length - withRoom.length} entries missing rooms — run foundation seed`,
    );
  }

  const wednesdayEntries = allEntries.filter(
    (e) => e.dayOfWeek === 3 && e.teachingSubjectGroupId,
  );
  console.log(`Wednesday group entries: ${wednesdayEntries.length}`);

  const generated = await attendance.generateFromTimetable(user, {
    date: SESSION_DATE,
    timetablePlanId: plan.id,
  });
  console.log('Generate:', generated);
  if (!generated.created) throw new Error('No sessions created');

  const sessions = await attendance.listSessions(tenant.id, {
    date: SESSION_DATE,
  });
  const groupSessions = sessions.filter((s: any) => s.teachingSubjectGroupId);
  console.log(
    `Sessions on ${SESSION_DATE}: ${sessions.length} (${groupSessions.length} with groups)`,
  );
  if (!groupSessions.length) throw new Error('No subject-group sessions');

  const sample = groupSessions[0];
  const roster = await attendance.roster(tenant.id, sample.id);
  console.log(
    `Roster for session ${sample.id}: ${roster.students.length} students`,
  );

  if (!roster.students.length) {
    throw new Error(
      'Roster empty — run seed-demo-timetable-foundation-runner (Shift II registrations)',
    );
  }

  const studentId = roster.students[0].id;
  await attendance.markSession(user, sample.id, {
    entries: [{ studentId, status: 'P' }],
  });
  console.log('Mark attendance OK');

  const linkedPapers = sample.teachingSubjectGroupId
    ? await (prisma as any).teachingSubjectGroupPaper.findMany({
        where: {
          tenantId: tenant.id,
          teachingSubjectGroupId: sample.teachingSubjectGroupId,
        },
        select: { courseId: true, offeringSectionId: true },
      })
    : [];

  if (linkedPapers.length > 1) {
    const summaries = await (prisma as any).studentAttendanceSummary.findMany({
      where: {
        tenantId: tenant.id,
        studentId,
        semesterNo: sample.semesterNo,
        courseId: { in: linkedPapers.map((p: any) => p.courseId) },
      },
    });
    console.log(
      `Rollup summaries: ${summaries.length}/${linkedPapers.length} linked papers updated`,
    );
    if (summaries.length < linkedPapers.length) {
      throw new Error(
        'Attendance rollup missing summaries for some linked papers',
      );
    }
    const allPresent = summaries.every(
      (row: any) => Number(row.presentCount ?? 0) >= 1,
    );
    if (!allPresent) {
      throw new Error('Rollup summaries do not reflect present mark');
    }
    console.log('Rollup across linked papers OK');
  }

  console.log('Smoke test passed');
  await app.close();
}

main().catch((error) => {
  console.error('Smoke test failed:', error);
  process.exit(1);
});
