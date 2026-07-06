import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const invalid = await prisma.courseOffering.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      category: { equals: 'MINOR', mode: 'insensitive' },
      course: { code: { endsWith: '-303' } },
    },
    include: {
      course: { select: { code: true, title: true } },
      programVersion: { include: { program: { select: { code: true } } } },
    },
    orderBy: { course: { code: 'asc' } },
  });

  console.log(
    `Invalid MINOR mappings on *-303 internship courses: ${invalid.length}\n`,
  );
  for (const o of invalid) {
    console.log(`${o.course.code} @ ${o.programVersion.program.code}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
