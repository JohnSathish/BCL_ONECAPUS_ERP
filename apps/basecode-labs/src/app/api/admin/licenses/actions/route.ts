import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff } from '@/lib/staff';

export async function PATCH(req: NextRequest) {
  const gate = await requireStaff();
  if (gate.error) return gate.error;
  const body = await req.json();
  const id = String(body.id ?? '');
  const action = String(body.action ?? '');
  const license = await prisma.license.findUnique({ where: { id } });
  if (!license) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (action === 'renew') {
    const months = Number(body.months ?? 12);
    const from =
      license.expiryDate && license.expiryDate > new Date() ? license.expiryDate : new Date();
    const expiry = new Date(from);
    expiry.setMonth(expiry.getMonth() + months);
    const updated = await prisma.license.update({
      where: { id },
      data: { expiryDate: expiry, status: 'ACTIVE' },
    });
    await prisma.auditLog.create({
      data: {
        actorId: gate.session!.user.id,
        action: 'license.renewed',
        entity: 'License',
        entityId: id,
      },
    });
    return NextResponse.json({ license: updated });
  }
  if (action === 'suspend') {
    const updated = await prisma.license.update({ where: { id }, data: { status: 'SUSPENDED' } });
    return NextResponse.json({ license: updated });
  }
  if (action === 'activate') {
    const updated = await prisma.license.update({ where: { id }, data: { status: 'ACTIVE' } });
    return NextResponse.json({ license: updated });
  }
  if (action === 'deactivate') {
    const updated = await prisma.license.update({ where: { id }, data: { status: 'CANCELLED' } });
    return NextResponse.json({ license: updated });
  }
  if (action === 'update') {
    const updated = await prisma.license.update({
      where: { id },
      data: {
        ...(body.licenseType ? { licenseType: String(body.licenseType) } : {}),
        ...(body.activationLimit != null ? { activationLimit: Number(body.activationLimit) } : {}),
        domainRestriction: body.domainRestriction ? String(body.domainRestriction) : null,
        expiryDate: body.expiryDate ? new Date(String(body.expiryDate)) : license.expiryDate,
      },
    });
    return NextResponse.json({ license: updated });
  }
  if (action === 'delete') {
    await prisma.license.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        actorId: gate.session!.user.id,
        action: 'license.deleted',
        entity: 'License',
        entityId: id,
      },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
