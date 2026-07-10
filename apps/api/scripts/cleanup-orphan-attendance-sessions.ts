/**
 * Soft-delete duplicate attendance sessions for a tenant/date.
 * Keeps the best session per slot (timetable-linked > marked > most entries).
 *
 * Run: npx ts-node --transpile-only scripts/cleanup-orphan-attendance-sessions.ts
 */
import { NestFactory } from '@nestjs/core';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { StudentAttendanceService } from '../src/modules/student-attendance/student-attendance.service';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';

const prisma = new PrismaClient();

function localDateString(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found');

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'admin@demo.edu' },
  });
  if (!admin) throw new Error('Admin user not found');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const attendance = app.get(StudentAttendanceService);

  const user: JwtUser = {
    sub: admin.id,
    tid: tenant.id,
    email: admin.email,
    roles: [],
    permissions: ['*'],
  };

  const date = localDateString();
  const result = await attendance.generateFromTimetable(user, { date });

  const staff = await prisma.staffProfile.findFirst({
    where: {
      tenantId: tenant.id,
      portalUser: { email: 'mridul.chanda77@gmail.com' },
    },
  });

  let facultyCount = 0;
  if (staff) {
    const facultyUser: JwtUser = {
      sub: staff.portalUserId!,
      tid: tenant.id,
      email: 'mridul.chanda77@gmail.com',
      roles: [],
      permissions: ['attendance.write'],
    };
    const facultyToday = await attendance.facultyToday(facultyUser);
    facultyCount = facultyToday.length;
    console.log('\nMridul sessions after cleanup:');
    for (const session of facultyToday) {
      console.log({
        period: session.periodNo,
        paper: session.paperCourse?.code,
        group: session.subjectGroup?.code ?? session.course?.code,
        status: session.status,
        marked: session.counts?.total,
        roster: session.rosterSize,
        linked: session.timetableLinked,
      });
    }
  }

  console.log('\n=== Attendance session cleanup ===');
  console.log(`Date: ${date}`);
  console.log(`Considered timetable entries: ${result.considered}`);
  console.log(`Deduped entries: ${result.deduped}`);
  console.log(`Sessions upserted: ${result.created}`);
  console.log(`Duplicates removed: ${result.removedDuplicates}`);
  console.log(`Mridul faculty-today count: ${facultyCount}`);

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
