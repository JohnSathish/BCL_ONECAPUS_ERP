import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request } from 'express';
import { extractClientIp } from '../utils/request-host';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(
    req: Record<string, any>,
  ): Promise<string> {
    const request = req as Request;
    const ip = extractClientIp(request);
    const method = String(request.method ?? '').toUpperCase();
    if (method !== 'POST') return ip;

    const path = String(
      (request as { route?: { path?: string } }).route?.path ??
        request.path ??
        request.url ??
        '',
    ).toLowerCase();
    const body = request.body as Record<string, unknown> | undefined;

    // Isolate password login so campus/shared NATs do not share one bucket.
    if (path.includes('login') && !path.includes('mfa')) {
      const account = String(body?.email ?? body?.identifier ?? '')
        .trim()
        .toLowerCase();
      if (account) return `${ip}:acct:${account}`;
    }

    // Isolate MFA verify-login per pending token.
    if (path.includes('mfa') && path.includes('verify-login')) {
      const token = String(body?.mfaToken ?? '').trim();
      if (token) return `${ip}:mfa:${token.slice(0, 48)}`;
    }

    return ip;
  }

  protected override async getErrorMessage(
    context: ExecutionContext,
    throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<string> {
    const seconds = Math.max(
      0,
      Number(throttlerLimitDetail.timeToBlockExpire) || 0,
    );
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    const req = context.switchToHttp().getRequest<Request>();
    const path = String(req.path ?? req.url ?? '').toLowerCase();

    if (path.includes('/auth/') && path.includes('login')) {
      return `Too many sign-in attempts. Please wait about ${minutes} minute${minutes === 1 ? '' : 's'} and try again. Wrong CAPTCHA answers do not lock your account — only repeated wrong passwords do.`;
    }

    return `Too many requests. Please wait about ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`;
  }
}
