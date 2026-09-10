import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'st-lukes-tura' },
  });
  if (!tenant) throw new Error('st-lukes-tura missing');
  const site = await prisma.schoolWebSite.findUnique({
    where: { tenantId: tenant.id },
  });
  if (!site) throw new Error('school website not seeded');
  const extras =
    site.extrasJson &&
    typeof site.extrasJson === 'object' &&
    !Array.isArray(site.extrasJson)
      ? (site.extrasJson as Record<string, unknown>)
      : {};
  await prisma.schoolWebSite.update({
    where: { tenantId: tenant.id },
    data: {
      email: 'admin@stlukestura.in',
      extrasJson: {
        ...extras,
        contactNote: 'Phone will be published when the school confirms it.',
      },
    },
  });
  console.log('Set St. Luke’s office email to admin@stlukestura.in');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
