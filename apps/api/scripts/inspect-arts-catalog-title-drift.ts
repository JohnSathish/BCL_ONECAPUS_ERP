import { PrismaClient } from '@prisma/client';
import { buildArtsFyugpOddCourses } from '../src/modules/academic-engine/domain/arts-fyugp-odd-catalog';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found');

  const seedByCode = new Map(
    buildArtsFyugpOddCourses()
      .filter((c) => !c.sharedPool && c.programCode)
      .map((c) => [c.code, c.title]),
  );

  const codes = [...seedByCode.keys()];
  const courses = await prisma.course.findMany({
    where: { tenantId: tenant.id, deletedAt: null, code: { in: codes } },
    select: { code: true, title: true, updatedAt: true },
    orderBy: { code: 'asc' },
  });

  let match = 0;
  let mismatch = 0;
  for (const c of courses) {
    const seedTitle = seedByCode.get(c.code)!;
    if (c.title === seedTitle) {
      match += 1;
    } else {
      mismatch += 1;
      console.log(`CUSTOM  ${c.code} | DB: ${c.title} | seed: ${seedTitle}`);
    }
  }
  console.log(`\nArts major/minor direct courses: ${courses.length}`);
  console.log(`Match seed template: ${match}`);
  console.log(`Custom/different title: ${mismatch}`);
  if (courses.length) {
    const latest = courses.reduce((a, b) =>
      a.updatedAt > b.updatedAt ? a : b,
    );
    console.log(
      `Latest update among arts catalog codes: ${latest.updatedAt.toISOString()} (${latest.code})`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
