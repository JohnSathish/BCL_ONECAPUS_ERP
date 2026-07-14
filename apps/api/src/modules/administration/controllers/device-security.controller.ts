import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  CurrentUser,
  type JwtUser,
} from '../../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import {
  BlockDeviceDto,
  ListDeviceSessionsQueryDto,
  ListDevicesQueryDto,
  ListLoginHistoryQueryDto,
  ReportQueryDto,
  UpdateDevicePoliciesDto,
} from '../dto/device-security.dto';
import { DeviceSecurityService } from '../services/device-security.service';

@ApiBearerAuth()
@ApiTags('admin-device-security')
@Controller({ path: 'admin/device-security', version: '1' })
export class DeviceSecurityController {
  constructor(private readonly deviceSecurity: DeviceSecurityService) {}

  @Get('dashboard')
  @RequirePermissions('sessions:manage')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.deviceSecurity.dashboard(user.tid);
  }

  @Get('sessions')
  @RequirePermissions('sessions:manage')
  listSessions(
    @CurrentUser() user: JwtUser,
    @Query() query: ListDeviceSessionsQueryDto,
  ) {
    return this.deviceSecurity.listSessions(user.tid, query);
  }

  @Post('sessions/:id/revoke')
  @RequirePermissions('sessions:manage')
  revokeSession(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.deviceSecurity.revokeSession(user.tid, id, user.sub);
  }

  @Post('users/:userId/sessions/revoke-all')
  @RequirePermissions('sessions:manage')
  revokeAll(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    return this.deviceSecurity.revokeAllUserSessions(
      user.tid,
      userId,
      user.sub,
    );
  }

  @Get('login-history')
  @RequirePermissions('sessions:manage')
  loginHistory(
    @CurrentUser() user: JwtUser,
    @Query() query: ListLoginHistoryQueryDto,
  ) {
    return this.deviceSecurity.listLoginHistory(user.tid, query);
  }

  @Get('failed-logins')
  @RequirePermissions('sessions:manage')
  failedLogins(
    @CurrentUser() user: JwtUser,
    @Query() query: ListLoginHistoryQueryDto,
  ) {
    return this.deviceSecurity.listFailedLogins(user.tid, query);
  }

  @Get('devices')
  @RequirePermissions('sessions:manage')
  listDevices(
    @CurrentUser() user: JwtUser,
    @Query() query: ListDevicesQueryDto,
  ) {
    return this.deviceSecurity.listDevices(user.tid, query);
  }

  @Get('devices/:id')
  @RequirePermissions('sessions:manage')
  getDevice(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.deviceSecurity.getDevice(user.tid, id);
  }

  @Post('devices/:id/block')
  @RequirePermissions('sessions:manage')
  blockDevice(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: BlockDeviceDto,
  ) {
    return this.deviceSecurity.blockDevice(user.tid, id, user.sub, dto.reason);
  }

  @Post('devices/:id/unblock')
  @RequirePermissions('sessions:manage')
  unblockDevice(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.deviceSecurity.unblockDevice(user.tid, id, user.sub);
  }

  @Post('devices/:id/trust')
  @RequirePermissions('sessions:manage')
  trustDevice(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.deviceSecurity.trustDevice(user.tid, id, user.sub);
  }

  @Post('users/:userId/devices/clear-trusted')
  @RequirePermissions('sessions:manage')
  clearTrusted(@CurrentUser() user: JwtUser, @Param('userId') userId: string) {
    return this.deviceSecurity.clearTrusted(user.tid, userId, user.sub);
  }

  @Get('policies')
  @RequirePermissions('sessions:manage')
  getPolicies(@CurrentUser() user: JwtUser) {
    return this.deviceSecurity.getPolicies(user.tid);
  }

  @Patch('policies')
  @RequirePermissions('sessions:manage')
  updatePolicies(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateDevicePoliciesDto,
  ) {
    return this.deviceSecurity.updatePolicies(user.tid, dto, user.sub);
  }

  @Get('reports/devices.csv')
  @RequirePermissions('sessions:manage')
  async exportDevices(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.deviceSecurity.exportDevicesCsv(user.tid, query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="devices.csv"');
    res.send(csv);
  }

  @Get('reports/sessions.csv')
  @RequirePermissions('sessions:manage')
  async exportSessions(@CurrentUser() user: JwtUser, @Res() res: Response) {
    const csv = await this.deviceSecurity.exportSessionsCsv(user.tid);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="sessions.csv"');
    res.send(csv);
  }

  @Get('reports/failed-logins.csv')
  @RequirePermissions('sessions:manage')
  async exportFailed(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.deviceSecurity.exportFailedCsv(user.tid, query);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="failed-logins.csv"',
    );
    res.send(csv);
  }

  @Get('reports/login-activity.csv')
  @RequirePermissions('sessions:manage')
  async exportLoginActivity(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.deviceSecurity.exportLoginActivityCsv(
      user.tid,
      query,
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="login-activity.csv"',
    );
    res.send(csv);
  }
}
