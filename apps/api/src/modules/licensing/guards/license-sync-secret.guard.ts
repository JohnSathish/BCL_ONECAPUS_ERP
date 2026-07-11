import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

@Injectable()
export class LicenseSyncSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('LICENSE_SYNC_SECRET')?.trim();
    if (!secret) {
      throw new UnauthorizedException(
        'LICENSE_SYNC_SECRET is not configured on OneCampus',
      );
    }

    const req = context.switchToHttp().getRequest<Request>();
    const provided =
      (
        req.headers['x-bcl-license-sync-secret'] as string | undefined
      )?.trim() || '';

    if (!provided || provided.length !== secret.length) {
      throw new UnauthorizedException('Invalid license sync secret');
    }

    const a = Buffer.from(provided);
    const b = Buffer.from(secret);
    if (!timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid license sync secret');
    }

    return true;
  }
}
