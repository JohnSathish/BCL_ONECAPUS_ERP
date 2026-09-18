import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/staff';

function payload(body: Record<string, unknown>) {
  const rating = Math.min(5, Math.max(1, Number(body.rating ?? 5) || 5));
  return {
    name: String(body.name ?? '').trim(),
    designation: String(body.designation ?? '').trim(),
    organisation: String(body.organisation ?? '').trim(),
    quote: String(body.quote ?? '').trim(),
    photo: body.photo ? String(body.photo) : null,
    rating,
    project: body.project ? String(body.project) : null,
    industry: body.industry ? String(body.industry) : null,
    website: body.website ? String(body.website) : null,
    featured: Boolean(body.featured),
    status: String(body.status ?? 'PUBLISHED'),
    displayOrder: Number(body.displayOrder ?? 0) || 0,
  };
}

export async function GET() {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const testimonials = await prisma.testimonial.findMany({ orderBy: { displayOrder: 'asc' } });
  return NextResponse.json({ testimonials });
}

export async function POST(req: NextRequest) {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const body = await req.json();
  const data = payload(body);
  if (!data.name || !data.organisation || !data.quote) {
    return NextResponse.json(
      { error: 'Name, organisation and quote are required' },
      { status: 400 },
    );
  }
  const max = await prisma.testimonial.aggregate({ _max: { displayOrder: true } });
  const testimonial = await prisma.testimonial.create({
    data: { ...data, displayOrder: data.displayOrder || (max._max.displayOrder ?? 0) + 1 },
  });
  return NextResponse.json({ testimonial });
}
