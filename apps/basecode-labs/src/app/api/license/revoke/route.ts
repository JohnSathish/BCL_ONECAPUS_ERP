import { NextRequest, NextResponse } from 'next/server';
import { readSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await readSession();
  if (!session || session.user.role === 'CLIENT_USER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const id = String(body.licenseId ?? '');
  const license = await prisma.license.update({
    where: { id },
    data: { status: 'REVOKED' },
  });
  await prisma.licenseActivation.updateMany({
    where: { licenseId: id },
    data: { status: 'REVOKED' },
  });
  await prisma.auditLog.create({
    data: { actorId: session.user.id, action: 'license.revoked', entity: 'License', entityId: id },
  });
  return NextResponse.json({ ok: true, status: license.status });
}
