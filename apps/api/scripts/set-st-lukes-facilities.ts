import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PARAGRAPHS = [
  'Taekwondo Coaching (St. Luke’s Taekwondo Academy). Football Coaching (St. Luke’s Football Academy). Basketball Coaching (St. Luke’s Basketball Academy). Dance Class (St. Luke’s Dance Academy).',
  'Library, Class Rooms, Football Field, Basket Ball Court, Childrens’ Park, Playroom for Kindergarten, Drinking water facilities, Auditorium, Taekwondo coaching room, Sports items, Digital classroom, and Computer facilities.',
];

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'st-lukes-tura' },
  });
  if (!tenant) throw new Error('st-lukes-tura missing');
  const seoTitle =
    'Facilities Available at School | St. Luke’s Secondary School, Tura';
  const seoDescription =
    'Facilities available at St. Luke’s Secondary School, Tura: Taekwondo, Football, Basketball and Dance academies, plus library, class rooms, grounds, auditorium, digital classroom and computer facilities.';
  await prisma.schoolWebPage.update({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'facilities' } },
    data: {
      title: 'Facilities Available at School',
      status: 'PUBLISHED',
      blockDocument: {
        version: 1,
        blocks: PARAGRAPHS.map((text) => ({ type: 'paragraph', text })),
      },
      seoTitle,
      seoDescription,
      seoJson: {
        title: seoTitle,
        description: seoDescription,
        canonicalPath: '/facilities',
        robotsIndex: true,
        robotsFollow: true,
        schemaType: 'WebPage',
        breadcrumbTitle: 'Facilities',
        hero: {
          enabled: true,
          eyebrow: 'FACILITIES',
          subtitle: 'Academies, classrooms, grounds and campus amenities.',
        },
      },
    },
  });
  console.log('Updated St. Luke’s facilities page');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
