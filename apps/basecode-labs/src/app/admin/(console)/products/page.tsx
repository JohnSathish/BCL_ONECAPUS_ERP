import { prisma } from '@/lib/prisma';
import { ensureCatalog, fallbackProducts } from '@/lib/catalog';
import { ProductsDesk } from '@/components/admin/products-desk';

export const dynamic = 'force-dynamic';

function parseFeatures(json: string | null) {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export default async function ProductsAdminPage() {
  await ensureCatalog();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const dbProducts = await prisma.product.findMany({ orderBy: { displayOrder: 'asc' } });
  const source = dbProducts.length ? dbProducts : fallbackProducts();
  const views = await prisma.pageView.findMany({
    where: { createdAt: { gte: since }, path: { contains: '/products' } },
    select: { path: true },
  });
  const bySlug = new Map<string, number>();
  for (const v of views) {
    const slug = source.find((p) => v.path.includes(`/products/${p.slug}`))?.slug;
    if (!slug) continue;
    bySlug.set(slug, (bySlug.get(slug) ?? 0) + 1);
  }
  return (
    <ProductsDesk
      pageViewsMonth={views.length}
      products={source.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        code: p.code,
        category: p.category,
        description: p.description,
        features: parseFeatures(p.featuresJson),
        status: p.status,
        updatedAt: p.createdAt.toISOString(),
        views: bySlug.get(p.slug) ?? 0,
      }))}
    />
  );
}
