import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import { UpdateStudentDisplaySettingsDto } from '../dto/student-display-settings.dto';
import { StudentDisplaySettingsService } from '../services/student-display-settings.service';

@ApiBearerAuth()
@ApiTags('settings')
@Controller({ path: 'settings/student-display', version: '1' })
export class StudentDisplaySettingsController {
  constructor(private readonly settings: StudentDisplaySettingsService) {}

  @Get()
  @RequireAnyPermission(
    'lookups:read',
    'lookups:manage',
    'student:portal:self',
    'staff:portal:self',
  )
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.getSettings(user.tid);
  }

  @Patch()
  @RequirePermissions('lookups:manage')
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateStudentDisplaySettingsDto,
  ) {
    return this.settings.updateSettings(user.tid, dto);
  }
}
