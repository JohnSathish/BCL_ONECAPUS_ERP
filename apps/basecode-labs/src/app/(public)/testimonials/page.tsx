import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { ensureCatalog, fallbackTestimonials } from '@/lib/catalog';
import { TestimonialsSection } from '@/components/public/testimonials-section';
import { SiteCta } from '@/components/ui/page-shell';

export const metadata: Metadata = {
  title: 'Client testimonials',
  description: 'Quotes and photographs as published on basecodelabs.com.',
};

export const dynamic = 'force-dynamic';

export default async function TestimonialsPage() {
  await ensureCatalog();
  const [dbItems, logos] = await Promise.all([
    prisma.testimonial.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.clientLogo.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { displayOrder: 'asc' },
    }),
  ]);
  const items = dbItems.length ? dbItems : fallbackTestimonials();
  return (
    <main>
      <TestimonialsSection items={items} logos={logos} />
      <SiteCta />
    </main>
  );
}
