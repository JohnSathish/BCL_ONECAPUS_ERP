import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtUser } from '../../common/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import {
  SCHOOL_LICENSE_MODULE_KEY,
  SKIP_SCHOOL_LICENSE_KEY,
} from './school-sis-license.decorators';
import { SchoolSisLicenseService } from './school-sis-license.service';
import { PrismaService } from '../../database/prisma.service';
import { SCHOOL_SIS_PRODUCT } from './school-sis.constants';

@Injectable()
export class SchoolLicenseGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly licenses: SchoolSisLicenseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_SCHOOL_LICENSE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const req = context.switchToHttp().getRequest<{
      user?: JwtUser;
      method?: string;
      path?: string;
      url?: string;
    }>();
    const path = `${req.path ?? ''} ${req.url ?? ''}`;
    const schoolApi =
      path.includes('school-sis') || path.includes('school-mobile');
    if (!schoolApi) return true;
    if (path.includes('school-sis/license')) return true;

    const user = req.user;
    if (!user?.tid) return true;
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId: user.tid },
      select: { portalExtrasJson: true },
    });
    const extras =
      (branding?.portalExtrasJson as { schoolProduct?: string } | null) ?? {};
    if (extras.schoolProduct !== SCHOOL_SIS_PRODUCT) return true;

    const method = (req.method ?? 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      await this.licenses.assertWritable(user.tid);
    }

    const moduleId = this.reflector.getAllAndOverride<string>(
      SCHOOL_LICENSE_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (moduleId) await this.licenses.assertModule(user.tid, moduleId);
    return true;
  }
}
