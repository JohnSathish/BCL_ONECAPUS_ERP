import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('demo tenant not found');

  for (const code of ['VTC-243.2', 'VTC-245.4', 'AEC-220']) {
    const course = await prisma.course.findFirst({
      where: { tenantId: tenant.id, code, deletedAt: null },
      select: {
        code: true,
        title: true,
        credits: true,
        deliveryType: true,
        theoryCredits: true,
        practicalCredits: true,
        totalContactHours: true,
      },
    });
    console.log(course);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
