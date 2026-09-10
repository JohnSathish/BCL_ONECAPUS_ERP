import { PrismaClient } from '@prisma/client';
import { seedStLukesWebsite } from '../prisma/seeds/seed-st-lukes-website';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'st-lukes-tura' },
  });
  if (!tenant) throw new Error('st-lukes-tura missing');
  await seedStLukesWebsite(prisma, tenant.id);
  await prisma.tenantDomain.upsert({
    where: { host: 'school.localhost' },
    update: { tenantId: tenant.id, verified: true, deletedAt: null },
    create: { tenantId: tenant.id, host: 'school.localhost', verified: true },
  });
  console.log('Seeded St. Luke’s website CMS and school.localhost host');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
