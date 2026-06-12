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
  AttendanceMasterSettingsDto,
  AttendanceReprocessDto,
  AttendanceSettingsRecordDto,
} from './dto/staff-attendance.dto';
import { AttendanceSettingsService } from './attendance-settings.service';

@ApiBearerAuth()
@ApiTags('staff-attendance-settings')
@Controller({ path: 'staff/attendance/settings', version: '1' })
export class AttendanceSettingsController {
  constructor(private readonly service: AttendanceSettingsService) {}

  @Get()
  @RequireAnyPermission(
    'staff-attendance:settings:view',
    'staff-attendance:view',
    'staff-attendance:edit',
  )
  overview(@CurrentUser() user: JwtUser) {
    return this.service.overview(user.tid);
  }

  @Post('seed-defaults')
  @RequireAnyPermission(
    'staff-attendance:settings:edit',
    'staff-attendance:edit',
  )
  seedDefaults(@CurrentUser() user: JwtUser) {
    return this.service.seedDefaults(user);
  }

  @Get('master')
  @RequireAnyPermission(
    'staff-attendance:settings:view',
    'staff-attendance:view',
    'staff-attendance:edit',
  )
  master(@CurrentUser() user: JwtUser) {
    return this.service.getMaster(user.tid);
  }

  @Patch('master')
  @RequireAnyPermission(
    'staff-attendance:settings:edit',
    'staff-attendance:edit',
  )
  updateMaster(
    @CurrentUser() user: JwtUser,
    @Body() dto: AttendanceMasterSettingsDto,
  ) {
    return this.service.updateMaster(user, dto);
  }

  @Post('reprocess')
  @RequireAnyPermission('staff-attendance:reprocess', 'staff-attendance:edit')
  reprocess(@CurrentUser() user: JwtUser, @Body() dto: AttendanceReprocessDto) {
    return this.service.reprocess(user, dto);
  }

  @Get(':resource')
  @RequireAnyPermission(
    'staff-attendance:settings:view',
    'staff-attendance:view',
    'staff-attendance:edit',
  )
  list(@CurrentUser() user: JwtUser, @Param('resource') resource: string) {
    return this.service.list(user.tid, resource);
  }

  @Post(':resource')
  @RequireAnyPermission(
    'staff-attendance:settings:edit',
    'staff-attendance:edit',
  )
  create(
    @CurrentUser() user: JwtUser,
    @Param('resource') resource: string,
    @Body() dto: AttendanceSettingsRecordDto,
  ) {
    return this.service.create(user, resource, dto);
  }

  @Patch(':resource/:id')
  @RequireAnyPermission(
    'staff-attendance:settings:edit',
    'staff-attendance:edit',
  )
  update(
    @CurrentUser() user: JwtUser,
    @Param('resource') resource: string,
    @Param('id') id: string,
    @Body() dto: AttendanceSettingsRecordDto,
  ) {
    return this.service.update(user, resource, id, dto);
  }

  @Delete(':resource/:id')
  @RequirePermissions('staff-attendance:settings:edit')
  remove(
    @CurrentUser() user: JwtUser,
    @Param('resource') resource: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(user, resource, id);
  }
}
