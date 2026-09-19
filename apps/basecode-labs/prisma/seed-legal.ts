import { PrismaClient } from '@prisma/client';
import { LEGAL_SEEDS } from './legal-content';

const prisma = new PrismaClient();

async function main() {
  const publishedAt = new Date('2026-09-18T00:00:00.000Z');
  for (const policy of LEGAL_SEEDS) {
    const doc = await prisma.legalDocument.upsert({
      where: { slug: policy.slug },
      create: {
        slug: policy.slug,
        title: policy.title,
        shortDescription: policy.shortDescription,
        icon: policy.icon,
        version: '1.0',
        status: 'PUBLISHED',
        effectiveDate: publishedAt,
        lastUpdated: publishedAt,
        contentHtml: policy.contentHtml,
        displayOrder: policy.displayOrder,
      },
      update: {
        title: policy.title,
        shortDescription: policy.shortDescription,
        icon: policy.icon,
        status: 'PUBLISHED',
        contentHtml: policy.contentHtml,
        displayOrder: policy.displayOrder,
        lastUpdated: publishedAt,
      },
    });
    const versionCount = await prisma.legalDocumentVersion.count({
      where: { documentId: doc.id, version: '1.0' },
    });
    if (!versionCount) {
      await prisma.legalDocumentVersion.create({
        data: {
          documentId: doc.id,
          version: '1.0',
          contentHtml: policy.contentHtml,
          changeSummary: policy.changeSummary,
          publishedBy: 'BaseCode Labs Pvt. Ltd.',
          publishedAt,
        },
      });
    }
    console.log('upserted', policy.slug);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
