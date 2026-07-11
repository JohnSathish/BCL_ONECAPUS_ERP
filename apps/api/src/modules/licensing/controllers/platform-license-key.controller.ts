import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import {
  CreateLicenseKeyDto,
  IngestLicenseKeysDto,
} from '../dto/licensing.dto';
import { LicenseSyncSecretGuard } from '../guards/license-sync-secret.guard';
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

  /** Service-to-service ingest from BaseCode Labs website. */
  @Public()
  @UseGuards(LicenseSyncSecretGuard)
  @ApiHeader({ name: 'X-BCL-License-Sync-Secret', required: true })
  @Post('ingest')
  ingest(@Body() dto: IngestLicenseKeysDto) {
    return this.keys.ingestKeys(dto);
  }

  /** Service-to-service revoke by activation key string. */
  @Public()
  @UseGuards(LicenseSyncSecretGuard)
  @ApiHeader({ name: 'X-BCL-License-Sync-Secret', required: true })
  @Post('revoke-by-key')
  revokeByKey(@Body() body: { activationKey: string }) {
    return this.keys.revokeByActivationKey(body.activationKey);
  }

  @Post(':id/revoke')
  @RequirePermissions('platform:licenses:manage')
  revoke(@Param('id') id: string) {
    return this.keys.revokeKey(id);
  }
}
