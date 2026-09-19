import { prisma } from '@/lib/prisma';
import { ensureCatalog, fallbackTestimonials } from '@/lib/catalog';
import { TestimonialsDesk } from '@/components/admin/testimonials-desk';

export const dynamic = 'force-dynamic';

export default async function TestimonialsAdminPage() {
  await ensureCatalog();
  const rows = await prisma.testimonial.findMany({ orderBy: { displayOrder: 'asc' } });
  const items = (rows.length ? rows : fallbackTestimonials()).map((t) => ({
    id: t.id,
    name: t.name,
    designation: t.designation,
    organisation: t.organisation,
    quote: t.quote,
    photo: t.photo,
    rating: t.rating,
    project: t.project,
    industry: t.industry,
    website: t.website,
    featured: t.featured,
    displayOrder: t.displayOrder,
    status: t.status,
  }));
  return <TestimonialsDesk items={items} />;
}
