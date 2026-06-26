import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found');

  const artsPools = await prisma.categoryPool.findMany({
    where: {
      tenantId: tenant.id,
      poolName: { startsWith: 'Arts ' },
      active: true,
    },
    select: { id: true, poolName: true },
  });

  for (const pool of artsPools) {
    const regCount = await prisma.semesterRegistrationLine.count({
      where: {
        offering: { categoryPoolId: pool.id, deletedAt: null },
        status: { in: ['confirmed', 'pending', 'waitlisted'] },
      },
    });
    const offeringCount = await prisma.courseOffering.count({
      where: { categoryPoolId: pool.id, deletedAt: null },
    });
    console.log(
      `${pool.poolName}: offerings=${offeringCount} active_regs=${regCount}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
