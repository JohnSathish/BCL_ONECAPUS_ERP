import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  name: z.string().min(2),
  organisation: z.string().optional(),
  email: z.string().email(),
  phone: z.string().min(8),
  service: z.string().optional(),
  budget: z.string().optional(),
  message: z.string().min(4),
  preferredContact: z.string().optional(),
  consent: z.literal(true),
  acceptTerms: z.literal(true),
  acceptPrivacy: z.literal(true),
  attachmentNames: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid enquiry' }, { status: 400 });
  }
  const {
    consent: _consent,
    acceptTerms: _t,
    acceptPrivacy: _p,
    attachmentNames,
    preferredContact,
    ...fields
  } = parsed.data;
  const lead = await prisma.lead.create({
    data: {
      ...fields,
      source: 'WEBSITE',
      stage: 'NEW',
      message: [
        parsed.data.message,
        preferredContact ? `Preferred contact: ${preferredContact}` : '',
        attachmentNames?.length ? `Attachments named: ${attachmentNames.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    },
  });
  await prisma.auditLog.create({
    data: { action: 'lead.created', entity: 'Lead', entityId: lead.id, meta: lead.email },
  });
  const docs = await prisma.legalDocument.findMany({
    where: { slug: { in: ['privacy-policy', 'terms'] }, status: 'PUBLISHED' },
  });
  if (docs.length) {
    await prisma.policyAcceptance.createMany({
      data: docs.map((d) => ({
        email: parsed.data.email,
        documentId: d.id,
        version: d.version,
        ip: req.headers.get('x-forwarded-for') ?? undefined,
        userAgent: req.headers.get('user-agent') ?? undefined,
      })),
    });
  }
  return NextResponse.json({ ok: true, id: lead.id });
}
