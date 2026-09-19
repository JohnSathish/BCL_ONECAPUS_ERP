import type { PrismaClient } from '@prisma/client';
import { CATALOG_PRODUCTS, CATALOG_TESTIMONIALS } from './catalog-content';

/** Create missing catalog rows. Existing admin edits are left in place. */
export async function upsertCatalog(prisma: PrismaClient) {
  for (const product of CATALOG_PRODUCTS) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      create: product,
      update: {},
    });
  }

  for (const quote of CATALOG_TESTIMONIALS) {
    const existing = await prisma.testimonial.findFirst({
      where: { name: quote.name, organisation: quote.organisation },
    });
    if (existing) continue;
    await prisma.testimonial.create({ data: quote });
  }

  for (const [index, quote] of CATALOG_TESTIMONIALS.entries()) {
    const name = quote.organisation.split(',')[0];
    const existing = await prisma.clientLogo.findFirst({ where: { name } });
    if (existing) continue;
    await prisma.clientLogo.create({
      data: {
        name,
        website: quote.website,
        industry: quote.industry,
        displayOrder: index,
        status: 'PUBLISHED',
      },
    });
  }
}
