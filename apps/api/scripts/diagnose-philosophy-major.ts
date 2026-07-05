import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'demo' },
    select: { id: true },
  });
  if (!tenant) {
    console.log('no demo tenant');
    return;
  }

  const phil = await prisma.academicSubject.findFirst({
    where: { tenantId: tenant.id, slug: 'philosophy' },
    select: { id: true, name: true },
  });

  const trackCount = phil
    ? await prisma.studentMajorMinorTrack.count({
        where: { tenantId: tenant.id, majorSubjectId: phil.id },
      })
    : 0;

  const anyTrack = await prisma.studentMajorMinorTrack.count({
    where: { tenantId: tenant.id },
  });

  const studentsWithTrack = await prisma.student.count({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      majorMinorTrack: { isNot: null },
    },
  });

  const total = await prisma.student.count({
    where: { tenantId: tenant.id, deletedAt: null },
  });

  const philDept = await prisma.department.findFirst({
    where: {
      tenantId: tenant.id,
      name: { contains: 'Philosophy', mode: 'insensitive' },
    },
    select: { id: true, name: true },
  });

  const byDept = philDept
    ? await prisma.student.count({
        where: {
          tenantId: tenant.id,
          deletedAt: null,
          departmentId: philDept.id,
        },
      })
    : 0;

  const philProgram = await prisma.program.findFirst({
    where: {
      tenantId: tenant.id,
      name: { contains: 'Philosophy', mode: 'insensitive' },
    },
    select: { id: true, name: true },
  });

  let byProgram = 0;
  if (philProgram) {
    const versions = await prisma.programVersion.findMany({
      where: { tenantId: tenant.id, programId: philProgram.id },
      select: { id: true },
    });
    byProgram = await prisma.student.count({
      where: {
        tenantId: tenant.id,
        deletedAt: null,
        programVersionId: { in: versions.map((v) => v.id) },
      },
    });
  }

  const majorDistribution = await prisma.studentMajorMinorTrack.groupBy({
    by: ['majorSubjectId'],
    where: { tenantId: tenant.id },
    _count: true,
    orderBy: { _count: { majorSubjectId: 'desc' } },
    take: 10,
  });

  const subjectNames = await prisma.academicSubject.findMany({
    where: {
      tenantId: tenant.id,
      id: { in: majorDistribution.map((g) => g.majorSubjectId) },
    },
    select: { id: true, name: true },
  });
  const nameMap = new Map(subjectNames.map((s) => [s.id, s.name]));

  const topMajors = majorDistribution.map((g) => ({
    major: nameMap.get(g.majorSubjectId) ?? g.majorSubjectId,
    count: g._count,
  }));

  console.log(
    JSON.stringify(
      {
        total,
        philosophySubject: phil,
        studentsViaMajorMinorTrack: trackCount,
        totalMajorMinorTrackRows: anyTrack,
        studentsWithMajorMinorTrack: studentsWithTrack,
        studentsWithoutMajorMinorTrack: total - studentsWithTrack,
        philosophyDepartment: philDept,
        studentsByDepartment: byDept,
        philosophyProgram: philProgram,
        studentsByProgramme: byProgram,
        topAssignedMajors: topMajors,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
