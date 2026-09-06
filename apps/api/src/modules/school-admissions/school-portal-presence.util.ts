import { createHash } from 'crypto';

export const SCHOOL_PORTAL_LIVE_WINDOW_MS = 75_000;
export const SCHOOL_PORTAL_PRESENCE_TTL_MS = 10 * 60_000;

const BOT_UA =
  /bot|spider|crawl|slurp|facebookexternalhit|preview|headless|wget|curl|python-requests|scrapy/i;

const SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSchoolPortalBotUserAgent(
  userAgent: string | undefined,
): boolean {
  const ua = userAgent?.trim() ?? '';
  if (!ua) return true;
  return BOT_UA.test(ua);
}

export function isSchoolPortalSessionId(value: string | undefined): boolean {
  return Boolean(value && SESSION_ID_RE.test(value.trim()));
}

export function schoolPortalClientIp(
  headers: {
    'x-forwarded-for'?: string | string[];
    'x-real-ip'?: string | string[];
  },
  fallbackIp?: string | null,
): string {
  const forwarded = headers['x-forwarded-for'];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (firstForwarded?.trim()) {
    return firstForwarded.split(',')[0]?.trim() || 'unknown';
  }
  const real = headers['x-real-ip'];
  const firstReal = Array.isArray(real) ? real[0] : real;
  if (firstReal?.trim()) return firstReal.trim();
  return fallbackIp?.trim() || 'unknown';
}

export function schoolPortalVisitorKey(
  salt: string,
  ip: string,
  userAgent: string | undefined,
): string {
  return createHash('sha256')
    .update(`${salt}|${ip}|${(userAgent ?? '').slice(0, 80)}`)
    .digest('hex');
}

export function schoolPortalSessionKey(
  salt: string,
  sessionId: string,
): string {
  return createHash('sha256')
    .update(`${salt}|session|${sessionId.trim()}`)
    .digest('hex');
}
