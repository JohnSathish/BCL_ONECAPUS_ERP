import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  email: z.string().email(),
  slugs: z.array(z.string()).min(1),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid' }, { status: 400 });
  const docs = await prisma.legalDocument.findMany({ where: { slug: { in: parsed.data.slugs } } });
  await prisma.policyAcceptance.createMany({
    data: docs.map((d) => ({
      email: parsed.data.email,
      documentId: d.id,
      version: d.version,
      ip: req.headers.get('x-forwarded-for') ?? undefined,
      userAgent: req.headers.get('user-agent') ?? undefined,
    })),
  });
  return NextResponse.json({ ok: true });
}
