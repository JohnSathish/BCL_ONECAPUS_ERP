import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { SchoolSisOpsService } from './school-sis-ops.service';
import { SCHOOL_SIS_PERMISSION_MANAGE } from './school-sis.constants';
import { SUPER_ROLE_SLUGS } from './school-sis-iam.catalog';

@Injectable()
export class SchoolMaintenanceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly ops: SchoolSisOpsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<{
      user?: JwtUser;
      path?: string;
      url?: string;
    }>();
    const path = `${req.path ?? ''} ${req.url ?? ''}`;
    if (!path.includes('school-sis') && !path.includes('school-mobile'))
      return true;
    if (path.includes('school-sis/ops')) return true;
    if (path.includes('school-sis/license')) return true;
    const user = req.user;
    if (!user?.tid) return true;
    const perms = user.permissions ?? [];
    const roles = user.roles ?? [];
    if (
      perms.includes('*') ||
      perms.includes(SCHOOL_SIS_PERMISSION_MANAGE) ||
      perms.includes('system.maintenance') ||
      roles.some((r) => SUPER_ROLE_SLUGS.has(r))
    ) {
      return true;
    }
    const block = await this.ops.isMaintenanceBlocking(user.tid);
    if (!block) return true;
    throw new ServiceUnavailableException({
      errorCode: 'SCHOOL_MAINTENANCE',
      message: block,
    });
  }
}
