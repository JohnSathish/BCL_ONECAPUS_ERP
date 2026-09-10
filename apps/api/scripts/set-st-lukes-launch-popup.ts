import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: 'st-lukes-tura' },
  });
  if (!tenant) throw new Error('st-lukes-tura tenant not found');
  await prisma.schoolWebHomepageSection.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: 'launchPopup' } },
    create: {
      tenantId: tenant.id,
      key: 'launchPopup',
      enabled: true,
      sortOrder: 5,
      payload: {
        kicker: 'COMING SOON',
        title: "A New Digital Home for St. Luke's Secondary School",
        description:
          'We are preparing something special for our students, parents, teachers and school community. Our new website will bring you school news, events, notices, academic information, photo galleries, admissions updates and much more.',
        footerLine: "St. Luke's Secondary School",
        locationLine: 'Walbakgre, Tura, Meghalaya',
        launchingLabel: 'Launching Soon.',
        logoUrl: '/school-sis/st-lukes-logo.png',
        imageUrl: '/school-sis/slider/sl5.jpg',
        imageAlt: "St. Luke's Secondary School campus, Walbakgre",
        ctaLabel: 'Explore Our Website',
        ctaHref: '/',
        ctaStyle: 'gold',
        frequency: 'session',
        animation: 'fade-scale',
        closeButton: true,
      },
    },
    update: { enabled: true },
  });
  console.log('St. Luke’s coming soon popup is on');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
