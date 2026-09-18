import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/staff';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const { id } = await params;
  const body = await req.json();
  const testimonial = await prisma.testimonial.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: String(body.name) } : {}),
      ...(body.designation !== undefined ? { designation: String(body.designation) } : {}),
      ...(body.organisation !== undefined ? { organisation: String(body.organisation) } : {}),
      ...(body.quote !== undefined ? { quote: String(body.quote) } : {}),
      ...(body.photo !== undefined ? { photo: body.photo ? String(body.photo) : null } : {}),
      ...(body.rating !== undefined
        ? { rating: Math.min(5, Math.max(1, Number(body.rating) || 5)) }
        : {}),
      ...(body.project !== undefined
        ? { project: body.project ? String(body.project) : null }
        : {}),
      ...(body.industry !== undefined
        ? { industry: body.industry ? String(body.industry) : null }
        : {}),
      ...(body.website !== undefined
        ? { website: body.website ? String(body.website) : null }
        : {}),
      ...(body.featured !== undefined ? { featured: Boolean(body.featured) } : {}),
      ...(body.status !== undefined ? { status: String(body.status) } : {}),
      ...(body.displayOrder !== undefined ? { displayOrder: Number(body.displayOrder) || 0 } : {}),
    },
  });
  return NextResponse.json({ testimonial });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const { id } = await params;
  await prisma.testimonial.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
