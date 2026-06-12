import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
  AttendanceQueryDto,
  AttendanceRuleDto,
  CorrectionDto,
} from './dto/staff-attendance.dto';
import { StaffAttendanceService } from './staff-attendance.service';

@ApiBearerAuth()
@ApiTags('staff-attendance')
@Controller({ path: 'staff/attendance', version: '1' })
export class StaffAttendanceController {
  constructor(private readonly service: StaffAttendanceService) {}

  @Get('dashboard')
  @RequireAnyPermission('staff-attendance:view', 'staff-biometric:admin')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.service.dashboard(user.tid);
  }

  @Get('live')
  @RequireAnyPermission('staff-attendance:view', 'staff-biometric:admin')
  live(@CurrentUser() user: JwtUser, @Query() query: AttendanceQueryDto) {
    return this.service.liveAttendance(user.tid, query);
  }

  @Get('daily')
  @RequireAnyPermission('staff-attendance:view', 'staff-attendance:reports')
  daily(@CurrentUser() user: JwtUser, @Query() query: AttendanceQueryDto) {
    return this.service.dailyRegister(user.tid, query);
  }

  @Get('monthly')
  @RequireAnyPermission('staff-attendance:view', 'staff-attendance:reports')
  monthly(@CurrentUser() user: JwtUser, @Query() query: AttendanceQueryDto) {
    return this.service.monthlySummary(user.tid, query);
  }

  @Get('raw-logs')
  @RequireAnyPermission('staff-attendance:view', 'staff-biometric:admin')
  rawLogs(@CurrentUser() user: JwtUser, @Query() query: AttendanceQueryDto) {
    return this.service.rawLogs(user.tid, query);
  }

  @Get('sync-batches')
  @RequireAnyPermission('staff-biometric:sync', 'staff-biometric:admin')
  syncBatches(@CurrentUser() user: JwtUser) {
    return this.service.syncBatches(user.tid);
  }

  @Get('rules')
  @RequireAnyPermission('staff-attendance:view', 'staff-attendance:edit')
  rules(@CurrentUser() user: JwtUser) {
    return this.service.rules(user.tid);
  }

  @Post('rules')
  @RequirePermissions('staff-attendance:edit')
  createRule(@CurrentUser() user: JwtUser, @Body() dto: AttendanceRuleDto) {
    return this.service.createRule(user, dto);
  }

  @Get('corrections')
  @RequireAnyPermission('staff-attendance:view', 'staff-attendance:edit')
  corrections(@CurrentUser() user: JwtUser) {
    return this.service.corrections(user.tid);
  }

  @Post('corrections')
  @RequireAnyPermission(
    'staff-attendance:edit',
    'staff-attendance:corrections:approve',
  )
  requestCorrection(@CurrentUser() user: JwtUser, @Body() dto: CorrectionDto) {
    return this.service.requestCorrection(user, dto);
  }

  @Post('corrections/:id/approve')
  @RequirePermissions('staff-attendance:corrections:approve')
  approveCorrection(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.approveCorrection(user, id);
  }

  @Get('reports/:type')
  @RequireAnyPermission('staff-attendance:reports', 'staff-attendance:view')
  report(
    @CurrentUser() user: JwtUser,
    @Param('type') type: string,
    @Query() query: AttendanceQueryDto,
  ) {
    return this.service.report(user.tid, type, query);
  }

  @Post('process-pending')
  @RequireAnyPermission(
    'staff-attendance:edit',
    'staff-attendance:reprocess',
    'staff-biometric:admin',
  )
  processPending(@CurrentUser() user: JwtUser) {
    return this.service.processPendingAttendance(user);
  }

  @Get('audit-logs')
  @RequireAnyPermission('staff-biometric:admin', 'staff-attendance:edit')
  auditLogs(@CurrentUser() user: JwtUser) {
    return this.service.auditLogs(user.tid);
  }

  @Get('staff/:staffProfileId/summary')
  @RequireAnyPermission('staff-attendance:view', 'staff:read')
  profileSummary(
    @CurrentUser() user: JwtUser,
    @Param('staffProfileId') staffProfileId: string,
  ) {
    return this.service.profileSummary(user.tid, staffProfileId);
  }
}
