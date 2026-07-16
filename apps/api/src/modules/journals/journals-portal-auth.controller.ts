import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import { JournalAuthService } from './services/journal-auth.service';

@ApiTags('journals-portal-auth')
@Controller({ path: 'journals/portal/auth', version: '1' })
export class JournalsPortalAuthController {
  constructor(
    private readonly auth: JournalAuthService,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  private resolveHost(req: Request): string {
    const loginHost = String(req.headers['x-login-host'] ?? '').trim();
    if (loginHost) return loginHost;
    return (
      this.tenantResolution.extractHostFromHeaders(
        req.headers.host,
        req.headers['x-forwarded-host'],
      ) || 'transient.demo.localhost'
    );
  }

  private async resolveTenantId(req: Request): Promise<string> {
    const host = this.resolveHost(req);
    const tenant = await this.tenantResolution.resolveHost(host);
    if (!tenant) throw new BadRequestException('Unknown journal portal host');
    return tenant.id;
  }

  @Public()
  @Post('register')
  async register(
    @Req() req: Request,
    @Body()
    body: {
      email: string;
      password: string;
      displayName: string;
      affiliation?: string;
      phone?: string;
      orcid?: string;
      department?: string;
      designation?: string;
      country?: string;
      asReviewer?: boolean;
    },
  ) {
    const tenantId = await this.resolveTenantId(req);
    return this.auth.register(tenantId, body);
  }

  @Public()
  @Post('login')
  async login(
    @Req() req: Request,
    @Body() body: { email: string; password: string; rememberMe?: boolean },
  ) {
    const tenantId = await this.resolveTenantId(req);
    return this.auth.login(tenantId, body, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    await this.auth.ensureAuthorAccess(user.tid, user.sub);
    return this.auth.me(user.tid, user.sub);
  }
}
