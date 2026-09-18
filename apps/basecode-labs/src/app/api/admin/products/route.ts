import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/staff';

export async function GET() {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const products = await prisma.product.findMany({ orderBy: { displayOrder: 'asc' } });
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const body = await req.json();
  const slug = String(body.slug ?? body.name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const product = await prisma.product.create({
    data: {
      name: String(body.name),
      slug,
      code: String(body.code ?? 'PRD')
        .toUpperCase()
        .slice(0, 6),
      description: String(body.description ?? ''),
      category: String(body.category ?? 'Service'),
      featuresJson: JSON.stringify(body.features ?? []),
      status: String(body.status ?? 'PUBLISHED'),
    },
  });
  return NextResponse.json({ product });
}
