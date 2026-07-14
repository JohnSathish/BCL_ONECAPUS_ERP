import type { Request } from 'express';

export function extractRequestHost(req: Request): string {
  const loginHost = (req.headers['x-login-host'] as string | undefined)?.trim();
  if (loginHost) {
    return normalizeHost(loginHost);
  }
  const forwarded = req.headers['x-forwarded-host'];
  const hostHeader = req.headers.host;
  const raw =
    (typeof forwarded === 'string'
      ? forwarded.split(',')[0]?.trim()
      : Array.isArray(forwarded)
        ? forwarded[0]?.trim()
        : undefined) ||
    hostHeader ||
    '';
  return normalizeHost(raw);
}

export function normalizeHost(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const withoutPort = trimmed.split(':')[0] ?? trimmed;
  return withoutPort.startsWith('www.') ? withoutPort.slice(4) : withoutPort;
}

export function extractClientIp(req: Request): string {
  const headerFirst = (value: string | string[] | undefined): string | null => {
    if (!value) return null;
    const raw = Array.isArray(value) ? value[0] : value;
    const first = raw.split(',')[0]?.trim();
    return first || null;
  };

  // Prefer explicit edge / proxy client headers over Express socket IP
  // (without trust proxy, req.ip is often the reverse proxy for everyone).
  return (
    headerFirst(req.headers['cf-connecting-ip']) ||
    headerFirst(req.headers['true-client-ip']) ||
    headerFirst(req.headers['x-real-ip']) ||
    headerFirst(req.headers['x-forwarded-for']) ||
    req.ip ||
    'unknown'
  );
}

export function extractClientCountry(req: Request): string | null {
  const cf = req.headers['cf-ipcountry'];
  if (typeof cf === 'string' && cf.length === 2 && cf !== 'XX') {
    return cf.toUpperCase();
  }
  return null;
}
