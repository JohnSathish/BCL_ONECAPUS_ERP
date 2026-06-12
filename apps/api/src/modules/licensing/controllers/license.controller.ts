import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../../common/decorators/require-permissions.decorator';
import { ActivateLicenseKeyDto } from '../dto/licensing.dto';
import { LicenseActivationKeyService } from '../services/license-activation-key.service';
import { LicenseService } from '../services/license.service';

@ApiBearerAuth()
@ApiTags('license')
@Controller({ path: 'license', version: '1' })
export class LicenseController {
  constructor(
    private readonly license: LicenseService,
    private readonly activationKeys: LicenseActivationKeyService,
  ) {}

  @Get('summary')
  @RequireAnyPermission('license:read', 'tenant:manage', 'users:manage')
  summary(@CurrentUser() user: JwtUser) {
    return this.license.getSummary(user.tid);
  }

  @Get('details')
  @RequireAnyPermission('license:read', 'tenant:manage', 'users:manage')
  details(@CurrentUser() user: JwtUser) {
    return this.license.getDetails(user.tid);
  }

  @Get('renewal-contact')
  renewalContact() {
    return this.license.getRenewalContact();
  }

  @Post('activate-key')
  @RequireAnyPermission('license:activate', 'tenant:manage', 'users:manage')
  activateKey(
    @CurrentUser() user: JwtUser,
    @Body() dto: ActivateLicenseKeyDto,
  ) {
    return this.activationKeys.redeemKey(user.tid, user, dto);
  }
}
