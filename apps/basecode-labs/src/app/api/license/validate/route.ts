import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLicenseApi } from '@/lib/license-api';

export async function POST(req: NextRequest) {
  const denied = requireLicenseApi(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const licenseKey = String(body.licenseKey ?? '').toUpperCase();
  const license = await prisma.license.findUnique({
    where: { licenseKey },
    include: { product: true },
  });
  if (!license) return NextResponse.json({ valid: false, error: 'not_found' }, { status: 404 });
  const expired = Boolean(license.expiryDate && license.expiryDate < new Date());
  const valid = license.status === 'ACTIVE' && !expired;
  return NextResponse.json({
    valid,
    status: expired ? 'EXPIRED' : license.status,
    product: license.product.code,
    expiryDate: license.expiryDate,
    graceDays: license.graceDays,
  });
}

export async function GET(req: NextRequest) {
  const denied = requireLicenseApi(req);
  if (denied) return denied;
  const licenseKey = req.nextUrl.searchParams.get('key')?.toUpperCase();
  if (!licenseKey) return NextResponse.json({ error: 'key required' }, { status: 400 });
  const license = await prisma.license.findUnique({
    where: { licenseKey },
    include: { product: true, client: true, activations: true },
  });
  if (!license) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({
    licenseCode: license.licenseCode,
    status: license.status,
    product: license.product.code,
    client: license.client.organisation,
    expiryDate: license.expiryDate,
    activations: license.currentActivations,
    activationLimit: license.activationLimit,
  });
}
