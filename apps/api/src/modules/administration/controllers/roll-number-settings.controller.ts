import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { UpdateRollNumberConfigDto } from '../dto/roll-number-settings.dto';
import { RollNumberSettingsService } from '../services/roll-number-settings.service';

@ApiBearerAuth()
@ApiTags('settings')
@Controller({ path: 'settings/roll-number-config', version: '1' })
export class RollNumberSettingsController {
  constructor(private readonly rollNumberSettings: RollNumberSettingsService) {}

  @Get()
  @RequirePermissions('lookups:read', 'students:manage')
  getConfig(@CurrentUser() user: JwtUser) {
    return this.rollNumberSettings.getConfig(user.tid);
  }

  @Patch()
  @RequirePermissions('lookups:manage', 'students:manage')
  updateConfig(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateRollNumberConfigDto,
  ) {
    return this.rollNumberSettings.updateConfig(user.tid, dto, user.sub);
  }

  @Get('sequences')
  @RequirePermissions('lookups:read', 'students:manage')
  getSequences(@CurrentUser() user: JwtUser) {
    return this.rollNumberSettings.getSequenceOverview(user.tid);
  }

  @Get('departments')
  @RequirePermissions('lookups:read', 'students:manage')
  getDepartmentMappings(@CurrentUser() user: JwtUser) {
    return this.rollNumberSettings.getDepartmentMappings(user.tid);
  }

  @Post('reset')
  @RequirePermissions('lookups:manage', 'students:manage')
  resetConfig(@CurrentUser() user: JwtUser) {
    return this.rollNumberSettings.resetConfig(user.tid, user.sub);
  }
}
