import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import { ApproveLeaveDto } from '../hr/dto/leave.dto';
import { LeaveService } from '../hr/services/leave.service';
import { NaacDashboardService } from '../naac-iqac/services/naac-dashboard.service';
import { GovernanceDashboardService } from '../governance/services/governance-dashboard.service';
import { GovernanceCommitteeService } from '../governance/services/governance-committee.service';
import { StudentLeaveService } from '../students/services/student-leave.service';
import { PrincipalAttendanceControlService } from './services/principal-attendance-control.service';
import { PrincipalDeskDashboardService } from './services/principal-desk-dashboard.service';
import { PrincipalFeeDefaulterService } from './services/principal-fee-defaulter.service';
import { PrincipalInstitutionalHealthService } from './services/principal-institutional-health.service';
import { PrincipalStaffCommandService } from './services/principal-staff-command.service';
import { PrincipalStudentCommandService } from './services/principal-student-command.service';

@ApiBearerAuth()
@ApiTags('principal-desk')
@RequireAnyPermission('principal-desk:access')
@Controller({ path: 'principal-desk', version: '1' })
export class PrincipalDeskController {
  constructor(
    private readonly dashboardSvc: PrincipalDeskDashboardService,
    private readonly studentCommandSvc: PrincipalStudentCommandService,
    private readonly staffCommandSvc: PrincipalStaffCommandService,
    private readonly attendanceControlSvc: PrincipalAttendanceControlService,
    private readonly feeDefaultersSvc: PrincipalFeeDefaulterService,
    private readonly institutionalHealthSvc: PrincipalInstitutionalHealthService,
    private readonly leave: LeaveService,
    private readonly studentLeave: StudentLeaveService,
    private readonly naac: NaacDashboardService,
    private readonly governance: GovernanceDashboardService,
    private readonly committees: GovernanceCommitteeService,
  ) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboardSvc.getDashboard(user);
  }

  @Get('student-command')
  studentCommandLookup(@CurrentUser() user: JwtUser, @Query('q') q: string) {
    return this.studentCommandSvc.resolve(user.tid, q);
  }

  @Get('staff-command')
  staffCommandLookup(@CurrentUser() user: JwtUser, @Query('q') q: string) {
    return this.staffCommandSvc.resolve(user.tid, q);
  }

  @Get('attendance-control')
  attendanceControl(@CurrentUser() user: JwtUser) {
    return this.attendanceControlSvc.getControlCenter(user.tid);
  }

  @Get('fee-defaulters')
  feeDefaulters(
    @CurrentUser() user: JwtUser,
    @Query('departmentId') departmentId?: string,
    @Query('semesterNo') semesterNo?: string,
    @Query('shiftId') shiftId?: string,
  ) {
    return this.feeDefaultersSvc.getMonitor(user.tid, {
      departmentId,
      semesterNo: semesterNo ? Number(semesterNo) : undefined,
      shiftId,
    });
  }

  @Get('institutional-health')
  institutionalHealth(@CurrentUser() user: JwtUser) {
    return this.institutionalHealthSvc.getHealth(user.tid);
  }

  @Get('naac-readiness')
  naacReadiness(@CurrentUser() user: JwtUser) {
    return this.naac.dashboard(user.tid);
  }

  @Get('committees')
  committeeMonitor(@CurrentUser() user: JwtUser) {
    return this.governance.dashboard(user.tid);
  }

  @Get('committees/list')
  listCommittees(@CurrentUser() user: JwtUser) {
    return this.committees.list(user.tid, { page: 1, limit: 50 });
  }

  @Get('leave/applications')
  leaveApplications(
    @CurrentUser() user: JwtUser,
    @Query('type') type?: 'staff' | 'student' | 'all',
  ) {
    return this.listLeaveApplications(user, type ?? 'all');
  }

  @Patch('leave/staff/:id/approve')
  @RequireAnyPermission('principal-desk:access', 'staff-attendance:leave-admin')
  approveStaffLeave(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.leave.approve(user, id, dto);
  }

  @Patch('leave/student/:id/approve')
  approveStudentLeave(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.studentLeave.approve(user, id, dto);
  }

  private async listLeaveApplications(
    user: JwtUser,
    type: 'staff' | 'student' | 'all',
  ) {
    const [staff, student] = await Promise.all([
      type === 'student'
        ? Promise.resolve([])
        : this.leave.listApplications(user.tid, { status: 'PENDING' }),
      type === 'staff'
        ? Promise.resolve([])
        : this.studentLeave.listPending(user.tid),
    ]);
    return { staff, student, total: staff.length + student.length };
  }
}
