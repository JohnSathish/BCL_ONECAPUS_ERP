import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateOtp, hashValue } from '@/lib/auth';
import { sendOtpEmail, smtpReady } from '@/lib/mail';

const schema = z.object({
  email: z.string().email(),
  purpose: z.enum(['ADMIN_LOGIN', 'CLIENT_LOGIN']).default('ADMIN_LOGIN'),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  const production = process.env.NODE_ENV === 'production';
  if (production && !smtpReady()) {
    return NextResponse.json(
      { error: 'Email login is not configured. Contact BaseCode Labs.' },
      { status: 503 },
    );
  }
  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'No active account for this email' }, { status: 401 });
  }
  if (parsed.data.purpose === 'ADMIN_LOGIN' && user.role.startsWith('CLIENT')) {
    return NextResponse.json({ error: 'Use the client portal login' }, { status: 403 });
  }
  if (
    parsed.data.purpose === 'CLIENT_LOGIN' &&
    !user.role.startsWith('CLIENT') &&
    user.role !== 'SUPER_ADMIN'
  ) {
    return NextResponse.json({ error: 'Use the admin login' }, { status: 403 });
  }
  const recent = await prisma.otpChallenge.count({
    where: { email, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
  });
  if (recent >= 5) {
    return NextResponse.json(
      { error: 'Too many codes. Try again in a few minutes.' },
      { status: 429 },
    );
  }
  const code = generateOtp();
  const challenge = await prisma.otpChallenge.create({
    data: {
      email,
      purpose: parsed.data.purpose,
      codeHash: await hashValue(code),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      ip: req.headers.get('x-forwarded-for'),
    },
  });
  try {
    const mail = await sendOtpEmail(email, code);
    if (!mail.delivered) {
      if (production) {
        await prisma.otpChallenge.delete({ where: { id: challenge.id } });
        return NextResponse.json(
          { error: 'Could not send the login email. Try again shortly.' },
          { status: 503 },
        );
      }
    }
    await prisma.auditLog.create({
      data: { actorId: user.id, action: 'auth.otp_requested', entity: 'User', entityId: user.id },
    });
    return NextResponse.json({
      ok: true,
      ...(!production && mail.dev ? { devCode: code } : {}),
    });
  } catch (err) {
    await prisma.otpChallenge.delete({ where: { id: challenge.id } }).catch(() => undefined);
    console.error('[BaseCode OTP] send failed', err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: 'Could not send the login email. Try again shortly.' },
      { status: 503 },
    );
  }
}
