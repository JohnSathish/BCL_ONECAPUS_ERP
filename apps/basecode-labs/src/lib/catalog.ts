import { prisma } from '@/lib/prisma';
import { CATALOG_PRODUCTS, CATALOG_TESTIMONIALS } from '../../prisma/catalog-content';
import { upsertCatalog } from '../../prisma/upsert-catalog';

let seedOnce: Promise<void> | null = null;

export async function ensureCatalog() {
  if (!seedOnce) {
    seedOnce = upsertCatalog(prisma).catch((err) => {
      seedOnce = null;
      console.error('[catalog] seed failed', err);
    });
  }
  await seedOnce;
}

export function fallbackProducts() {
  return CATALOG_PRODUCTS.map((p) => ({
    id: p.slug,
    ...p,
    createdAt: new Date(0),
  }));
}

export function fallbackTestimonials() {
  return CATALOG_TESTIMONIALS.map((t, i) => ({
    id: `seed-${i + 1}`,
    ...t,
  }));
}
