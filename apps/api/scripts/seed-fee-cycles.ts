import { PrismaClient } from '@prisma/client';
import { seedDonBoscoFeeCycles } from '../prisma/seeds/fee-cycle.seed';
import { seedDonBoscoMonthlyPlans } from '../prisma/seeds/monthly-fee.seed';

async function main() {
  const prisma = new PrismaClient();
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'demo' } });
  if (!tenant) throw new Error('Demo tenant not found');
  await seedDonBoscoFeeCycles(prisma, tenant.id);
  await seedDonBoscoMonthlyPlans(prisma, tenant.id);
  await prisma.$disconnect();
  console.log('Fee seeds complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
