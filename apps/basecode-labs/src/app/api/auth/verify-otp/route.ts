import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createSessionToken, setSessionCookie, verifyHash } from '@/lib/auth';

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  purpose: z.enum(['ADMIN_LOGIN', 'CLIENT_LOGIN']).default('ADMIN_LOGIN'),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success)
    return NextResponse.json({ error: 'Email and 6-digit code required' }, { status: 400 });
  const email = parsed.data.email.toLowerCase().trim();
  const challenge = await prisma.otpChallenge.findFirst({
    where: { email, purpose: parsed.data.purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!challenge) return NextResponse.json({ error: 'Request a new code' }, { status: 400 });
  if (challenge.expiresAt < new Date())
    return NextResponse.json({ error: 'Code expired' }, { status: 400 });
  if (challenge.attempts >= 5)
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  const ok = await verifyHash(parsed.data.code, challenge.codeHash);
  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { attempts: { increment: 1 }, consumedAt: ok ? new Date() : null },
  });
  if (!ok) return NextResponse.json({ error: 'Incorrect code' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 401 });
  const token = await createSessionToken(user.id, user.email, user.role);
  await setSessionCookie(token);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: 'auth.login',
      entity: 'User',
      entityId: user.id,
      ip: req.headers.get('x-forwarded-for'),
      userAgent: req.headers.get('user-agent'),
    },
  });
  return NextResponse.json({
    ok: true,
    role: user.role,
    redirect: user.role.startsWith('CLIENT') ? '/portal' : '/admin',
  });
}
