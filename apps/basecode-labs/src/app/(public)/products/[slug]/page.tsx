import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHero, SiteCta } from '@/components/ui/page-shell';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) return { title: 'Product' };
  return { title: product.name, description: product.description };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product || product.status !== 'PUBLISHED') notFound();
  const features = JSON.parse(product.featuresJson) as string[];
  return (
    <main>
      <PageHero eyebrow={product.category} title={product.name} description={product.description}>
        <Link href="/contact" className="bcl-btn bcl-btn-primary">
          Discuss this product
        </Link>
      </PageHero>
      <div className="bcl-container py-12">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Code', product.code],
            ['Version', product.version],
            ['Platform', product.platform ?? '—'],
            ['License type', product.licenseType ?? '—'],
          ].map(([label, value]) => (
            <div key={label} className="bcl-card p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="mt-1 font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
        <h2 className="mt-10 text-xl font-semibold">Capabilities</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {features.map((f) => (
            <li key={f} className="bcl-card px-4 py-3 text-sm">
              {f}
            </li>
          ))}
        </ul>
      </div>
      <SiteCta title="Need this for your campus?" />
    </main>
  );
}
