import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PARAGRAPHS = [
  'This Privacy Policy is for St. Luke’s Secondary School, Walbakgre, P.O. Dakopgre, Tura – 794101, West Garo Hills, Meghalaya, India. It covers https://stlukestura.in, the school ERP at https://erp.stlukestura.in, and the official St. Luke’s School app (Android package in.stlukestura.school).',
  'The School is the data controller. BaseCode Labs Pvt. Ltd. hosts the software as a processor. Last updated: 19 September 2026. The full public text is always at https://stlukestura.in/privacy-policy.',
  'The app is only for people the School has given an account. We collect login and profile details, device and push-notification tokens, messages, and limited website logs. We use this to run the school app and website, not to sell data or show third-party ads.',
  'Push alerts use Firebase Cloud Messaging (Google LLC). Face ID or fingerprint stay on the phone. You may email admin@stlukestura.in with the subject “Delete my St. Luke’s School app account” to disable mobile access.',
  'Pupil records are processed by the School as an educational institution. We do not sell children’s information or use it for advertising.',
];

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'st-lukes-tura' },
  });
  if (!tenant) throw new Error('st-lukes-tura missing');
  const seoTitle = 'Privacy Policy | St. Luke’s Secondary School, Tura';
  const seoDescription =
    'How St. Luke’s Secondary School, Tura collects, uses, shares and protects information in the school website and St. Luke’s School app.';
  await prisma.schoolWebPage.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: 'privacy-policy' } },
    update: {
      title: 'Privacy Policy',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      blockDocument: {
        version: 1,
        blocks: PARAGRAPHS.map((text) => ({ type: 'paragraph', text })),
      },
      seoTitle,
      seoDescription,
      seoJson: {
        title: seoTitle,
        description: seoDescription,
        canonicalPath: '/privacy-policy',
        robotsIndex: true,
        robotsFollow: true,
        schemaType: 'WebPage',
        breadcrumbTitle: 'Privacy Policy',
        hero: {
          enabled: true,
          eyebrow: 'PRIVACY',
          subtitle: 'How the school app and website use information.',
        },
      },
    },
    create: {
      tenantId: tenant.id,
      slug: 'privacy-policy',
      title: 'Privacy Policy',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      blockDocument: {
        version: 1,
        blocks: PARAGRAPHS.map((text) => ({ type: 'paragraph', text })),
      },
      seoTitle,
      seoDescription,
      seoJson: {
        title: seoTitle,
        description: seoDescription,
        canonicalPath: '/privacy-policy',
        robotsIndex: true,
        robotsFollow: true,
        schemaType: 'WebPage',
        breadcrumbTitle: 'Privacy Policy',
      },
    },
  });
  console.log('Published St. Luke’s privacy policy page');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
