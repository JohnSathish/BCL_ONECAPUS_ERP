import { createHash, randomBytes } from 'crypto';

export function hashKioskToken(token: string): string {
  return createHash('sha256').update(token.trim()).digest('hex');
}

export function generateKioskToken(): {
  token: string;
  hash: string;
  prefix: string;
} {
  const token = randomBytes(24).toString('hex');
  return {
    token,
    hash: hashKioskToken(token),
    prefix: token.slice(0, 8),
  };
}

export function buildKioskUrl(
  code: string,
  token: string,
  origin?: string,
): string {
  const base = (
    origin ??
    process.env.WEB_ORIGIN ??
    'http://localhost:3000'
  ).replace(/\/$/, '');
  return `${base}/kiosk/${encodeURIComponent(code)}?token=${encodeURIComponent(token)}`;
}
