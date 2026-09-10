import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const payload = {
  label: 'FLASH NEWS',
  items: [
    {
      id: 'flash-xi',
      title: 'Admissions for Class XI are now open!',
      href: '/admissions',
      icon: 'admissions',
      isNew: true,
      enabled: true,
    },
    {
      id: 'flash-ptm',
      title: 'PTM on 16 September 2026',
      href: '/notices',
      icon: 'calendar',
      enabled: true,
    },
    {
      id: 'flash-exam',
      title: 'Half-Yearly Examination Schedule Released',
      href: '/examinations',
      icon: 'exam',
      enabled: true,
    },
    {
      id: 'flash-reopen',
      title: 'School Re-opens on 5 October 2026',
      href: '/notices',
      icon: 'people',
      enabled: true,
    },
  ],
};

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'st-lukes-tura' },
  });
  if (!tenant) throw new Error('st-lukes-tura missing');
  await prisma.schoolWebHomepageSection.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'flashNews' } },
    update: { payload, enabled: true, sortOrder: 15 },
    create: {
      tenantId: tenant.id,
      key: 'flashNews',
      payload,
      enabled: true,
      sortOrder: 15,
    },
  });
  console.log('Updated St. Luke’s flash news ticker');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
