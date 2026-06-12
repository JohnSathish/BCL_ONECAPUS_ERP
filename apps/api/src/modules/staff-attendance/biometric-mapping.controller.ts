import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { MappingDto } from './dto/staff-attendance.dto';
import { StaffAttendanceService } from './staff-attendance.service';

@ApiBearerAuth()
@ApiTags('staff-biometric-mapping')
@Controller({ path: 'staff/attendance/biometric-mappings', version: '1' })
export class BiometricMappingController {
  constructor(private readonly service: StaffAttendanceService) {}

  @Get()
  @RequireAnyPermission('staff-biometric:admin', 'staff-attendance:view')
  list(@CurrentUser() user: JwtUser) {
    return this.service.listMappings(user.tid);
  }

  @Post()
  @RequireAnyPermission('staff-biometric:admin', 'staff-biometric:device-admin')
  upsert(@CurrentUser() user: JwtUser, @Body() dto: MappingDto) {
    return this.service.upsertMapping(user, dto);
  }

  @Post('auto-map')
  @RequireAnyPermission('staff-biometric:admin', 'staff-biometric:device-admin')
  autoMap(@CurrentUser() user: JwtUser, @Body() dto?: { deviceId?: string }) {
    return this.service.autoMap(user, dto);
  }
}
