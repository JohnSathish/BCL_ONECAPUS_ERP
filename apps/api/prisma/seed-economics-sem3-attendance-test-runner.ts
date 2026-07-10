/**
 * Seed FYUP Economics Sem III Section A test timetable + generate today's attendance sessions.
 *
 * Run from apps/api:
 *   npx ts-node --transpile-only prisma/seed-economics-sem3-attendance-test-runner.ts
 */
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { StudentAttendanceService } from '../src/modules/student-attendance/student-attendance.service';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';
import {
  ECON_SEM3_ATTENDANCE_PLAN_NAME,
  seedEconomicsSem3AttendanceTest,
} from './seed-economics-sem3-attendance-test';

const prisma = new PrismaClient();

function localDateString(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found (slug: demo)');

  const institution = await prisma.institution.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
  });
  const campus = await prisma.campus.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  const academicYear = await prisma.academicYear.findFirst({
    where: { tenantId: tenant.id, deletedAt: null, name: '2026-27' },
  });
  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'admin@demo.edu' },
  });
  const dayShift = await prisma.shift.findFirst({
    where: { tenantId: tenant.id, code: 'DAY', deletedAt: null },
  });
  const semester3 = await prisma.semester.findFirst({
    where: { tenantId: tenant.id, sequence: 3, deletedAt: null },
  });

  if (!institution || !campus || !academicYear || !dayShift || !semester3) {
    throw new Error(
      'Missing institution, campus, academic year, DAY shift, or semester III',
    );
  }

  const result = await seedEconomicsSem3AttendanceTest({
    prisma,
    tenantId: tenant.id,
    institutionId: institution.id,
    campusId: campus.id,
    academicYearId: academicYear.id,
    createdById: admin?.id,
    dayShiftId: dayShift.id,
    semester3Id: semester3.id,
  });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const attendance = app.get(StudentAttendanceService);

  const user: JwtUser = {
    sub: admin!.id,
    tid: tenant.id,
    email: admin!.email,
    roles: [],
    permissions: ['*'],
  };

  const today = new Date();
  const sessionDate = localDateString(today);
  const generated = await attendance.generateFromTimetable(user, {
    date: sessionDate,
    timetablePlanId: result.planId,
  });

  const johnUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'mridul.chanda77@gmail.com' },
  });
  let facultyTodayCount = 0;
  if (johnUser) {
    const facultyUser: JwtUser = {
      sub: johnUser.id,
      tid: tenant.id,
      email: johnUser.email,
      roles: [],
      permissions: ['attendance.write'],
    };
    const facultyToday = await attendance.facultyToday(facultyUser);
    facultyTodayCount = facultyToday.length;
  }

  const sessions = await attendance.listSessions(tenant.id, {
    date: sessionDate,
  });
  const planSessions = sessions.filter(
    (session: { timetablePlanEntryId?: string }) =>
      session.timetablePlanEntryId,
  );

  let rosterSize = 0;
  const majorSession = planSessions.find(
    (session: { metadata?: { fyugpCategory?: string } }) =>
      String(session.metadata?.fyugpCategory ?? '').toUpperCase() === 'MAJOR',
  );
  if (majorSession) {
    const roster = await attendance.roster(tenant.id, majorSession.id);
    rosterSize = roster.students.length;
  }

  console.log('\n=== Economics Sem III Attendance Test Ready ===');
  console.log(`Plan: ${ECON_SEM3_ATTENDANCE_PLAN_NAME}`);
  console.log(`Plan ID: ${result.planId}`);
  console.log(`Timetable entries: ${result.entriesCreated}`);
  console.log(`Students registered: ${result.studentsRegistered}`);
  console.log(`Registration lines: ${result.registrationLines}`);
  console.log(`Sessions generated for ${sessionDate}: ${generated.created}`);
  console.log(`Mridul Chanda sessions today: ${facultyTodayCount}`);
  console.log(`Sample major roster size: ${rosterSize}`);
  console.log('\nFaculty logins (use existing college passwords):');
  for (const faculty of result.faculty) {
    console.log(`  ${faculty.name} — ${faculty.email}`);
  }
  console.log('\nStudent sample login: eco.s3a.001@demo.edu / Student@123');
  console.log('Admin: admin@demo.edu / Admin@123');
  console.log('\nStaff attendance: /staff/academic/attendance-entry');
  console.log('Admin attendance: /admin/academics/attendance');

  await app.close();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
