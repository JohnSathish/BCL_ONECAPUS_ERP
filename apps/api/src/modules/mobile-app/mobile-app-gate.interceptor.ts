import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { CLS_TENANT_ID } from '../../common/cls/cls.constants';
import { ClsService } from 'nestjs-cls';
import { MobileAppSettingsService } from './mobile-app-settings.service';
import type { MobileAppType } from './constants/dashboard-config';

const SKIP_PREFIXES = ['/v1/mobile-app/bootstrap', '/v1/auth/', '/health'];

@Injectable()
export class MobileAppGateInterceptor implements NestInterceptor {
  constructor(
    private readonly settings: MobileAppSettingsService,
    private readonly cls: ClsService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<Request>();
    const clientType = String(req.headers['x-client-type'] ?? '').toLowerCase();
    if (clientType !== 'mobile') {
      return next.handle();
    }

    const path = req.originalUrl?.split('?')[0] ?? req.url;
    if (SKIP_PREFIXES.some((p) => path.includes(p))) {
      return next.handle();
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic && path.includes('/mobile-app/bootstrap')) {
      return next.handle();
    }

    const tenantId = this.cls.get<string>(CLS_TENANT_ID);
    if (!tenantId) return next.handle();

    const appTypeRaw = String(
      req.headers['x-app-type'] ?? 'student',
    ).toLowerCase();
    const appType: MobileAppType = appTypeRaw === 'staff' ? 'STAFF' : 'STUDENT';
    const appVersion =
      String(req.headers['x-app-version'] ?? '').trim() || undefined;

    const gate = await this.settings.checkGate(tenantId, appType, appVersion);
    if (gate.blocked) {
      throw new HttpException(
        {
          message: gate.message,
          minVersion: (gate as { minVersion?: string }).minVersion,
        },
        gate.statusCode ?? 503,
      );
    }

    return next.handle();
  }
}
