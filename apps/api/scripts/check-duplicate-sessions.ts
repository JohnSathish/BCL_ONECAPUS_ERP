import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const staff = await prisma.staffProfile.findFirst({
    where: {
      tenantId: tenant.id,
      portalUser: { email: 'mridul.chanda77@gmail.com' },
    },
  });
  if (!staff) throw new Error('Mridul staff not found');

  const dayStart = new Date('2026-07-09T00:00:00');
  const sessions = await (prisma as any).studentAttendanceSession.findMany({
    where: {
      tenantId: tenant.id,
      sessionDate: dayStart,
      primaryFacultyId: staff.id,
      deletedAt: null,
    },
    orderBy: [{ periodNo: 'asc' }, { createdAt: 'asc' }],
  });

  console.log(`Sessions for Mridul on 2026-07-09: ${sessions.length}\n`);

  for (const s of sessions) {
    const course = s.courseId
      ? await prisma.course.findFirst({
          where: { id: s.courseId },
          select: { code: true, title: true },
        })
      : null;
    const group = s.teachingSubjectGroupId
      ? await (prisma as any).teachingSubjectGroup.findFirst({
          where: { id: s.teachingSubjectGroupId },
          select: { code: true, title: true },
        })
      : null;
    const entry = s.timetablePlanEntryId
      ? await prisma.timetablePlanEntry.findFirst({
          where: { id: s.timetablePlanEntryId },
          select: { planId: true, periodNo: true, dayOfWeek: true },
        })
      : null;
    const plan = entry?.planId
      ? await prisma.timetablePlan.findFirst({
          where: { id: entry.planId },
          select: { name: true },
        })
      : null;
    const entryCount = await (prisma as any).studentAttendanceEntry.count({
      where: { sessionId: s.id },
    });

    console.log({
      id: s.id.slice(0, 8),
      period: s.periodNo,
      status: s.status,
      course: course?.code,
      group: group?.code,
      groupTitle: group?.title,
      plan: plan?.name,
      entryDay: entry?.dayOfWeek,
      marked: entryCount,
    });
  }

  const allToday = await (prisma as any).studentAttendanceSession.findMany({
    where: {
      tenantId: tenant.id,
      sessionDate: dayStart,
      teachingSubjectGroupId: sessions[0]?.teachingSubjectGroupId,
      deletedAt: null,
    },
    select: {
      id: true,
      periodNo: true,
      primaryFacultyId: true,
      courseId: true,
      timetablePlanEntryId: true,
      status: true,
    },
    orderBy: [{ periodNo: 'asc' }],
  });
  console.log(`\nAll major-group sessions today: ${allToday.length}`);
  for (const s of allToday) {
    const course = s.courseId
      ? await prisma.course.findFirst({
          where: { id: s.courseId },
          select: { code: true },
        })
      : null;
    console.log({
      id: s.id.slice(0, 8),
      period: s.periodNo,
      course: course?.code,
      faculty:
        s.primaryFacultyId === staff?.id
          ? 'mridul'
          : s.primaryFacultyId?.slice(0, 8),
      linked: Boolean(s.timetablePlanEntryId),
      status: s.status,
    });
  }
  const thursday = 4;
  const entries = await prisma.timetablePlanEntry.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      dayOfWeek: thursday,
      periodNo: 1,
      courseId: sessions[0]?.courseId ?? undefined,
    },
    include: { plan: { select: { name: true, status: true } } },
  });
  console.log(`\nTimetable plan entries (Thu P1, ECO-200): ${entries.length}`);
  for (const e of entries) {
    const faculty = e.staffProfileId
      ? await prisma.staffProfile.findFirst({
          where: { id: e.staffProfileId },
          select: { fullName: true },
        })
      : null;
    console.log({
      plan: e.plan?.name,
      planStatus: e.plan?.status,
      faculty: faculty?.fullName,
      groupId: e.teachingSubjectGroupId?.slice(0, 8),
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
