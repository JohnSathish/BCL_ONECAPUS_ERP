import type { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'nep_refresh';

/** Cookie path covers login, refresh, and logout under /api/v1/auth */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function refreshCookieOptions(
  maxAgeSeconds: number,
  secure: boolean,
  path: string = REFRESH_COOKIE_PATH,
): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path,
    maxAge: maxAgeSeconds * 1000,
  };
}

export function setRefreshCookie(
  res: Response,
  refreshToken: string,
  maxAgeSeconds: number,
  secure: boolean,
  path: string = REFRESH_COOKIE_PATH,
): void {
  res.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    refreshCookieOptions(maxAgeSeconds, secure, path),
  );
}

export function clearRefreshCookie(res: Response, secure: boolean): void {
  const base = {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
  };
  res.clearCookie(REFRESH_COOKIE_NAME, { ...base, path: REFRESH_COOKIE_PATH });
  res.clearCookie(REFRESH_COOKIE_NAME, { ...base, path: '/' });
}

export function readRefreshTokenFromRequest(
  cookies: Record<string, string | undefined> | undefined,
  bodyToken?: string,
): string | undefined {
  const fromCookie = cookies?.[REFRESH_COOKIE_NAME];
  if (fromCookie && fromCookie.length >= 10) return fromCookie;
  if (bodyToken && bodyToken.length >= 10) return bodyToken;
  return undefined;
}
