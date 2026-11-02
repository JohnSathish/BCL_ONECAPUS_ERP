import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { extractClientIp } from '../../../common/utils/request-host';
import { AuthService } from '../auth.service';
import {
  ADMIN_TRUST_COOKIE,
  adminTrustCookieOptions,
  clearAdminTrustCookie,
  readAdminTrustToken,
  setRefreshCookie,
} from '../auth-cookie.util';
import { AdminEmailOtpService } from './admin-email-otp.service';

class VerifyAdminEmailOtpDto {
  @IsUUID()
  challengeId!: string;

  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;

  @IsOptional()
  @IsBoolean()
  trustDevice?: boolean;
}

class ResendAdminEmailOtpDto {
  @IsUUID()
  challengeId!: string;
}

@ApiTags('auth-admin-email-otp')
@Controller({ path: 'auth/admin-email-otp', version: '1' })
export class AdminEmailOtpController {
  constructor(
    private readonly otp: AdminEmailOtpService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('verify')
  @Throttle({ default: { limit: 15, ttl: 900_000 } })
  async verify(
    @Body() dto: VerifyAdminEmailOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pending = await this.otp.verify(dto.challengeId, dto.code);
    const session = await this.auth.completeMfaLogin(
      pending.userId,
      pending.tenantId,
      pending.rememberMe,
      pending.meta,
    );
    setRefreshCookie(
      res,
      session.refreshToken,
      session.refreshMaxAgeSeconds,
      this.cookieSecure(),
    );
    if (dto.trustDevice) {
      const token = await this.otp.trustCurrentDevice({
        tenantId: pending.tenantId,
        userId: pending.userId,
        userAgent: req.headers['user-agent'],
        ipAddress: extractClientIp(req),
      });
      res.cookie(
        ADMIN_TRUST_COOKIE,
        token,
        adminTrustCookieOptions(this.cookieSecure()),
      );
    }
    return this.auth.toPublicSession(session, {
      includeRefreshToken: this.isMobileClient(req),
    });
  }

  @Public()
  @Post('resend')
  @Throttle({ default: { limit: 8, ttl: 900_000 } })
  resend(@Body() dto: ResendAdminEmailOtpDto) {
    return this.otp.resend(dto.challengeId);
  }

  @ApiBearerAuth()
  @Get('devices')
  listDevices(@CurrentUser() user: JwtUser, @Req() req: Request) {
    return this.otp.listTrustedDevices(
      user.tid,
      user.sub,
      readAdminTrustToken(req.cookies as Record<string, string | undefined>),
    );
  }

  @ApiBearerAuth()
  @Delete('devices/:id')
  revokeDevice(
    @CurrentUser() user: JwtUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.revokeAndMaybeClearCookie(user, id, req, res);
  }

  @ApiBearerAuth()
  @Post('devices/revoke-all')
  async revokeAll(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.otp.revokeAllTrustedDevices(user.tid, user.sub);
    clearAdminTrustCookie(res, this.cookieSecure());
    return result;
  }

  private async revokeAndMaybeClearCookie(
    user: JwtUser,
    deviceId: string,
    req: Request,
    res: Response,
  ) {
    const current = readAdminTrustToken(
      req.cookies as Record<string, string | undefined>,
    );
    const listed = current
      ? await this.otp.listTrustedDevices(user.tid, user.sub, current)
      : null;
    const removingCurrent = listed?.items.some(
      (item) => item.id === deviceId && item.current,
    );
    const result = await this.otp.revokeTrustedDevice(
      user.tid,
      user.sub,
      deviceId,
    );
    if (removingCurrent) clearAdminTrustCookie(res, this.cookieSecure());
    return result;
  }

  private cookieSecure() {
    const explicit = this.config.get<string>('COOKIE_SECURE');
    if (explicit !== undefined) return explicit === 'true';
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private isMobileClient(req: Request) {
    const header = String(req.headers['x-client-type'] ?? '').toLowerCase();
    const bodyType = (
      req.body as { clientType?: string } | undefined
    )?.clientType?.toLowerCase();
    return header === 'mobile' || bodyType === 'mobile';
  }
}
