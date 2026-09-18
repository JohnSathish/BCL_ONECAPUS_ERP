import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  const lead = await prisma.lead.create({
    data: {
      name: 'Newsletter subscriber',
      email: parsed.data.email,
      message: 'Footer newsletter signup',
      source: 'NEWSLETTER',
      stage: 'NEW',
    },
  });
  await prisma.auditLog.create({
    data: {
      action: 'lead.created',
      entity: 'Lead',
      entityId: lead.id,
      meta: `newsletter:${lead.email}`,
    },
  });
  return NextResponse.json({ ok: true });
}
