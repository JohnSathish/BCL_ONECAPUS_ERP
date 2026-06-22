import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
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
  SendDocumentsReminderDto,
  UpdateApplicationStatusDto,
  UpdateInterviewDto,
  UpdateVacancyDto,
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
import { RecruitmentInterviewDocumentService } from './services/recruitment-interview-document.service';

@ApiBearerAuth()
@ApiTags('hr')
@Controller({ path: 'hr', version: '1' })
export class HrController {
  constructor(
    private readonly leave: LeaveService,
    private readonly recruitment: RecruitmentService,
    private readonly pension: PensionService,
    private readonly appraisal: AppraisalService,
    private readonly interviewDocuments: RecruitmentInterviewDocumentService,
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

  @Get('recruitment/analytics')
  @RequireAnyPermission('payroll:read', 'staff:manage')
  recruitmentAnalytics(@CurrentUser() user: JwtUser) {
    return this.recruitment.recruitmentAnalytics(user.tid);
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

  @Get('recruitment/vacancies/:id')
  @RequireAnyPermission('payroll:read', 'staff:manage')
  getVacancy(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.recruitment.getVacancy(user.tid, id);
  }

  @Patch('recruitment/vacancies/:id')
  @RequirePermissions('staff:manage')
  updateVacancy(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateVacancyDto,
  ) {
    return this.recruitment.updateVacancy(user, id, dto);
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

  @Get('recruitment/pipeline')
  @RequireAnyPermission('payroll:read', 'staff:manage')
  recruitmentPipeline(
    @CurrentUser() user: JwtUser,
    @Query('vacancyId') vacancyId?: string,
  ) {
    return this.recruitment.pipelineBoard(user.tid, vacancyId);
  }

  @Get('recruitment/applications/:id')
  @RequireAnyPermission('payroll:read', 'staff:manage')
  getApplication(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.recruitment.getApplication(user.tid, id);
  }

  @Get('recruitment/interviews')
  @RequireAnyPermission('payroll:read', 'staff:manage')
  listInterviews(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
  ) {
    return this.recruitment.listInterviews(user.tid, status);
  }

  @Get('recruitment/interviews/bulk/call-letters')
  @RequireAnyPermission('payroll:read', 'staff:manage')
  async bulkInterviewCallLetters(
    @CurrentUser() user: JwtUser,
    @Query('date') date: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.interviewDocuments.bulkPdfForDate(
      user.tid,
      date ?? new Date().toISOString().slice(0, 10),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('recruitment/interviews/:id/call-letter/preview')
  @RequireAnyPermission('payroll:read', 'staff:manage')
  async previewInterviewCallLetter(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const html = await this.interviewDocuments.previewHtml(user.tid, id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('recruitment/interviews/:id/call-letter')
  @RequireAnyPermission('payroll:read', 'staff:manage')
  async downloadInterviewCallLetter(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.interviewDocuments.pdfBuffer(
      user.tid,
      id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Post('recruitment/interviews/:id/minutes')
  @RequirePermissions('staff:manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadInterviewMinutes(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.recruitment.uploadInterviewMinutes(user, id, file);
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
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    return this.recruitment.updateApplicationStatus(user, id, dto);
  }

  @Post('recruitment/applications/:id/notify/documents')
  @RequirePermissions('staff:manage')
  sendDocumentsReminder(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SendDocumentsReminderDto,
  ) {
    return this.recruitment.sendDocumentsReminder(user, id, dto.message);
  }

  @Post('recruitment/interviews')
  @RequirePermissions('staff:manage')
  scheduleInterview(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateInterviewDto,
  ) {
    return this.recruitment.scheduleInterview(user, dto);
  }

  @Patch('recruitment/interviews/:id')
  @RequirePermissions('staff:manage')
  updateInterview(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateInterviewDto,
  ) {
    return this.recruitment.updateInterview(user, id, dto);
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
