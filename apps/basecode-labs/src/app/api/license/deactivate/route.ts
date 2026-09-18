import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireLicenseApi } from '@/lib/license-api';

export async function POST(req: NextRequest) {
  const denied = requireLicenseApi(req);
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const licenseKey = String(body.licenseKey ?? '').toUpperCase();
  const installationId = String(body.installationId ?? '');
  const license = await prisma.license.findUnique({ where: { licenseKey } });
  if (!license) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await prisma.licenseActivation.updateMany({
    where: { licenseId: license.id, installationId },
    data: { status: 'INACTIVE' },
  });
  const activeCount = await prisma.licenseActivation.count({
    where: { licenseId: license.id, status: 'ACTIVE' },
  });
  await prisma.license.update({
    where: { id: license.id },
    data: { currentActivations: activeCount },
  });
  return NextResponse.json({ ok: true });
}
