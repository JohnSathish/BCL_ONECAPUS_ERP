import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { MfaService } from './mfa.service';
import { AuthService } from '../auth.service';
import { IsString, Length } from 'class-validator';

class MfaCodeDto {
  @IsString()
  @Length(4, 12)
  code!: string;
}

class MfaLoginDto {
  @IsString()
  mfaToken!: string;

  @IsString()
  @Length(4, 12)
  code!: string;

  method?: 'totp' | 'email' | 'recovery';
}

class MfaPasswordDto {
  @IsString()
  password!: string;
}

@ApiTags('auth-mfa')
@Controller({ path: 'auth/mfa', version: '1' })
export class MfaController {
  constructor(
    private readonly mfa: MfaService,
    private readonly auth: AuthService,
  ) {}

  @ApiBearerAuth()
  @Get('status')
  status(@CurrentUser() user: JwtUser) {
    return this.mfa.status(user.sub);
  }

  @ApiBearerAuth()
  @Post('setup')
  setup(@CurrentUser() user: JwtUser) {
    return this.mfa.setup(user.sub, user.email);
  }

  @ApiBearerAuth()
  @Post('verify-setup')
  verifySetup(@CurrentUser() user: JwtUser, @Body() dto: MfaCodeDto) {
    return this.mfa.verifySetup(user.sub, dto.code);
  }

  @ApiBearerAuth()
  @Post('disable')
  disable(@CurrentUser() user: JwtUser, @Body() dto: MfaPasswordDto) {
    return this.mfa.disable(user.sub, dto.password);
  }

  @ApiBearerAuth()
  @Post('email-otp/send')
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  sendEmailOtp(@CurrentUser() user: JwtUser) {
    return this.mfa.sendEmailOtp(user.sub, user.email);
  }

  @Public()
  @Post('verify-login')
  @Throttle({ default: { limit: 3, ttl: 900_000 } })
  async verifyLogin(@Body() dto: MfaLoginDto) {
    const pending = await this.mfa.resolvePendingLogin(dto.mfaToken);
    if (!pending) throw new BadRequestException('MFA session expired');

    const method = dto.method ?? 'totp';
    let ok = false;
    if (method === 'email') {
      ok = await this.mfa.verifyEmailOtp(pending.userId, dto.code);
    } else if (method === 'recovery') {
      ok = await this.mfa.verifyRecoveryCode(pending.userId, dto.code);
    } else {
      ok = await this.mfa.verifyTotp(pending.userId, dto.code);
    }
    if (!ok) throw new BadRequestException('Invalid MFA code');

    await this.mfa.clearPendingLogin(dto.mfaToken);
    return this.auth.completeMfaLogin(
      pending.userId,
      pending.tenantId,
      pending.rememberMe,
      pending.meta as {
        userAgent?: string;
        ipAddress?: string;
        clientType?: string;
        appType?: string;
        appVersion?: string;
        deviceId?: string;
        deviceLabel?: string;
      },
    );
  }
}
