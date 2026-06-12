import { Injectable, NestMiddleware } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { CLS_TENANT_ID } from '../cls/cls.constants';
import { extractRequestHost } from '../utils/request-host';

@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    const loginHost = (
      req.headers['x-login-host'] as string | undefined
    )?.trim();
    const host = loginHost || extractRequestHost(req);
    if (host) {
      const allowUnverified = process.env.ALLOW_UNVERIFIED_DOMAINS === 'true';
      const domain = await this.prisma.tenantDomain.findFirst({
        where: {
          host,
          deletedAt: null,
          ...(allowUnverified ? {} : { verified: true }),
        },
        include: { tenant: true },
      });
      if (
        domain?.tenant &&
        !domain.tenant.deletedAt &&
        domain.tenant.status === 'active'
      ) {
        this.cls.set(CLS_TENANT_ID, domain.tenant.id);
      }
    }

    const slug = (req.headers['x-tenant-slug'] as string | undefined)?.trim();
    if (slug && !this.cls.get(CLS_TENANT_ID)) {
      const tenant = await this.prisma.tenant.findFirst({
        where: { slug, deletedAt: null },
      });
      if (tenant) {
        this.cls.set(CLS_TENANT_ID, tenant.id);
      }
    }

    next();
  }
}
