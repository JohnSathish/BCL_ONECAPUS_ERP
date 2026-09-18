import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/staff';

const schema = z.object({
  organisation: z.string().min(2).optional(),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  institutionType: z.string().optional(),
  website: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const { id } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid client update' }, { status: 400 });
  const { email, ...rest } = parsed.data;
  const client = await prisma.client.update({
    where: { id },
    data: { ...rest, ...(email !== undefined ? { email: email || null } : {}) },
  });
  return NextResponse.json({ client });
}
