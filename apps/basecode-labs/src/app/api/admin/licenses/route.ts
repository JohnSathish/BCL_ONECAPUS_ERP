import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateLicenseKey, nextHumanId } from '@/lib/auth';
import { requireStaff } from '@/lib/staff';

const schema = z.object({
  clientId: z.string(),
  productId: z.string(),
  licenseType: z.string(),
  startDate: z.string(),
  expiryDate: z.string().optional(),
  activationLimit: z.coerce.number().default(3),
  domainRestriction: z.string().optional(),
  graceDays: z.coerce.number().default(7),
});

export async function GET() {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const licenses = await prisma.license.findMany({
    include: { client: true, product: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return NextResponse.json({ licenses });
}

export async function POST(req: NextRequest) {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Invalid license' }, { status: 400 });
  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  let expiryDate = parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null;
  if (!expiryDate && parsed.data.licenseType !== 'Lifetime') {
    expiryDate = new Date(parsed.data.startDate);
    const t = parsed.data.licenseType;
    if (t === 'Monthly') expiryDate.setMonth(expiryDate.getMonth() + 1);
    else if (t === 'Quarterly') expiryDate.setMonth(expiryDate.getMonth() + 3);
    else if (t === 'Trial') expiryDate.setDate(expiryDate.getDate() + 14);
    else expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  }
  const license = await prisma.license.create({
    data: {
      licenseCode: await nextHumanId('LIC'),
      licenseKey: generateLicenseKey(product.code),
      clientId: parsed.data.clientId,
      productId: parsed.data.productId,
      licenseType: parsed.data.licenseType,
      startDate: new Date(parsed.data.startDate),
      expiryDate,
      activationLimit: parsed.data.activationLimit,
      domainRestriction: parsed.data.domainRestriction,
      graceDays: parsed.data.graceDays,
      status: 'ACTIVE',
      createdBy: gate.session!.user.email,
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: gate.session!.user.id,
      action: 'license.created',
      entity: 'License',
      entityId: license.id,
    },
  });
  return NextResponse.json({ license });
}
