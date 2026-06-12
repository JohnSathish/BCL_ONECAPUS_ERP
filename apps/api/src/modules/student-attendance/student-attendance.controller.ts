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
  AttendanceCorrectionDto,
  AttendanceEligibilityQueryDto,
  AttendanceSessionQueryDto,
  CreateExtraAttendanceSessionDto,
  GenerateAttendanceSessionsDto,
  MarkAttendanceDto,
} from './dto/student-attendance.dto';
import { StudentAttendanceService } from './student-attendance.service';

@ApiBearerAuth()
@ApiTags('student-attendance')
@Controller({ path: 'student-attendance', version: '1' })
export class StudentAttendanceController {
  constructor(private readonly service: StudentAttendanceService) {}

  @Get('dashboard')
  @RequireAnyPermission('student-attendance:view', 'student-attendance:admin')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.service.dashboard(user.tid);
  }

  @Get('sessions')
  @RequireAnyPermission(
    'student-attendance:view',
    'student-attendance:mark',
    'student-attendance:admin',
  )
  sessions(
    @CurrentUser() user: JwtUser,
    @Query() query: AttendanceSessionQueryDto,
  ) {
    return this.service.listSessions(user.tid, query);
  }

  @Post('sessions/generate')
  @RequireAnyPermission('student-attendance:admin', 'student-attendance:manage')
  generate(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateAttendanceSessionsDto,
  ) {
    return this.service.generateFromTimetable(user, dto);
  }

  @Post('sessions/extra')
  @RequireAnyPermission(
    'student-attendance:admin',
    'student-attendance:manage',
    'student-attendance:mark',
  )
  extraSession(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateExtraAttendanceSessionDto,
  ) {
    return this.service.createExtraSession(user, dto);
  }

  @Get('faculty/today')
  @RequireAnyPermission('student-attendance:mark', 'staff:portal:self')
  facultyToday(@CurrentUser() user: JwtUser) {
    return this.service.facultyToday(user);
  }

  @Get('sessions/:id/roster')
  @RequireAnyPermission(
    'student-attendance:view',
    'student-attendance:mark',
    'staff:portal:self',
  )
  roster(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.roster(user.tid, id);
  }

  @Post('sessions/:id/mark')
  @RequireAnyPermission('student-attendance:mark', 'student-attendance:admin')
  mark(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.service.markSession(user, id, dto);
  }

  @Post('sessions/:id/corrections')
  @RequireAnyPermission(
    'student-attendance:correct',
    'student-attendance:admin',
  )
  correct(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AttendanceCorrectionDto,
  ) {
    return this.service.correctSession(user, id, dto);
  }

  @Post('sessions/:id/lock')
  @RequireAnyPermission('student-attendance:admin', 'student-attendance:manage')
  lock(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.lockSession(user, id, 'LOCKED');
  }

  @Post('sessions/:id/freeze')
  @RequirePermissions('student-attendance:admin')
  freeze(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.lockSession(user, id, 'FROZEN');
  }

  @Post('sessions/:id/reopen')
  @RequirePermissions('student-attendance:admin')
  reopen(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.service.lockSession(user, id, 'OPEN');
  }

  @Get('summaries')
  @RequireAnyPermission('student-attendance:view', 'student-attendance:reports')
  summaries(
    @CurrentUser() user: JwtUser,
    @Query() query: AttendanceEligibilityQueryDto,
  ) {
    return this.service.summaries(user.tid, query);
  }

  @Post('eligibility/recalculate')
  @RequireAnyPermission(
    'student-attendance:admin',
    'student-attendance:reports',
  )
  eligibility(
    @CurrentUser() user: JwtUser,
    @Body() query: AttendanceEligibilityQueryDto,
  ) {
    return this.service.eligibility(user, query);
  }

  @Get('reports/:type')
  @RequireAnyPermission('student-attendance:view', 'student-attendance:reports')
  reports(
    @CurrentUser() user: JwtUser,
    @Param('type') type: string,
    @Query() query: AttendanceSessionQueryDto,
  ) {
    return this.service.reports(user.tid, type, query);
  }

  @Get('portal/me')
  @RequireAnyPermission('student:portal:self', 'student-attendance:view')
  portalMe(@CurrentUser() user: JwtUser) {
    return this.service.studentPortalSummary(user);
  }
}
