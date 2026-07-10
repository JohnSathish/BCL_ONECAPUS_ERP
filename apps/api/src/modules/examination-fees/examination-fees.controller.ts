import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  AddBackPaperDto,
  CreateExamFeeMasterDto,
  CreateExamFeeSessionDto,
  ExamApplicationListQueryDto,
  ExamReportQueryDto,
  InitiateExamOnlinePaymentDto,
  ManualExamPaymentDto,
  StartExamApplicationDto,
  SubmitExamApplicationDto,
  UpdateExamFeeMasterDto,
  UpdateExamFeeSessionDto,
  UpdateExamFeeSettingsDto,
  VerifyExamApplicationDto,
} from './dto/examination-fees.dto';
import { ExamApplicationService } from './services/exam-application.service';
import { ExamDashboardService } from './services/exam-dashboard.service';
import { ExamFeeMasterService } from './services/exam-fee-master.service';
import { ExamFeeSessionService } from './services/exam-fee-session.service';
import { ExamFeeSettingsService } from './services/exam-fee-settings.service';
import { ExamPaymentService } from './services/exam-payment.service';
import { ExamReceiptService } from './services/exam-receipt.service';
import { ExamReportService } from './services/exam-report.service';
import { ExamVerificationService } from './services/exam-verification.service';

const READ = [
  'exam-fees:read',
  'exam-fees:manage',
  'exam-fees:collect',
  'exam-fees:verify',
  'exam:view',
  'exam:admin',
  'fees:read',
  'fees:manage',
] as const;
const MANAGE = ['exam-fees:manage', 'exam:admin', 'fees:manage'] as const;
const COLLECT = [
  'exam-fees:collect',
  'exam-fees:manage',
  'fees:cash:collect',
  'fees:manage',
] as const;
const VERIFY = ['exam-fees:verify', 'exam-fees:manage', 'exam:admin'] as const;

@ApiBearerAuth()
@ApiTags('examination-fees')
@Controller({ path: 'examination-fees', version: '1' })
export class ExaminationFeesController {
  constructor(
    private readonly dashboard: ExamDashboardService,
    private readonly masters: ExamFeeMasterService,
    private readonly sessions: ExamFeeSessionService,
    private readonly settings: ExamFeeSettingsService,
    private readonly applications: ExamApplicationService,
    private readonly payments: ExamPaymentService,
    private readonly receipts: ExamReceiptService,
    private readonly verification: ExamVerificationService,
    private readonly reports: ExamReportService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission(...READ)
  getDashboard(
    @CurrentUser() user: JwtUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.dashboard.summary(user.tid, sessionId);
  }

  @Get('settings')
  @RequireAnyPermission(...READ)
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.get(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(...MANAGE)
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateExamFeeSettingsDto,
  ) {
    return this.settings.update(user, dto);
  }

  @Get('masters')
  @RequireAnyPermission(...READ)
  listMasters(@CurrentUser() user: JwtUser) {
    return this.masters.list(user.tid);
  }

  @Post('masters/seed-defaults')
  @RequireAnyPermission(...MANAGE)
  seedMasters(@CurrentUser() user: JwtUser) {
    return this.masters.seedDefaults(user);
  }

  @Post('masters')
  @RequireAnyPermission(...MANAGE)
  createMaster(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateExamFeeMasterDto,
  ) {
    return this.masters.create(user, dto);
  }

  @Get('masters/:id')
  @RequireAnyPermission(...READ)
  getMaster(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.masters.get(user.tid, id);
  }

  @Patch('masters/:id')
  @RequireAnyPermission(...MANAGE)
  updateMaster(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateExamFeeMasterDto,
  ) {
    return this.masters.update(user, id, dto);
  }

  @Get('sessions')
  @RequireAnyPermission(...READ)
  listSessions(@CurrentUser() user: JwtUser) {
    return this.sessions.list(user.tid);
  }

  @Get('sessions/active')
  @RequireAnyPermission(...READ)
  activeSession(@CurrentUser() user: JwtUser) {
    return this.sessions.getActive(user.tid);
  }

  @Post('sessions')
  @RequireAnyPermission(...MANAGE)
  createSession(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateExamFeeSessionDto,
  ) {
    return this.sessions.create(user, dto);
  }

  @Patch('sessions/:id')
  @RequireAnyPermission(...MANAGE)
  updateSession(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateExamFeeSessionDto,
  ) {
    return this.sessions.update(user, id, dto);
  }

  @Get('applications')
  @RequireAnyPermission(...READ)
  listApplications(
    @CurrentUser() user: JwtUser,
    @Query() query: ExamApplicationListQueryDto,
  ) {
    return this.applications.list(user.tid, query);
  }

  @Get('applications/mine')
  listMyApplications(@CurrentUser() user: JwtUser) {
    return this.applications.listMine(user);
  }

  @Post('applications/start')
  startApplication(
    @CurrentUser() user: JwtUser,
    @Body() dto: StartExamApplicationDto,
  ) {
    return this.applications.start(user, dto);
  }

  @Get('applications/:id')
  @RequireAnyPermission(...READ)
  getApplication(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.applications.get(user.tid, id);
  }

  @Post('applications/:id/back-papers')
  addBackPaper(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AddBackPaperDto,
  ) {
    return this.applications.addBackPaper(user, id, dto);
  }

  @Delete('applications/:id/back-papers/:backPaperId')
  removeBackPaper(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('backPaperId') backPaperId: string,
  ) {
    return this.applications.removeBackPaper(user, id, backPaperId);
  }

  @Post('applications/:id/submit')
  submitApplication(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SubmitExamApplicationDto,
  ) {
    return this.applications.submit(user, id, dto);
  }

  @Get('back-papers')
  @RequireAnyPermission(...READ)
  listBackPapers(
    @CurrentUser() user: JwtUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.applications.listBackPapersAdmin(user.tid, sessionId);
  }

  @Post('applications/:id/payments/online')
  initiateOnline(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: InitiateExamOnlinePaymentDto,
  ) {
    return this.payments.initiateOnline(user, id, dto);
  }

  @Post('applications/:id/payments/online/complete')
  completeOnline(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body()
    body: {
      paymentTransactionId: string;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    },
  ) {
    return this.payments.completeOnline(user, id, body);
  }

  @Post('applications/:id/payments/manual')
  @RequireAnyPermission(...COLLECT)
  collectManual(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ManualExamPaymentDto,
  ) {
    return this.payments.collectManual(user, id, dto);
  }

  @Get('payments')
  @RequireAnyPermission(...READ)
  listPayments(
    @CurrentUser() user: JwtUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.payments.list(user.tid, sessionId);
  }

  @Get('verification')
  @RequireAnyPermission(...VERIFY)
  listVerification(
    @CurrentUser() user: JwtUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.verification.listPending(user.tid, sessionId);
  }

  @Post('applications/:id/verify')
  @RequireAnyPermission(...VERIFY)
  verify(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: VerifyExamApplicationDto,
  ) {
    return this.verification.verify(user, id, dto);
  }

  @Get('receipts')
  @RequireAnyPermission(...READ)
  listReceipts(@CurrentUser() user: JwtUser) {
    return this.receipts.list(user.tid);
  }

  @Get('receipts/:id')
  @RequireAnyPermission(...READ)
  getReceipt(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.receipts.get(user.tid, id);
  }

  @Get('receipts/:id/pdf')
  async receiptPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const buf = await this.receipts.getPdfBuffer(user.tid, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="exam-receipt-${id}.pdf"`,
    );
    res.send(buf);
  }

  @Get('reports/department-collection')
  @RequireAnyPermission(...READ)
  reportDept(@CurrentUser() user: JwtUser, @Query() query: ExamReportQueryDto) {
    return this.reports.collectionByDepartment(user.tid, query);
  }

  @Get('reports/semester-collection')
  @RequireAnyPermission(...READ)
  reportSem(@CurrentUser() user: JwtUser, @Query() query: ExamReportQueryDto) {
    return this.reports.collectionBySemester(user.tid, query);
  }

  @Get('reports/back-papers')
  @RequireAnyPermission(...READ)
  reportBack(@CurrentUser() user: JwtUser, @Query() query: ExamReportQueryDto) {
    return this.reports.backPaperSummary(user.tid, query);
  }

  @Get('reports/fee-heads')
  @RequireAnyPermission(...READ)
  reportHeads(
    @CurrentUser() user: JwtUser,
    @Query() query: ExamReportQueryDto,
  ) {
    return this.reports.feeHeadSummary(user.tid, query);
  }

  @Get('reports/daily-collection')
  @RequireAnyPermission(...READ)
  reportDaily(
    @CurrentUser() user: JwtUser,
    @Query() query: ExamReportQueryDto,
  ) {
    return this.reports.dailyCollection(user.tid, query);
  }

  @Get('reports/pending-payments')
  @RequireAnyPermission(...READ)
  reportPending(
    @CurrentUser() user: JwtUser,
    @Query() query: ExamReportQueryDto,
  ) {
    return this.reports.pendingPayments(user.tid, query);
  }

  @Get('reports/manual-payments')
  @RequireAnyPermission(...READ)
  reportManual(
    @CurrentUser() user: JwtUser,
    @Query() query: ExamReportQueryDto,
  ) {
    return this.reports.manualPayments(user.tid, query);
  }

  @Get('reports/online-payments')
  @RequireAnyPermission(...READ)
  reportOnline(
    @CurrentUser() user: JwtUser,
    @Query() query: ExamReportQueryDto,
  ) {
    return this.reports.onlinePayments(user.tid, query);
  }

  @Get('reports/cancelled-receipts')
  @RequireAnyPermission(...READ)
  reportCancelled(@CurrentUser() user: JwtUser) {
    return this.reports.cancelledReceipts(user.tid);
  }
}
