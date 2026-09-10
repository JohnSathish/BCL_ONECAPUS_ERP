import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SLIDES = [
  {
    enabled: true,
    kicker: 'PARENTS’ DAY & SCHOOL DAY',
    title: 'A school family, gathered.',
    text: 'Photographs from Parents’ Day cum School Day at St. Luke’s Secondary School, Walbakgre.',
    image: '/school-sis/slider/sl1.jpg',
    ctaLabel: 'Student life',
    ctaHref: '/student-life',
  },
  {
    enabled: true,
    kicker: 'ST. LUKE’S, TURA',
    title: 'Knowledge · Service · Light',
    text: 'A Catholic school of St. Luke’s Parish, Diocese of Tura, educating children at Walbakgre since 2009.',
    image: '/school-sis/slider/sl2.jpg',
    ctaLabel: 'About the School',
    ctaHref: '/about',
  },
  {
    enabled: true,
    kicker: 'HIGHER SECONDARY',
    title: 'Class XI opened in 2026.',
    text: 'The school now offers the Higher Secondary section, with nearly 800 students from Nursery through Class XI.',
    image: '/school-sis/slider/sl3.jpg',
    ctaLabel: 'Academics',
    ctaHref: '/academics',
  },
  {
    enabled: true,
    kicker: 'ADMISSIONS',
    title: 'Begin the journey at St. Luke’s.',
    text: 'New admissions are made mainly to Nursery. Other classes depend on vacant seats. Visit the office during school hours.',
    image: '/school-sis/slider/sl4.jpg',
    ctaLabel: 'Admission information',
    ctaHref: '/admissions',
  },
  {
    enabled: true,
    kicker: 'OUR CAMPUS',
    title: 'St. Luke’s Secondary School, Walbakgre.',
    text: 'The school family gathered at the campus entrance, Walbakgre, Tura.',
    image: '/school-sis/slider/sl5.jpg',
    ctaLabel: 'About the School',
    ctaHref: '/about',
  },
];

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'st-lukes-tura' },
  });
  if (!tenant) throw new Error('st-lukes-tura missing');
  const row = await prisma.schoolWebHomepageSection.findUnique({
    where: { tenantId_key: { tenantId: tenant.id, key: 'hero' } },
  });
  if (!row) throw new Error('hero homepage section missing');
  const payload = (
    row.payload && typeof row.payload === 'object' ? row.payload : {}
  ) as Record<string, unknown>;
  await prisma.schoolWebHomepageSection.update({
    where: { id: row.id },
    data: { payload: { ...payload, slides: SLIDES } },
  });
  console.log('Updated St. Luke’s homepage slider with 5 campus photos');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
