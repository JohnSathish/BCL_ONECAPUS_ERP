import { prisma } from '@/lib/prisma';
import { ProductsDesk } from '@/components/admin/products-desk';

function parseFeatures(json: string | null) {
  try {
    const v = JSON.parse(json || '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export default async function ProductsAdminPage() {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const [products, views] = await Promise.all([
    prisma.product.findMany({ orderBy: { displayOrder: 'asc' } }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: since }, path: { contains: '/products' } },
      select: { path: true },
    }),
  ]);
  const bySlug = new Map<string, number>();
  for (const v of views) {
    const slug = products.find((p) => v.path.includes(`/products/${p.slug}`))?.slug;
    if (!slug) continue;
    bySlug.set(slug, (bySlug.get(slug) ?? 0) + 1);
  }
  return (
    <ProductsDesk
      pageViewsMonth={views.length}
      products={products.map((p) => ({
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
