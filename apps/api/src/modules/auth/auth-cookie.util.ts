import type { CookieOptions, Response } from 'express';

export const REFRESH_COOKIE_NAME = 'nep_refresh';

/** Cookie path covers login, refresh, and logout under /api/v1/auth */
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function refreshCookieOptions(
  maxAgeSeconds: number,
  secure: boolean,
): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    maxAge: maxAgeSeconds * 1000,
  };
}

export function setRefreshCookie(
  res: Response,
  refreshToken: string,
  maxAgeSeconds: number,
  secure: boolean,
): void {
  res.cookie(
    REFRESH_COOKIE_NAME,
    refreshToken,
    refreshCookieOptions(maxAgeSeconds, secure),
  );
}

export function clearRefreshCookie(res: Response, secure: boolean): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
  });
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
