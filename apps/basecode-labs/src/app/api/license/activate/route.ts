import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { signLicensePayload } from '@/lib/auth';
import { requireLicenseApi } from '@/lib/license-api';
import { licenseDomainAllowed } from '@/lib/license-domain';

const schema = z.object({
  licenseKey: z.string().min(8),
  productCode: z.string().optional(),
  domain: z.string().optional(),
  hosts: z.array(z.string()).optional(),
  installationId: z.string().min(4),
  deviceId: z.string().optional(),
  appVersion: z.string().optional(),
  os: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const denied = requireLicenseApi(req);
  if (denied) return denied;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid activation payload' }, { status: 400 });
  const license = await prisma.license.findUnique({
    where: { licenseKey: parsed.data.licenseKey.trim().toUpperCase() },
    include: { product: true, client: true, activations: true },
  });
  if (!license) {
    await prisma.auditLog.create({
      data: { action: 'license.activate_failed', entity: 'License', meta: 'unknown key' },
    });
    return NextResponse.json({ error: 'License not found' }, { status: 404 });
  }
  const requestedProduct = parsed.data.productCode?.trim().toUpperCase();
  const licenseProduct = license.product.code.toUpperCase();
  const keyProduct = parsed.data.licenseKey.trim().toUpperCase().split('-')[1] ?? '';
  if (
    requestedProduct &&
    requestedProduct !== licenseProduct &&
    !(requestedProduct === 'ONC' && keyProduct === 'ONC')
  ) {
    return NextResponse.json({ error: 'Product mismatch' }, { status: 403 });
  }
  if (license.status !== 'ACTIVE')
    return NextResponse.json({ error: `License is ${license.status}` }, { status: 403 });
  if (license.expiryDate && license.expiryDate < new Date()) {
    await prisma.license.update({ where: { id: license.id }, data: { status: 'EXPIRED' } });
    return NextResponse.json({ error: 'License expired' }, { status: 403 });
  }
  const candidates = [parsed.data.domain, ...(parsed.data.hosts ?? [])];
  if (!licenseDomainAllowed(license.domainRestriction, candidates)) {
    return NextResponse.json({ error: 'Domain not permitted' }, { status: 403 });
  }
  const existing = license.activations.find(
    (a) => a.installationId === parsed.data.installationId && a.status === 'ACTIVE',
  );
  if (!existing && license.currentActivations >= license.activationLimit) {
    return NextResponse.json({ error: 'Activation limit reached' }, { status: 403 });
  }
  const activation = await prisma.licenseActivation.upsert({
    where: {
      licenseId_installationId: {
        licenseId: license.id,
        installationId: parsed.data.installationId,
      },
    },
    create: {
      licenseId: license.id,
      installationId: parsed.data.installationId,
      deviceId: parsed.data.deviceId,
      domain: parsed.data.domain,
      ip: req.headers.get('x-forwarded-for'),
      os: parsed.data.os,
      appVersion: parsed.data.appVersion,
      status: 'ACTIVE',
      lastHeartbeat: new Date(),
    },
    update: {
      status: 'ACTIVE',
      deviceId: parsed.data.deviceId,
      domain: parsed.data.domain,
      lastHeartbeat: new Date(),
      appVersion: parsed.data.appVersion,
    },
  });
  const activeCount = await prisma.licenseActivation.count({
    where: { licenseId: license.id, status: 'ACTIVE' },
  });
  await prisma.license.update({
    where: { id: license.id },
    data: { currentActivations: activeCount },
  });
  const signed = signLicensePayload({
    licenseCode: license.licenseCode,
    product: license.product.code,
    client: license.client.clientCode,
    expiry: license.expiryDate?.toISOString() ?? null,
    graceDays: license.graceDays,
    installationId: activation.installationId,
  });
  await prisma.auditLog.create({
    data: {
      action: 'license.activated',
      entity: 'License',
      entityId: license.id,
      meta: activation.id,
    },
  });
  return NextResponse.json({
    ok: true,
    activationId: activation.id,
    token: signed.token,
    productCode: license.product.code,
    expiryDate: license.expiryDate,
    graceDays: license.graceDays,
    status: license.status,
  });
}
