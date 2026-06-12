import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { PayrollSettingsDto } from './dto/payroll.dto';
import { PayrollSettingsService } from './services/payroll-settings.service';

@ApiBearerAuth()
@ApiTags('payroll-settings')
@Controller({ path: 'payroll/settings', version: '1' })
export class PayrollSettingsController {
  constructor(private readonly settings: PayrollSettingsService) {}

  @Get()
  @RequireAnyPermission('payroll:read', 'payroll:manage')
  get(@CurrentUser() user: JwtUser) {
    return this.settings.get(user.tid);
  }

  @Patch()
  @RequirePermissions('payroll:manage')
  upsert(@CurrentUser() user: JwtUser, @Body() dto: PayrollSettingsDto) {
    return this.settings.upsert(user.tid, dto);
  }
}
