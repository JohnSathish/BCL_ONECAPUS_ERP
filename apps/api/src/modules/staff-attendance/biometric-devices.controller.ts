import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import {
  DeviceConfigDto,
  MiddlewareIngestDto,
  PushUsersDto,
  SyncDeviceDto,
} from './dto/staff-attendance.dto';
import { DeviceHealthService } from './device-health.service';
import { StaffAttendanceService } from './staff-attendance.service';

@ApiBearerAuth()
@ApiTags('staff-biometric-devices')
@Controller({ path: 'staff/attendance/biometric-devices', version: '1' })
export class BiometricDevicesController {
  constructor(
    private readonly service: StaffAttendanceService,
    private readonly health: DeviceHealthService,
  ) {}

  @Get()
  @RequireAnyPermission('staff-biometric:admin', 'staff-biometric:device-admin')
  list(@CurrentUser() user: JwtUser) {
    return this.service.listDevices(user.tid);
  }

  @Post()
  @RequirePermissions('staff-biometric:device-admin')
  create(@CurrentUser() user: JwtUser, @Body() dto: DeviceConfigDto) {
    return this.service.createDevice(user, dto);
  }

  @Patch(':id')
  @RequirePermissions('staff-biometric:device-admin')
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: DeviceConfigDto,
  ) {
    return this.service.updateDevice(user, id, dto);
  }

  @Delete(':id')
  @RequirePermissions('staff-biometric:device-admin')
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.deleteDevice(user, id);
  }

  @Post(':id/test')
  @RequireAnyPermission('staff-biometric:admin', 'staff-biometric:device-admin')
  test(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.health.runDiagnostic(user, id, 'full');
  }

  @Post(':id/test/:test')
  @RequireAnyPermission('staff-biometric:admin', 'staff-biometric:device-admin')
  testStep(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('test') test: string,
  ) {
    return this.health.runDiagnostic(user, id, test);
  }

  @Post(':id/sync')
  @RequireAnyPermission('staff-biometric:sync', 'staff-biometric:device-admin')
  sync(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SyncDeviceDto,
  ) {
    return this.service.syncDevice(user, id, dto);
  }

  @Post(':id/push-users')
  @RequireAnyPermission('staff-biometric:sync', 'staff-biometric:device-admin')
  pushUsers(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: PushUsersDto,
  ) {
    return this.service.pushUsers(user, id, dto);
  }

  @Post(':id/push-users/preview')
  @RequireAnyPermission('staff-biometric:sync', 'staff-biometric:device-admin')
  previewPushUsers(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: PushUsersDto,
  ) {
    return this.service.previewPushUsers(user, id, dto);
  }

  @Get(':id/users')
  @RequireAnyPermission(
    'staff-biometric:admin',
    'staff-biometric:device-admin',
    'staff-attendance:view',
  )
  pullDeviceUsers(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.pullDeviceUsers(user, id);
  }

  @Post('middleware/ingest')
  @RequireAnyPermission('staff-biometric:sync', 'staff-biometric:device-admin')
  ingest(@CurrentUser() user: JwtUser, @Body() dto: MiddlewareIngestDto) {
    return this.service.ingestMiddleware(user, dto);
  }
}
