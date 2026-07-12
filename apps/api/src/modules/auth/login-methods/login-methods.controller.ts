import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ClsService } from 'nestjs-cls';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CLS_TENANT_ID } from '../../../common/cls/cls.constants';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import {
  extractClientCountry,
  extractClientIp,
  extractRequestHost,
} from '../../../common/utils/request-host';
import { TenantResolutionService } from '../../tenants/tenant-resolution.service';
import { setRefreshCookie } from '../auth-cookie.util';
import { AuthService } from '../auth.service';
import { AuthQrService } from './auth-qr.service';
import { AuthRfidService } from './auth-rfid.service';
import {
  IssueQrLoginDto,
  RedeemQrLoginDto,
  RedeemRfidLoginDto,
} from './dto/login-methods.dto';

@ApiTags('auth-login-methods')
@Controller({ path: 'auth', version: '1' })
export class LoginMethodsController {
  constructor(
    private readonly auth: AuthService,
    private readonly qr: AuthQrService,
    private readonly rfid: AuthRfidService,
    private readonly tenantResolution: TenantResolutionService,
    private readonly cls: ClsService,
    private readonly config: ConfigService,
  ) {}

  private cookieSecure(): boolean {
    const explicit = this.config.get<string>('COOKIE_SECURE');
    if (explicit !== undefined) return explicit === 'true';
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private isMobileClient(req: Request): boolean {
    const header = String(req.headers['x-client-type'] ?? '').toLowerCase();
    const bodyType = (
      req.body as { clientType?: string } | undefined
    )?.clientType?.toLowerCase();
    return header === 'mobile' || bodyType === 'mobile';
  }

  private mobileMeta(req: Request) {
    if (!this.isMobileClient(req)) {
      return {
        userAgent: req.headers['user-agent'],
        ipAddress: extractClientIp(req),
        country: extractClientCountry(req) ?? undefined,
      };
    }
    const appType = String(req.headers['x-app-type'] ?? '').toLowerCase();
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: extractClientIp(req),
      clientType: 'mobile',
      appType: appType === 'staff' ? 'staff' : 'student',
      appVersion:
        String(req.headers['x-app-version'] ?? '').trim() || undefined,
      deviceId: String(req.headers['x-device-id'] ?? '').trim() || undefined,
      deviceLabel:
        String(req.headers['x-device-model'] ?? '').trim() || undefined,
      country: extractClientCountry(req) ?? undefined,
    };
  }

  private respondSession(
    req: Request,
    res: Response,
    session: Awaited<ReturnType<AuthService['loginWithAlternateMethod']>>,
  ) {
    setRefreshCookie(
      res,
      session.refreshToken,
      session.refreshMaxAgeSeconds,
      this.cookieSecure(),
    );
    return this.auth.toPublicSession(session, {
      includeRefreshToken: this.isMobileClient(req),
    });
  }

  private async resolveTenantId(req: Request): Promise<string> {
    let tenantId = this.cls.get<string>(CLS_TENANT_ID);
    if (!tenantId) {
      const loginHost =
        (req.headers['x-login-host'] as string | undefined)?.trim() ||
        extractRequestHost(req);
      try {
        const tenant = await this.tenantResolution.resolveHost(loginHost);
        tenantId = tenant.id;
      } catch {
        throw new UnauthorizedException('Institution not found');
      }
    }
    return tenantId;
  }

  @ApiBearerAuth()
  @Post('qr/issue')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async issueQr(@CurrentUser() user: JwtUser, @Body() dto: IssueQrLoginDto) {
    return this.qr.issue(user.tid, user.sub, {
      deviceHint: dto.deviceHint,
      createdById: user.sub,
    });
  }

  @Public()
  @Post('qr/redeem')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async redeemQr(
    @Body() dto: RedeemQrLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tenantId = await this.resolveTenantId(req);
    const session = await this.qr.redeem(
      tenantId,
      dto.token,
      this.mobileMeta(req),
    );
    return this.respondSession(req, res, session);
  }

  @Public()
  @Post('rfid/redeem')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async redeemRfid(
    @Body() dto: RedeemRfidLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tenantId = await this.resolveTenantId(req);
    const session = await this.rfid.redeem(
      tenantId,
      dto.cardUid,
      this.mobileMeta(req),
    );
    return this.respondSession(req, res, session);
  }
}
