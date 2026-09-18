import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { TestimonialsSection } from '@/components/public/testimonials-section';
import { SiteCta } from '@/components/ui/page-shell';

export const metadata: Metadata = {
  title: 'Client testimonials',
  description: 'Quotes and photographs as published on basecodelabs.com.',
};

export default async function TestimonialsPage() {
  const [items, logos] = await Promise.all([
    prisma.testimonial.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { displayOrder: 'asc' },
    }),
    prisma.clientLogo.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { displayOrder: 'asc' },
    }),
  ]);
  return (
    <main>
      <TestimonialsSection items={items} logos={logos} />
      <SiteCta />
    </main>
  );
}
