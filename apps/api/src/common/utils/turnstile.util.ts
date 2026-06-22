import { BadRequestException } from '@nestjs/common';

export async function verifyTurnstileToken(
  token: string | undefined,
  remoteIp?: string,
): Promise<void> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return;

  if (!token?.trim()) {
    throw new BadRequestException('CAPTCHA verification required');
  }

  const body = new URLSearchParams({
    secret,
    response: token.trim(),
  });
  if (remoteIp) body.set('remoteip', remoteIp);

  const res = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  );

  if (!res.ok) {
    throw new BadRequestException('CAPTCHA verification failed');
  }

  const data = (await res.json()) as { success?: boolean };
  if (!data.success) {
    throw new BadRequestException('CAPTCHA verification failed');
  }
}
