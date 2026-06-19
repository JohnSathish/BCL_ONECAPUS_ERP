import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ClsService } from 'nestjs-cls';
import type { Request, Response } from 'express';
import { CLS_TENANT_ID } from '../../common/cls/cls.constants';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  extractClientIp,
  extractClientCountry,
  extractRequestHost,
} from '../../common/utils/request-host';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import {
  clearRefreshCookie,
  readRefreshTokenFromRequest,
  setRefreshCookie,
} from './auth-cookie.util';
import { AuthService } from './auth.service';
import { ChallengeService } from './challenge.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ChangePasswordDto,
} from './dto/password-reset.dto';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly challenge: ChallengeService,
    private readonly tenantResolution: TenantResolutionService,
    private readonly cls: ClsService,
    private readonly config: ConfigService,
  ) {}

  private cookieSecure(): boolean {
    const explicit = this.config.get<string>('COOKIE_SECURE');
    if (explicit !== undefined) return explicit === 'true';
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private applyRefreshCookie(
    res: Response,
    session: Awaited<ReturnType<AuthService['login']>>,
  ) {
    setRefreshCookie(
      res,
      session.refreshToken,
      session.refreshMaxAgeSeconds,
      this.cookieSecure(),
    );
  }

  private isMobileClient(req: Request): boolean {
    const header = String(req.headers['x-client-type'] ?? '').toLowerCase();
    const bodyType = (
      req.body as { clientType?: string } | undefined
    )?.clientType?.toLowerCase();
    return header === 'mobile' || bodyType === 'mobile';
  }

  private respondSession(
    req: Request,
    res: Response,
    session: Awaited<ReturnType<AuthService['login']>>,
  ) {
    this.applyRefreshCookie(res, session);
    return this.auth.toPublicSession(session, {
      includeRefreshToken: this.isMobileClient(req),
    });
  }

  private mobileMeta(req: Request) {
    if (!this.isMobileClient(req)) return undefined;
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

  @Public()
  @Get('context')
  getContext(@Req() req: Request) {
    const host = extractRequestHost(req);
    return this.tenantResolution.getLoginContext(host);
  }

  @Public()
  @Get('challenge')
  getChallenge() {
    return this.challenge.createChallenge();
  }

  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    let tenantId = this.cls.get<string>(CLS_TENANT_ID);
    if (!tenantId) {
      const loginHost =
        (req.headers['x-login-host'] as string | undefined)?.trim() ||
        extractRequestHost(req);
      try {
        const tenant = await this.tenantResolution.resolveHost(loginHost);
        tenantId = tenant.id;
      } catch {
        throw new UnauthorizedException('Invalid credentials');
      }
    }
    const session = await this.auth.login(
      tenantId,
      dto.email,
      dto.password,
      dto.challengeToken,
      dto.challengeAnswer,
      this.mobileMeta(req) ?? {
        userAgent: req.headers['user-agent'],
        ipAddress: extractClientIp(req),
        country: extractClientCountry(req) ?? undefined,
      },
      dto.rememberMe,
    );
    if ('mfaRequired' in session && session.mfaRequired) {
      return session;
    }
    return this.respondSession(req, res, session);
  }

  @Public()
  @Post('refresh')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = readRefreshTokenFromRequest(
      req.cookies as Record<string, string | undefined>,
      dto.refreshToken,
    );
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const session = await this.auth.refresh(refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: extractClientIp(req),
      ...(this.isMobileClient(req)
        ? {
            clientType: 'mobile',
            appType: String(req.headers['x-app-type'] ?? 'student'),
            appVersion:
              String(req.headers['x-app-version'] ?? '').trim() || undefined,
          }
        : {}),
    });
    return this.respondSession(req, res, session);
  }

  @Public()
  @Post('logout')
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = readRefreshTokenFromRequest(
      req.cookies as Record<string, string | undefined>,
      dto.refreshToken,
    );
    clearRefreshCookie(res, this.cookieSecure());
    return this.auth.logout(refreshToken, {
      ipAddress: extractClientIp(req),
    });
  }

  @Post('permissions/refresh')
  async refreshPermissions(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.auth.refreshPermissions(user.sub, {
      userAgent: req.headers['user-agent'],
      ipAddress: extractClientIp(req),
    });
    return this.respondSession(req, res, session);
  }

  @Post('change-password')
  async changePassword(
    @CurrentUser() user: JwtUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException(
        'New password and confirmation do not match',
      );
    }
    await this.auth.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    clearRefreshCookie(res, this.cookieSecure());
    return { success: true };
  }

  @Post('sessions/revoke-all')
  async revokeAllSessions(
    @CurrentUser() user: JwtUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.revokeAllSessionsForUser(user.sub);
    clearRefreshCookie(res, this.cookieSecure());
    return { success: true };
  }

  @Public()
  @Post('password-reset/request')
  requestReset(@Body() dto: RequestPasswordResetDto, @Req() req: Request) {
    const tenantId = this.cls.get<string>(CLS_TENANT_ID);
    if (!tenantId) return { accepted: true };
    return this.auth.requestPasswordReset(tenantId, dto.email);
  }

  @Public()
  @Post('password-reset/confirm')
  async confirmReset(@Body() dto: ResetPasswordDto) {
    const result = await this.auth.resetPassword(dto.token, dto.newPassword);
    return result;
  }

  @Public()
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }
}
