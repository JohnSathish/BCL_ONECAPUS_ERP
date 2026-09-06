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

function firstHeaderValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim());
    return typeof first === 'string' ? first : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

export function schoolPortalClientIp(
  headers: Record<string, unknown>,
  fallbackIp?: string | null,
): string {
  const firstForwarded = firstHeaderValue(headers['x-forwarded-for']);
  if (firstForwarded?.trim()) {
    return firstForwarded.split(',')[0]?.trim() || 'unknown';
  }
  const firstReal = firstHeaderValue(headers['x-real-ip']);
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
