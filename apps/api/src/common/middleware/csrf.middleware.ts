import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const CSRF_COOKIE = 'oc_csrf';
const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('CSRF_ENABLED', 'true') === 'true';
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (!this.enabled) return next();

    const isApi = req.path.startsWith('/api/');
    if (!isApi) return next();

    const clientType = String(req.headers['x-client-type'] ?? '').toLowerCase();
    if (clientType === 'mobile') return next();

    const hasBearer = Boolean(
      String(req.headers.authorization ?? '').startsWith('Bearer '),
    );
    const hasRefreshCookie = Boolean(
      (req.cookies as Record<string, string | undefined>)?.nep_refresh,
    );

    if (SAFE_METHODS.has(req.method)) {
      const existing = (req.cookies as Record<string, string | undefined>)?.[
        CSRF_COOKIE
      ];
      if (!existing && hasRefreshCookie) {
        const token = randomBytes(32).toString('base64url');
        res.cookie(CSRF_COOKIE, token, {
          httpOnly: false,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
        });
      }
      return next();
    }

    if (!hasRefreshCookie || hasBearer) return next();

    const cookieToken = (req.cookies as Record<string, string | undefined>)?.[
      CSRF_COOKIE
    ];
    const headerToken = String(req.headers[CSRF_HEADER] ?? '');

    if (
      !cookieToken ||
      !headerToken ||
      cookieToken.length !== headerToken.length ||
      !timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
    ) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    next();
  }
}

export { CSRF_COOKIE, CSRF_HEADER };
