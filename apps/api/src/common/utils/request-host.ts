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
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim() || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}
