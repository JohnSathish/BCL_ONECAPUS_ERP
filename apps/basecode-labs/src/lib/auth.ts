import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const COOKIE = 'bcl_session';

function jwtSecret() {
  const raw = process.env.JWT_SECRET ?? 'dev-secret';
  if (
    process.env.NODE_ENV === 'production' &&
    (raw === 'dev-secret' || raw === 'replace-with-a-long-random-secret')
  ) {
    throw new Error('JWT_SECRET must be a unique value in production');
  }
  return new TextEncoder().encode(raw);
}

export async function hashValue(value: string) {
  return bcrypt.hash(value, 10);
}

export async function verifyHash(value: string, hash: string) {
  return bcrypt.compare(value, hash);
}

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createSessionToken(userId: string, email: string, role: string) {
  return new SignJWT({ email, role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(jwtSecret());
}

export async function readSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwtSecret());
    const user = await prisma.user.findUnique({ where: { id: String(payload.sub) } });
    if (!user || user.status !== 'ACTIVE') return null;
    return { user, token };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export function licenseSigningSecret() {
  const raw = process.env.LICENSE_SIGNING_SECRET ?? 'dev-license-secret';
  if (
    process.env.NODE_ENV === 'production' &&
    (raw === 'dev-license-secret' || raw === 'replace-with-a-second-long-random-secret')
  ) {
    throw new Error('LICENSE_SIGNING_SECRET must be a unique value in production');
  }
  return raw;
}

export function generateLicenseKey(productCode: string) {
  const code = (productCode || 'BCL')
    .replace(/[^A-Z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase()
    .padEnd(3, 'X');
  const raw = randomBytes(8).toString('hex').toUpperCase();
  const a = raw.slice(0, 4);
  const b = raw.slice(4, 8);
  const c = raw.slice(8, 12);
  return `BCL-${code}-${a}-${b}-${c}`;
}

export function signLicensePayload(payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);
  const sig = createHmac('sha256', licenseSigningSecret()).update(body).digest('hex');
  return { token: Buffer.from(JSON.stringify({ payload, sig })).toString('base64url') };
}

export function verifyLicenseToken(token: string) {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as {
      payload: Record<string, unknown>;
      sig: string;
    };
    const expected = createHmac('sha256', licenseSigningSecret())
      .update(JSON.stringify(parsed.payload))
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(parsed.sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return parsed.payload;
  } catch {
    return null;
  }
}

export async function nextHumanId(prefix: string) {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;
  const existing = await prisma.sequence.findUnique({ where: { key } });
  if (!existing) {
    await prisma.sequence.create({ data: { key, year, next: 2 } });
    return `BCL-${prefix}-${year}-0001`;
  }
  const num = existing.next;
  await prisma.sequence.update({ where: { key }, data: { next: num + 1 } });
  return `BCL-${prefix}-${year}-${String(num).padStart(4, '0')}`;
}
