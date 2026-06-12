import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
  ApproveLeaveDto,
  CreateLeaveApplicationDto,
  InitializeLeaveBalancesDto,
  PortalCreateLeaveDto,
} from './dto/leave.dto';
import {
  AcceptOfferDto,
  CreateInterviewDto,
  CreateOfferDto,
  CreateRecruitmentApplicationDto,
  CreateVacancyDto,
  UpdateVacancyStatusDto,
} from './dto/recruitment.dto';
import {
  CreatePensionEnrollmentDto,
  RecordPensionAccrualDto,
} from './dto/pension.dto';
import {
  CreateAppraisalCycleDto,
  ScoreAppraisalDto,
} from './dto/appraisal.dto';
import { LeaveService } from './services/leave.service';
import { RecruitmentService } from './services/recruitment.service';
import { PensionService } from './services/pension.service';
import { AppraisalService } from './services/appraisal.service';

@ApiBearerAuth()
@ApiTags('hr')
@Controller({ path: 'hr', version: '1' })
export class HrController {
  constructor(
    private readonly leave: LeaveService,
    private readonly recruitment: RecruitmentService,
    private readonly pension: PensionService,
    private readonly appraisal: AppraisalService,
  ) {}

  // Leave
  @Get('leave/balances')
  @RequireAnyPermission(
    'payroll:read',
    'staff:read',
    'staff-attendance:leave-admin',
  )
  leaveBalances(
    @CurrentUser() user: JwtUser,
    @Query('staffProfileId') staffProfileId?: string,
    @Query('year') year?: string,
  ) {
    return this.leave.listBalances(
      user.tid,
      staffProfileId,
      year ? Number(year) : undefined,
    );
  }

  @Get('leave/applications')
  @RequireAnyPermission(
    'payroll:read',
    'staff:read',
    'staff-attendance:leave-admin',
  )
  leaveApplications(
    @CurrentUser() user: JwtUser,
    @Query('staffProfileId') staffProfileId?: string,
    @Query('status') status?: string,
    @Query('pendingApproval') pendingApproval?: string,
  ) {
    return this.leave.listApplications(user.tid, {
      staffProfileId,
      status,
      pendingApproval: pendingApproval === 'true',
    });
  }

  @Post('leave/applications')
  @RequireAnyPermission('payroll:manage', 'staff-attendance:leave-admin')
  createLeaveApplication(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateLeaveApplicationDto,
  ) {
    return this.leave.apply(user, dto);
  }

  @Post('leave/applications/me')
  @RequireAnyPermission('staff:portal:self')
  portalApplyLeave(
    @CurrentUser() user: JwtUser,
    @Body() dto: PortalCreateLeaveDto,
  ) {
    return this.leave.applyForSelf(user, dto);
  }

  @Get('leave/applications/me')
  @RequireAnyPermission('staff:portal:self')
  portalMyApplications(@CurrentUser() user: JwtUser) {
    return this.leave.listApplicationsForSelf(user);
  }

  @Get('leave/summary/me')
  @RequireAnyPermission('staff:portal:self')
  portalLeaveSummary(@CurrentUser() user: JwtUser) {
    return this.leave.portalSummaryForSelf(user);
  }

  @Patch('leave/applications/:id/approve')
  @RequireAnyPermission('payroll:manage', 'staff-attendance:leave-admin')
  approveLeave(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ApproveLeaveDto,
  ) {
    return this.leave.approve(user, id, dto);
  }

  @Post('leave/balances/initialize')
  @RequirePermissions('staff-attendance:leave-admin')
  initializeBalances(
    @CurrentUser() user: JwtUser,
    @Body() dto: InitializeLeaveBalancesDto,
  ) {
    return this.leave.initializeBalances(user, dto);
  }

  // Recruitment
  @Get('recruitment/stats')
  @RequireAnyPermission('payroll:read', 'staff:manage')
  recruitmentStats(@CurrentUser() user: JwtUser) {
    return this.recruitment.pipelineStats(user.tid);
  }

  @Get('recruitment/vacancies')
  @RequireAnyPermission('payroll:read', 'staff:manage')
  listVacancies(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
  ) {
    return this.recruitment.listVacancies(user.tid, status);
  }

  @Post('recruitment/vacancies')
  @RequirePermissions('staff:manage')
  createVacancy(@CurrentUser() user: JwtUser, @Body() dto: CreateVacancyDto) {
    return this.recruitment.createVacancy(user, dto);
  }

  @Patch('recruitment/vacancies/:id/status')
  @RequirePermissions('staff:manage')
  updateVacancyStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateVacancyStatusDto,
  ) {
    return this.recruitment.updateVacancyStatus(user, id, dto);
  }

  @Get('recruitment/applications')
  @RequireAnyPermission('payroll:read', 'staff:manage')
  listApplications(
    @CurrentUser() user: JwtUser,
    @Query('vacancyId') vacancyId?: string,
  ) {
    return this.recruitment.listApplications(user.tid, vacancyId);
  }

  @Post('recruitment/applications')
  @RequirePermissions('staff:manage')
  createApplication(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateRecruitmentApplicationDto,
  ) {
    return this.recruitment.createApplication(user, dto);
  }

  @Patch('recruitment/applications/:id/status')
  @RequirePermissions('staff:manage')
  updateApplicationStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.recruitment.updateApplicationStatus(user, id, status);
  }

  @Post('recruitment/interviews')
  @RequirePermissions('staff:manage')
  scheduleInterview(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateInterviewDto,
  ) {
    return this.recruitment.scheduleInterview(user, dto);
  }

  @Post('recruitment/offers')
  @RequirePermissions('staff:manage')
  createOffer(@CurrentUser() user: JwtUser, @Body() dto: CreateOfferDto) {
    return this.recruitment.createOffer(user, dto);
  }

  @Post('recruitment/offers/:id/accept')
  @RequirePermissions('staff:manage')
  acceptOffer(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AcceptOfferDto,
  ) {
    return this.recruitment.acceptOffer(user, id, dto.staffProfileId);
  }

  // Pension
  @Get('pension/stats')
  @RequireAnyPermission('payroll:read')
  pensionStats(@CurrentUser() user: JwtUser) {
    return this.pension.dashboardStats(user.tid);
  }

  @Get('pension/enrollments')
  @RequireAnyPermission('payroll:read')
  pensionEnrollments(
    @CurrentUser() user: JwtUser,
    @Query('staffProfileId') staffProfileId?: string,
  ) {
    return this.pension.listEnrollments(user.tid, staffProfileId);
  }

  @Post('pension/enrollments')
  @RequirePermissions('payroll:manage')
  enrollPension(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePensionEnrollmentDto,
  ) {
    return this.pension.enroll(user, dto);
  }

  @Get('pension/ledger')
  @RequireAnyPermission('payroll:read')
  pensionLedger(
    @CurrentUser() user: JwtUser,
    @Query('staffProfileId') staffProfileId?: string,
    @Query('year') year?: string,
  ) {
    return this.pension.listLedger(
      user.tid,
      staffProfileId,
      year ? Number(year) : undefined,
    );
  }

  @Post('pension/ledger')
  @RequirePermissions('payroll:manage')
  recordPensionAccrual(
    @CurrentUser() user: JwtUser,
    @Body() dto: RecordPensionAccrualDto,
  ) {
    return this.pension.recordAccrual(user, dto);
  }

  @Get('pension/projection/:staffProfileId')
  @RequireAnyPermission('payroll:read')
  pensionProjection(
    @CurrentUser() user: JwtUser,
    @Param('staffProfileId') staffProfileId: string,
  ) {
    return this.pension.projection(user.tid, staffProfileId);
  }

  // Appraisal
  @Get('appraisal/cycles')
  @RequireAnyPermission('payroll:read', 'staff:read')
  listCycles(@CurrentUser() user: JwtUser) {
    return this.appraisal.listCycles(user.tid);
  }

  @Post('appraisal/cycles')
  @RequirePermissions('payroll:manage')
  createCycle(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAppraisalCycleDto,
  ) {
    return this.appraisal.createCycle(user, dto);
  }

  @Post('appraisal/cycles/:id/launch')
  @RequirePermissions('payroll:manage')
  launchCycle(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.appraisal.launchCycle(user, id);
  }

  @Get('appraisal/records')
  @RequireAnyPermission('payroll:read', 'staff:read')
  listAppraisals(
    @CurrentUser() user: JwtUser,
    @Query('cycleId') cycleId?: string,
    @Query('staffProfileId') staffProfileId?: string,
  ) {
    return this.appraisal.listAppraisals(user.tid, cycleId, staffProfileId);
  }

  @Patch('appraisal/records/:id/score')
  @RequireAnyPermission('payroll:manage', 'staff:portal:self')
  scoreAppraisal(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ScoreAppraisalDto,
  ) {
    return this.appraisal.score(user, id, dto);
  }
}
