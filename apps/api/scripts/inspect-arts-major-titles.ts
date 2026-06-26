import { PrismaClient } from '@prisma/client';
import { buildArtsFyugpOddCourses } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found');

  const seedTitles = new Map(
    buildArtsFyugpOddCourses()
      .filter((c) => !c.sharedPool)
      .map((c) => [c.code, c.title]),
  );

  const courses = await prisma.course.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      code: { endsWith: '-100' },
    },
    select: {
      code: true,
      title: true,
      updatedAt: true,
      department: { select: { code: true } },
    },
    orderBy: { code: 'asc' },
  });

  console.log('Code | DB Title | Seed Title | Match | Dept | Updated');
  for (const c of courses) {
    const seedTitle = seedTitles.get(c.code) ?? '(not in seed)';
    const match = seedTitle === c.title ? 'YES' : 'NO';
    console.log(
      `${c.code} | ${c.title} | ${seedTitle} | ${match} | ${c.department?.code ?? '-'} | ${c.updatedAt.toISOString()}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
