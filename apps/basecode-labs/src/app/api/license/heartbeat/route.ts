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
  const expired = Boolean(license.expiryDate && license.expiryDate < new Date());
  const graceEnd = license.expiryDate
    ? new Date(license.expiryDate.getTime() + license.graceDays * 86400000)
    : null;
  const offlineOk = !expired || (graceEnd ? graceEnd > new Date() : false);
  if (installationId) {
    await prisma.licenseActivation.updateMany({
      where: { licenseId: license.id, installationId },
      data: { lastHeartbeat: new Date() },
    });
  }
  const ok = license.status === 'ACTIVE' && (!expired || offlineOk);
  return NextResponse.json({
    ok,
    status: expired && license.status === 'ACTIVE' ? 'EXPIRED' : license.status,
    expired,
    graceDays: license.graceDays,
    expiryDate: license.expiryDate,
  });
}
