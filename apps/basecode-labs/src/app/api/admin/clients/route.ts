import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { nextHumanId } from '@/lib/auth';
import { requireStaff } from '@/lib/staff';

export async function GET() {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const clients = await prisma.client.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ clients });
}

const schema = z.object({
  organisation: z.string().min(2),
  contactPerson: z.string().optional(),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  phone: z.string().optional(),
  institutionType: z.string().optional(),
  website: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid client' }, { status: 400 });
  const { email, ...rest } = parsed.data;
  const client = await prisma.client.create({
    data: { ...rest, email: email || undefined, clientCode: await nextHumanId('CLI') },
  });
  return NextResponse.json({ client });
}
