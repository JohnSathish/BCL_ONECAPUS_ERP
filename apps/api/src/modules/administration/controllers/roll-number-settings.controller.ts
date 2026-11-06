import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import {
  UpdateDepartmentRollRangesDto,
  UpdateRollNumberConfigDto,
} from '../dto/roll-number-settings.dto';
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

  @Get('department-ranges')
  @RequirePermissions('lookups:read', 'students:manage')
  getDepartmentRollRanges(
    @CurrentUser() user: JwtUser,
    @Query('admissionYear') admissionYear?: string,
  ) {
    const year = Number(admissionYear);
    return this.rollNumberSettings.getDepartmentRollRanges(
      user.tid,
      Number.isFinite(year) && year > 2000 ? year : undefined,
    );
  }

  @Patch('department-ranges')
  @RequirePermissions('lookups:manage', 'students:manage')
  saveDepartmentRollRanges(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateDepartmentRollRangesDto,
  ) {
    return this.rollNumberSettings.saveDepartmentRollRanges(
      user.tid,
      dto,
      user.sub,
    );
  }

  @Post('reset')
  @RequirePermissions('lookups:manage', 'students:manage')
  resetConfig(@CurrentUser() user: JwtUser) {
    return this.rollNumberSettings.resetConfig(user.tid, user.sub);
  }
}
