import { createHash, randomUUID } from 'crypto';

const BOT_UA =
  /bot|spider|crawl|slurp|facebookexternalhit|preview|headless|wget|curl|python-requests|scrapy|lighthouse|pingdom|uptimerobot|bytespider|semrush|ahrefs/i;

const SESSION_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SCHOOL_WEB_PRESENCE_CACHE_MS = 8_000;
export const SCHOOL_WEB_DEFAULT_TIMEOUT_MINUTES = 10;

export function isSchoolWebBotUserAgent(
  userAgent: string | undefined,
): boolean {
  const ua = userAgent?.trim() ?? '';
  if (!ua) return true;
  return BOT_UA.test(ua);
}

export function isSchoolWebSessionId(value: string | undefined): boolean {
  return Boolean(value && SESSION_ID_RE.test(value.trim()));
}

export function hashSchoolWebVisitor(salt: string, sessionId: string): string {
  return createHash('sha256')
    .update(`${salt}|sls-web|${sessionId.trim()}`)
    .digest('hex');
}

export function hashSchoolWebIp(salt: string, ip: string): string {
  return createHash('sha256')
    .update(`${salt}|ip|${ip}`)
    .digest('hex')
    .slice(0, 24);
}

export function clampTimeoutMinutes(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return SCHOOL_WEB_DEFAULT_TIMEOUT_MINUTES;
  return Math.min(30, Math.max(5, Math.round(n)));
}

export function normalizePublicPath(raw?: string | null): string {
  const value = String(raw || '/').trim() || '/';
  const noQuery = value.split('?')[0]?.split('#')[0] || '/';
  let path = noQuery.startsWith('/') ? noQuery : `/${noQuery}`;
  if (path.startsWith('/school-site'))
    path = path.slice('/school-site'.length) || '/';
  if (path.length > 180) path = path.slice(0, 180);
  return path.replace(/\/{2,}/g, '/') || '/';
}

export function istDayString(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function istDayDate(now = new Date()): Date {
  return new Date(`${istDayString(now)}T00:00:00.000Z`);
}

function firstHeaderValue(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === 'string' && item.trim());
    return typeof first === 'string' ? first : undefined;
  }
  return typeof value === 'string' ? value : undefined;
}

export function schoolWebClientIp(
  headers: Record<string, unknown>,
  fallbackIp?: string | null,
): string {
  const firstForwarded = firstHeaderValue(headers['x-forwarded-for']);
  if (firstForwarded?.trim())
    return firstForwarded.split(',')[0]?.trim() || 'unknown';
  const firstReal = firstHeaderValue(headers['x-real-ip']);
  if (firstReal?.trim()) return firstReal.trim();
  return fallbackIp?.trim() || 'unknown';
}

export function newSchoolWebSessionId(): string {
  return randomUUID();
}
