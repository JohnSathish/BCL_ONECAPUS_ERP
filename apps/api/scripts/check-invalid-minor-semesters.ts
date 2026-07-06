import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const VALID_MINOR_SEMESTERS = new Set([2, 5]);

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  const invalid = await prisma.courseOffering.findMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      category: { equals: 'MINOR', mode: 'insensitive' },
      semesterSequence: { notIn: [...VALID_MINOR_SEMESTERS] },
    },
    include: {
      course: { select: { code: true, title: true } },
      programVersion: { include: { program: { select: { code: true } } } },
    },
    orderBy: [{ semesterSequence: 'asc' }, { course: { code: 'asc' } }],
  });

  console.log(`Invalid MINOR offerings (not Sem 2/5): ${invalid.length}\n`);
  for (const o of invalid) {
    console.log(
      `${o.programVersion.program.code} | sem=${o.semesterSequence} | ${o.course.code} | ${o.mappingSource} | ${o.createdAt.toISOString().slice(0, 10)}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
