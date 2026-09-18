import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/staff';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const { id } = await params;
  const body = await req.json();
  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(body.name ? { name: String(body.name) } : {}),
      ...(body.code ? { code: String(body.code).toUpperCase().slice(0, 6) } : {}),
      ...(body.category ? { category: String(body.category) } : {}),
      ...(body.description !== undefined ? { description: String(body.description) } : {}),
      ...(body.features ? { featuresJson: JSON.stringify(body.features) } : {}),
      ...(body.status ? { status: String(body.status) } : {}),
    },
  });
  return NextResponse.json({ product });
}
