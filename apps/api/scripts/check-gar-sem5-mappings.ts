import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  for (const code of ['ECO-303', 'GAR-302', 'GAR-303']) {
    const course = await prisma.course.findFirst({
      where: { tenantId: tenant.id, code, deletedAt: null },
    });
    if (!course) continue;
    const offerings = await prisma.courseOffering.findMany({
      where: { tenantId: tenant.id, courseId: course.id, deletedAt: null },
      include: { programVersion: { include: { program: true } } },
    });
    console.log(`\n${code}:`);
    for (const o of offerings) {
      console.log(`  ${o.programVersion.program.code} · ${o.category}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
