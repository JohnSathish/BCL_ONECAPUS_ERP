import { prisma } from '@/lib/prisma';
import { TestimonialsDesk } from '@/components/admin/testimonials-desk';

export default async function TestimonialsAdminPage() {
  const items = await prisma.testimonial.findMany({ orderBy: { displayOrder: 'asc' } });
  return (
    <TestimonialsDesk
      items={items.map((t) => ({
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
      }))}
    />
  );
}
