import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found');

  const pools = await prisma.categoryPool.findMany({
    where: {
      tenantId: tenant.id,
      semesterNo: 1,
      categoryType: 'MDC',
      active: true,
    },
    include: {
      courses: {
        where: { active: true },
        include: { course: { select: { code: true, title: true } } },
        orderBy: { displayOrder: 'asc' },
      },
      offerings: {
        where: { deletedAt: null },
        include: {
          course: { select: { code: true, title: true } },
          sections: {
            where: { deletedAt: null },
            include: { seatLedger: true },
          },
        },
      },
      assignments: { where: { active: true } },
    },
    orderBy: { poolName: 'asc' },
  });

  for (const pool of pools) {
    console.log('\n===', pool.poolName, '===');
    console.log('Pool id:', pool.id);
    console.log('Programme assignments:', pool.assignments.length);
    console.log('Courses in pool:');
    for (const pc of pool.courses) {
      const offering = pool.offerings.find((o) => o.courseId === pc.courseId);
      const sections = offering?.sections ?? [];
      const enrolled = sections.reduce(
        (s, sec) => s + (sec.seatLedger?.confirmedCount ?? 0),
        0,
      );
      console.log(
        `  ${pc.course.code} — ${pc.course.title} (sections: ${sections.map((s) => s.sectionCode).join(',') || 'none'}, enrolled: ${enrolled})`,
      );
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
