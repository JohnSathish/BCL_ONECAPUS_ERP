import { NextResponse } from 'next/server';
import { clearSessionCookie, readSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await readSession();
  if (session) {
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: 'auth.logout',
        entity: 'User',
        entityId: session.user.id,
      },
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
