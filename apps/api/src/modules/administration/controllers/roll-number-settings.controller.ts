import { Body, Controller, Get, Patch } from '@nestjs/common';
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
  @RequirePermissions('lookups:read')
  getConfig(@CurrentUser() user: JwtUser) {
    return this.rollNumberSettings.getConfig(user.tid);
  }

  @Patch()
  @RequirePermissions('lookups:manage')
  updateConfig(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateRollNumberConfigDto,
  ) {
    return this.rollNumberSettings.updateConfig(user.tid, dto, user.sub);
  }
}
