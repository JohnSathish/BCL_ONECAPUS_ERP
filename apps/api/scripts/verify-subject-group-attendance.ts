/**
 * Smoke test: subject-group timetable → attendance sessions → roster → mark.
 *   npx ts-node --transpile-only scripts/verify-subject-group-attendance.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { StudentAttendanceService } from '../src/modules/student-attendance/student-attendance.service';
import type { JwtUser } from '../src/common/decorators/current-user.decorator';

const TENANT_SLUG = 'demo';
const SESSION_DATE = '2026-06-17'; // Wednesday (Sem 3 slots)

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
      name: { contains: 'Shift II' },
      deletedAt: null,
    },
  });
  if (!plan) throw new Error('Shift II plan missing');

  const wednesdayEntries = await prisma.timetablePlanEntry.count({
    where: {
      tenantId: tenant.id,
      planId: plan.id,
      deletedAt: null,
      dayOfWeek: 3,
      teachingSubjectGroupId: { not: null },
    },
  });
  console.log(
    `Plan ${plan.id}: ${wednesdayEntries} Wednesday entries with subject groups`,
  );

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

  if (roster.students.length) {
    await attendance.markSession(user, sample.id, {
      entries: [{ studentId: roster.students[0].id, status: 'P' }],
    });
    console.log('Mark attendance OK');
  } else {
    console.warn(
      'WARN: roster empty — check offering sections on subject groups',
    );
  }

  console.log('Smoke test passed');
  await app.close();
}

main().catch((error) => {
  console.error('Smoke test failed:', error);
  process.exit(1);
});
