import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found');

  const pools = await prisma.categoryPool.findMany({
    where: { tenantId: tenant.id, active: true, semesterNo: { in: [1, 3] } },
    include: {
      courses: {
        where: { active: true },
        include: { course: { select: { code: true } } },
      },
      assignments: {
        where: { active: true },
        select: { programVersionId: true },
      },
      offerings: {
        where: { deletedAt: null },
        select: { id: true, courseId: true },
      },
    },
    orderBy: [
      { semesterNo: 'asc' },
      { categoryType: 'asc' },
      { poolName: 'asc' },
    ],
  });

  const byKey = new Map<string, typeof pools>();
  for (const p of pools) {
    const key = `${p.semesterNo}:${p.categoryType}`;
    const list = byKey.get(key) ?? [];
    list.push(p);
    byKey.set(key, list);
  }

  for (const [key, list] of byKey) {
    if (list.length <= 1) continue;
    console.log(`\n--- DUPLICATE ${key} ---`);
    for (const p of list) {
      const codes = p.courses
        .map((c) => c.course.code)
        .sort()
        .join(', ');
      console.log(
        `  ${p.poolName} (${p.id.slice(0, 8)}…) courses=${p.courses.length} offerings=${p.offerings.length} assignments=${p.assignments.length}`,
      );
      console.log(`    ${codes}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
