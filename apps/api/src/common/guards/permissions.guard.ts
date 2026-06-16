import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import {
  REQUIRE_ANY_PERMISSION_KEY,
  REQUIRE_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';

import type { JwtUser } from '../decorators/current-user.decorator';

import { PermissionAuditService } from '../permissions/permission-audit.service';

import { extractClientIp } from '../utils/request-host';
import { isSuperAdmin } from '../permissions/permission-registry';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,

    private readonly permissionAudit: PermissionAuditService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredAll = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_PERMISSIONS_KEY,

      [context.getHandler(), context.getClass()],
    );

    const requiredAny = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_ANY_PERMISSION_KEY,

      [context.getHandler(), context.getClass()],
    );

    if (!requiredAll?.length && !requiredAny?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: JwtUser;
      method: string;
      headers: Record<string, string | string[] | undefined>;
    }>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const method = request.method?.toUpperCase() ?? 'GET';
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(method) &&
      !isSuperAdmin(user.roles ?? [])
    ) {
      const maintenance = await this.prisma.systemMaintenanceFlag.findUnique({
        where: { id: 'singleton' },
      });
      if (maintenance?.active) {
        throw new ForbiddenException(
          'System is in maintenance mode during backup restore',
        );
      }
    }

    const permissions = new Set(user.permissions ?? []);

    if (requiredAll?.length) {
      const missing = requiredAll.filter((p) => !permissions.has(p));

      if (missing.length > 0) {
        void this.logDenied(user, request, missing.join(', '), 'require_all');

        throw new ForbiddenException(
          `Missing required permissions: ${missing.join(', ')}`,
        );
      }
    }

    const sensitivePerms = ['rbac:manage', 'users:impersonate'];

    if (
      user.isImpersonating &&
      requiredAll?.some((p) => sensitivePerms.includes(p))
    ) {
      throw new ForbiddenException('Action not allowed during impersonation');
    }

    if (requiredAny?.length) {
      const hasAny = requiredAny.some((p) => permissions.has(p));

      if (!hasAny) {
        void this.logDenied(
          user,
          request,
          requiredAny.join(', '),
          'require_any',
        );

        throw new ForbiddenException(
          `Requires one of: ${requiredAny.join(', ')}`,
        );
      }
    }

    return true;
  }

  private logDenied(
    user: JwtUser,

    request: { headers: Record<string, string | string[] | undefined> },

    permissionSlug: string,

    action: string,
  ) {
    const userAgent = request.headers['user-agent'];

    return this.permissionAudit
      .log({
        tenantId: user.tid,

        userId: user.sub,

        roleSlug: user.roles[0],

        permissionSlug,

        module: 'api',

        action,

        outcome: 'denied',

        ipAddress: extractClientIp(request as never),

        userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      })
      .catch(() => undefined);
  }
}
