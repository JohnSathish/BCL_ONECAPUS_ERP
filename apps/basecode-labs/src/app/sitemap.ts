import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/prisma';
import { listLegalDocuments } from '@/lib/legal';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? 'https://basecodelabs.com';
  const paths = [
    '',
    '/about',
    '/products',
    '/services',
    '/industries',
    '/portfolio',
    '/case-studies',
    '/testimonials',
    '/blog',
    '/contact',
    '/legal',
  ];
  const legal = await listLegalDocuments();
  const products = await prisma.product
    .findMany({ where: { status: 'PUBLISHED' }, select: { slug: true } })
    .catch(() => []);
  return [
    ...paths.map((path) => ({
      url: `${base}${path || '/'}`,
      changeFrequency: 'weekly' as const,
      priority: path === '' ? 1 : 0.7,
    })),
    ...legal.map((d) => ({
      url: `${base}/legal/${d.slug}`,
      lastModified: d.lastUpdated,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...products.map((p) => ({
      url: `${base}/products/${p.slug}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}
