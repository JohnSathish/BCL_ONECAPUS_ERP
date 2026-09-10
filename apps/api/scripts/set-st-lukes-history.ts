import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HISTORY = [
  'The Holy Cross Sisters, seeing the poor children in and around Walbakgre, decided to give free education to the smaller children. They started a pre-nursery school at Walbakgre in 2006 and continued it for two years. In the beginning, the school at Walbakgre was run by the Holy Cross Sisters.',
  'Fr. Victor Gorla was appointed the first Parish Priest of Walbakgre when it was bifurcated from Our Lady of the Rosary Parish, Araimile, in 2009. In 2010, under his care and guidance, Fr. Victor took up the same school. The school was established in 2010 and named St. Luke’s School. Fr. Victor was the first Principal. The basement of the present campus was approved in 2009, and the institution was formally inaugurated in 2010.',
  'Following the Diocese’s extension proposal in 2011, funds were secured in 2012 for construction of the first and second floors, which were completed by March 2014. The campus has grown through the generous contributions of donors, to whom the school remains grateful.',
  'Fr. Victor was transferred to St. Sebastian’s Church, Danakgre, in 2019. By then the school had reached Class 10.',
  'Rev. Fr. C.J. Jose (now Bishop Jose) took up the school as the second Principal in July 2019. Sisters of Mary Immaculate (SMI) also came to work in the school in the same year. In 2020 the first batch of Matriculation students appeared for the examination: five students, all of whom came out with a good result. When Pope Francis appointed Fr. C.J. Jose Auxiliary Bishop of Tura in February 2020, he vacated the post.',
  'Fr. Lyndoh T. Sangma came as the third Principal in 2020. The second batch of 14 students appeared for the Matriculation examination in 2021 and all were successful. In 2022, 19 students appeared; two did not succeed.',
  'Enrolment grew strongly, and the surrounding community asked for Higher Secondary classes, especially where families could not easily afford other institutions. The Diocese obtained approval from the Education Board to open Class XI. In 2026 the Higher Secondary section began. With pressure on existing classrooms, Class XI was first housed in the parish auditorium, and admissions were opened at accessible fees so that more local children could continue at St. Luke’s.',
  'Today St. Luke’s serves a school family of nearly 800 students from Nursery through Class XI. Further expansion of classrooms and sections remains necessary so the school can serve the growing demand of Walbakgre and the wider community.',
];

const ABOUT_FOUNDING =
  'The Holy Cross Sisters began a pre-nursery at Walbakgre in 2006. St. Luke’s Parish was formed in 2009, and the school was named and inaugurated as St. Luke’s School in 2010. In 2026 the Higher Secondary section opened with Class XI, and the school now serves a family of nearly 800 students.';

function blocks(paragraphs: string[]) {
  return {
    version: 1,
    blocks: paragraphs.map((text) => ({ type: 'paragraph', text })),
  };
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'st-lukes-tura' },
  });
  if (!tenant) throw new Error('st-lukes-tura missing');

  const historySeoTitle = 'History of St. Luke’s Secondary School, Tura';
  const historySeoDescription =
    'How St. Luke’s grew from a Holy Cross pre-nursery at Walbakgre in 2006 to a named school in 2010, Matriculation from 2020, and Class XI in 2026.';

  await prisma.schoolWebPage.update({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'history' } },
    data: {
      title: 'History',
      status: 'PUBLISHED',
      blockDocument: blocks(HISTORY),
      seoTitle: historySeoTitle,
      seoDescription: historySeoDescription,
      seoJson: {
        title: historySeoTitle,
        description: historySeoDescription,
        canonicalPath: '/history',
        robotsIndex: true,
        robotsFollow: true,
        schemaType: 'WebPage',
        breadcrumbTitle: 'History',
        hero: {
          enabled: true,
          eyebrow: 'OUR STORY',
          subtitle: 'From a Walbakgre pre-nursery in 2006 to Class XI in 2026.',
        },
      },
    },
  });

  const about = await prisma.schoolWebPage.findUnique({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'about' } },
  });
  if (about) {
    const doc = about.blockDocument as {
      blocks?: Array<{ type?: string; text?: string }>;
    };
    const paras = (doc.blocks ?? [])
      .map((b) => String(b.text || ''))
      .filter(Boolean);
    const next = paras.map((p) =>
      /founded in 2009|established in 2009|has grown into a community/i.test(p)
        ? ABOUT_FOUNDING
        : p,
    );
    if (!next.some((p) => p === ABOUT_FOUNDING)) {
      const aimAt = next.findIndex(
        (p) => /\baim\b/i.test(p) && /handbook|personality|noblest/i.test(p),
      );
      next.splice(aimAt >= 0 ? aimAt : next.length, 0, ABOUT_FOUNDING);
    }
    await prisma.schoolWebPage.update({
      where: { id: about.id },
      data: { blockDocument: blocks(next) },
    });
  }

  const pillars = await prisma.schoolWebHomepageSection.findUnique({
    where: { tenantId_key: { tenantId: tenant.id, key: 'pillars' } },
  });
  if (
    pillars &&
    pillars.payload &&
    typeof pillars.payload === 'object' &&
    !Array.isArray(pillars.payload)
  ) {
    const payload = pillars.payload as {
      items?: Array<{ n?: string; title?: string }>;
    };
    const items = (payload.items ?? []).map((item) =>
      item.n === '2009' ? { ...item, title: 'Parish at Walbakgre' } : item,
    );
    await prisma.schoolWebHomepageSection.update({
      where: { id: pillars.id },
      data: { payload: { ...payload, items } },
    });
  }

  console.log('Updated St. Luke’s history and related founding copy');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
