import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import { CreateLicenseKeyDto } from '../dto/licensing.dto';
import { LicenseActivationKeyService } from '../services/license-activation-key.service';

@ApiBearerAuth()
@ApiTags('platform-license-keys')
@Controller({ path: 'platform/license-keys', version: '1' })
export class PlatformLicenseKeyController {
  constructor(private readonly keys: LicenseActivationKeyService) {}

  @Get()
  @RequireAnyPermission('platform:licenses:read', 'platform:licenses:manage')
  list(@Query('status') status?: string) {
    return this.keys.listKeys(status);
  }

  @Post()
  @RequirePermissions('platform:licenses:manage')
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateLicenseKeyDto) {
    return this.keys.createKeys(dto, user);
  }

  @Post(':id/revoke')
  @RequirePermissions('platform:licenses:manage')
  revoke(@Param('id') id: string) {
    return this.keys.revokeKey(id);
  }
}
