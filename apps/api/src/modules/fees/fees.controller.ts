import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import { extractRequestHost } from '../../common/utils/request-host';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';
import {
  CollectionDto,
  CancelReceiptDto,
  ConcessionDto,
  CreateFeeStructureDto,
  DemandScopeDto,
  FeeStructureQueryDto,
  FineRuleDto,
  GatewayPaymentDto,
  GenerateDemandDto,
  PublishDemandDto,
  RefundPaymentDto,
  ReportsQueryDto,
  SendReceiptDto,
  CreatePaymentRequestDto,
  VerifyFeePaymentDto,
  ExternalFeePaymentDto,
  RejectExternalFeePaymentDto,
} from './dto/fees.dto';
import {
  BulkGenerateCycleDemandDto,
  CreateFeeCycleDto,
  CreateFeeHeadDto,
  FeeCycleQueryDto,
  FeeHeadQueryDto,
  GenerateCycleDemandDto,
  ReorderFeeHeadsDto,
  UpdateFeeCycleDto,
  UpdateFeeHeadDto,
} from './dto/fee-cycle.dto';
import { FeeCycleConfigService } from './services/fee-cycle-config.service';
import { FeeCycleEngineService } from './services/fee-cycle-engine.service';
import { FeeFinanceSettingsService } from './services/fee-finance-settings.service';
import { FeeHeadMasterService } from './services/fee-head-master.service';
import { FeeReceiptDocumentService } from './services/fee-receipt-document.service';
import { FeeReceiptNotificationService } from './services/fee-receipt-notification.service';
import { StudentFeeSummaryService } from './services/student-fee-summary.service';
import { FeeReminderService } from './services/fee-reminder.service';
import { MonthlyFeeEngineService } from './services/monthly-fee-engine.service';
import { MonthlyFeePlanService } from './services/monthly-fee-plan.service';
import { ScholarshipSchemeService } from './services/scholarship-scheme.service';
import { StudentFeeAccountService } from './services/student-fee-account.service';
import { FeeDemandEngineService } from './services/fee-demand-engine.service';
import { FeeLedgerService } from './services/fee-ledger.service';
import { FeeReportsService } from './services/fee-reports.service';
import { FeeStructureService } from './services/fee-structure.service';
import { FineConcessionService } from './services/fine-concession.service';
import { GatewayPaymentService } from './services/gateway-payment.service';
import { PaymentCollectionService } from './services/payment-collection.service';
import { RenewalFeeService } from './services/renewal-fee.service';
import { FeePaymentRequestService } from './services/fee-payment-request.service';
import { FeeReversalService } from './services/fee-reversal.service';
import { ExternalFeePaymentService } from './services/external-fee-payment.service';

@ApiBearerAuth()
@ApiTags('fees')
@Controller({ path: 'fees', version: '1' })
export class FeesController {
  constructor(
    private readonly structures: FeeStructureService,
    private readonly demands: FeeDemandEngineService,
    private readonly renewals: RenewalFeeService,
    private readonly ledger: FeeLedgerService,
    private readonly collections: PaymentCollectionService,
    private readonly gateways: GatewayPaymentService,
    private readonly concessions: FineConcessionService,
    private readonly reports: FeeReportsService,
    private readonly feeHeads: FeeHeadMasterService,
    private readonly feeCycles: FeeCycleConfigService,
    private readonly cycleEngine: FeeCycleEngineService,
    private readonly feeAccount: StudentFeeAccountService,
    private readonly feeSummary: StudentFeeSummaryService,
    private readonly monthlyPlans: MonthlyFeePlanService,
    private readonly monthlyEngine: MonthlyFeeEngineService,
    private readonly financeSettings: FeeFinanceSettingsService,
    private readonly receiptDocs: FeeReceiptDocumentService,
    private readonly receiptNotify: FeeReceiptNotificationService,
    private readonly feeReversal: FeeReversalService,
    private readonly paymentRequests: FeePaymentRequestService,
    private readonly externalPayments: ExternalFeePaymentService,
    private readonly feeReminders: FeeReminderService,
    private readonly scholarships: ScholarshipSchemeService,
    private readonly tenantResolution: TenantResolutionService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission('fees:read', 'fees:manage')
  dashboard(@CurrentUser() user: JwtUser) {
    return this.reports.dashboard(user.tid);
  }

  @Get('structures')
  @RequireAnyPermission('fees:read', 'fees:manage')
  listStructures(
    @CurrentUser() user: JwtUser,
    @Query() query: FeeStructureQueryDto,
  ) {
    return this.structures.list(user.tid, query);
  }

  @Post('structures')
  @RequirePermissions('fees:manage')
  createStructure(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFeeStructureDto,
  ) {
    return this.structures.create(user, dto);
  }

  @Post('structures/:id/publish')
  @RequirePermissions('fees:manage')
  publishStructure(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.structures.publish(user, id);
  }

  @Post('structures/:id/lock')
  @RequirePermissions('fees:manage')
  lockStructure(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.structures.lock(user, id);
  }

  @Post('demands/preview')
  @RequireAnyPermission('fees:read', 'fees:manage')
  previewDemand(@CurrentUser() user: JwtUser, @Body() dto: DemandScopeDto) {
    return this.demands.preview(user.tid, dto);
  }

  @Post('demands/generate')
  @RequirePermissions('fees:manage')
  generateDemand(@CurrentUser() user: JwtUser, @Body() dto: GenerateDemandDto) {
    return this.demands.generate(user, dto);
  }

  @Post('demands/:id/publish')
  @RequirePermissions('fees:manage')
  publishDemand(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: PublishDemandDto,
  ) {
    return this.demands.publish(user, id, dto);
  }

  @Post('demands/:id/lock')
  @RequirePermissions('fees:manage')
  lockDemand(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: PublishDemandDto,
  ) {
    return this.demands.lock(user, id, dto);
  }

  @Post('demands/:id/rollback')
  @RequirePermissions('fees:manage')
  rollbackDemand(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: PublishDemandDto,
  ) {
    return this.demands.rollback(user, id, dto);
  }

  @Post('renewals/preview')
  @RequireAnyPermission('fees:read', 'fees:manage')
  previewRenewal(@CurrentUser() user: JwtUser, @Body() dto: GenerateDemandDto) {
    return this.renewals.previewRenewal(user.tid, dto);
  }

  @Post('renewals/generate')
  @RequirePermissions('fees:manage')
  generateRenewal(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateDemandDto,
  ) {
    return this.renewals.generateRenewal(user, dto);
  }

  @Get('students/:studentId/ledger')
  @RequireAnyPermission('fees:read', 'fees:manage')
  studentLedger(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.ledger.studentLedger(user.tid, studentId);
  }

  @Get('me/ledger')
  @RequireAnyPermission('fees:read', 'fees:manage', 'student:portal:self')
  myLedger(@CurrentUser() user: JwtUser) {
    return this.ledger.myLedger(user.tid, user.sub);
  }

  @Get('students/:studentId/dues')
  @RequireAnyPermission('fees:read', 'fees:manage')
  studentDues(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.ledger.dues(user.tid, studentId);
  }

  @Get('me/dues')
  @RequireAnyPermission('fees:read', 'fees:manage', 'student:portal:self')
  myDues(@CurrentUser() user: JwtUser) {
    return this.ledger.myDues(user.tid, user.sub);
  }

  @Post('collections')
  @RequireAnyPermission('fees:manage', 'fees:cash:collect')
  collect(
    @CurrentUser() user: JwtUser,
    @Body() dto: CollectionDto,
    @Req() req: Request & { ip?: string },
  ) {
    const clientIp =
      String(req.headers['x-forwarded-for'] ?? '')
        .split(',')[0]
        ?.trim() ||
      req.ip ||
      undefined;
    return this.collections.collect(user, dto, {
      clientIp,
      userAgent: String(req.headers['user-agent'] ?? ''),
    });
  }

  @Post('collections/:paymentId/clear-cheque')
  @RequireAnyPermission('fees:manage', 'fees:cash:collect')
  clearCheque(
    @CurrentUser() user: JwtUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.collections.clearChequePayment(user, paymentId);
  }

  @Get('external-payments/sources')
  @RequireAnyPermission('fees:read', 'fees:manage', 'student:portal:self')
  externalPaymentSources(@CurrentUser() user: JwtUser) {
    return this.externalPayments.listSources(user);
  }

  @Get('settings/collection-modes/catalog')
  @RequireAnyPermission('fees:read', 'fees:manage')
  collectionModeCatalog() {
    return this.financeSettings.collectionModeCatalog();
  }

  @Get('external-payments')
  @RequireAnyPermission('fees:read', 'fees:manage')
  listExternalPayments(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
    @Query('studentId') studentId?: string,
    @Query('paymentSource') paymentSource?: string,
    @Query('limit') limit?: string,
  ) {
    return this.externalPayments.list(user.tid, {
      status,
      studentId,
      paymentSource,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('external-payments/attachments')
  @RequireAnyPermission('fees:manage', 'student:portal:self')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadExternalPaymentAttachment(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.externalPayments.uploadAttachment(user, file);
  }

  @Post('me/external-payments/attachments')
  @RequireAnyPermission('student:portal:self')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  uploadMyExternalPaymentAttachment(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.externalPayments.uploadAttachment(user, file);
  }

  @Get('external-payments/attachment')
  @RequireAnyPermission('fees:read', 'fees:manage')
  async downloadExternalPaymentAttachment(
    @Query('key') key: string,
    @Res() res: Response,
  ) {
    if (!key) throw new BadRequestException('key is required');
    const buf = await this.externalPayments.getAttachment(
      decodeURIComponent(key),
    );
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(buf);
  }

  @Get('external-payments/:id')
  @RequireAnyPermission('fees:read', 'fees:manage')
  getExternalPayment(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.externalPayments.get(user.tid, id);
  }

  @Post('external-payments')
  @RequirePermissions('fees:manage')
  submitExternalPayment(
    @CurrentUser() user: JwtUser,
    @Body() dto: ExternalFeePaymentDto,
  ) {
    return this.externalPayments.submit(user, dto);
  }

  @Post('external-payments/:id/approve')
  @RequirePermissions('fees:manage')
  approveExternalPayment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.externalPayments.approve(user, id);
  }

  @Post('external-payments/:id/reject')
  @RequirePermissions('fees:manage')
  rejectExternalPayment(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RejectExternalFeePaymentDto,
  ) {
    return this.externalPayments.reject(user, id, dto.reason);
  }

  @Get('reports/reconciliation')
  @RequireAnyPermission('fees:read', 'fees:manage', 'reports:read')
  reconciliationReport(
    @CurrentUser() user: JwtUser,
    @Query() query: ReportsQueryDto,
  ) {
    return this.reports.reconciliation(user.tid, query);
  }

  @Post('payments/initiate')
  @RequireAnyPermission('fees:read', 'fees:manage')
  initiatePayment(
    @CurrentUser() user: JwtUser,
    @Body() dto: GatewayPaymentDto,
  ) {
    return this.gateways.initiate(user, dto);
  }

  @Post('me/payments/initiate')
  @RequireAnyPermission('fees:read', 'fees:manage', 'student:portal:self')
  async initiateMyPayment(
    @CurrentUser() user: JwtUser,
    @Body() dto: Omit<GatewayPaymentDto, 'studentId'>,
  ) {
    const ledger = await this.ledger.myLedger(user.tid, user.sub);
    if (!ledger.studentId)
      throw new BadRequestException(
        'No student profile linked to this account.',
      );
    return this.gateways.initiate(user, {
      ...dto,
      studentId: ledger.studentId,
    });
  }

  @Get('me/payments/status/:orderId')
  @RequireAnyPermission('fees:read', 'fees:manage', 'student:portal:self')
  myPaymentStatus(
    @CurrentUser() user: JwtUser,
    @Param('orderId') orderId: string,
  ) {
    return this.gateways.syncStatus(user, 'RAZORPAY', orderId);
  }

  @Public()
  @Post('payments/webhook/razorpay')
  async razorpayWebhook(
    @Headers('host') host: string,
    @Headers('x-razorpay-signature') signature: string | undefined,
    @Req() req: Request & { rawBody?: Buffer },
    @Body() body: Record<string, unknown>,
  ) {
    const tenant = await this.tenantResolution.resolveHost(
      host || extractRequestHost(req),
    );
    const raw =
      req.rawBody?.toString('utf8') ??
      (typeof body === 'object' ? JSON.stringify(body) : String(body));
    return this.gateways.handlePublicWebhook(tenant.id, raw, signature, body);
  }

  @Post('payments/:provider/status/:orderId')
  @RequireAnyPermission('fees:read', 'fees:manage')
  syncGatewayStatus(
    @CurrentUser() user: JwtUser,
    @Param('provider') provider: string,
    @Param('orderId') orderId: string,
  ) {
    return this.gateways.syncStatus(user, provider, orderId);
  }

  @Get('fines')
  @RequireAnyPermission('fees:read', 'fees:manage')
  fineRules(@CurrentUser() user: JwtUser) {
    return this.concessions.fineRules(user.tid);
  }

  @Post('fines')
  @RequirePermissions('fees:manage')
  createFineRule(@CurrentUser() user: JwtUser, @Body() dto: FineRuleDto) {
    return this.concessions.createFineRule(user, dto);
  }

  @Post('concessions')
  @RequirePermissions('fees:manage')
  requestConcession(@CurrentUser() user: JwtUser, @Body() dto: ConcessionDto) {
    return this.concessions.requestConcession(user, dto);
  }

  @Post('concessions/:id/approve')
  @RequirePermissions('fees:manage')
  approveConcession(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.concessions.approveConcession(user, id);
  }

  @Get('reports/:type')
  @RequireAnyPermission('fees:read', 'fees:manage')
  report(
    @CurrentUser() user: JwtUser,
    @Param('type') type: string,
    @Query() query: ReportsQueryDto,
  ) {
    return this.reports.report(user.tid, type, query);
  }

  @Get('audit-logs')
  @RequireAnyPermission('fees:read', 'fees:manage')
  auditLogs(@CurrentUser() user: JwtUser) {
    return this.reports.auditLogs(user.tid);
  }

  // --- Academic Fee Cycle (Don Bosco FYUGP model) ---

  @Get('masters/heads')
  @RequireAnyPermission('fees:read', 'fees:manage')
  listFeeHeads(@CurrentUser() user: JwtUser, @Query() query: FeeHeadQueryDto) {
    return this.feeHeads.list(user.tid, query);
  }

  @Post('masters/heads')
  @RequirePermissions('fees:manage')
  createFeeHead(@CurrentUser() user: JwtUser, @Body() dto: CreateFeeHeadDto) {
    return this.feeHeads.create(user, dto);
  }

  @Patch('masters/heads/:id')
  @RequirePermissions('fees:manage')
  updateFeeHead(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateFeeHeadDto,
  ) {
    return this.feeHeads.update(user, id, dto);
  }

  @Delete('masters/heads/:id')
  @RequirePermissions('fees:manage')
  deleteFeeHead(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.feeHeads.remove(user, id);
  }

  @Post('masters/heads/reorder')
  @RequirePermissions('fees:manage')
  reorderFeeHeads(
    @CurrentUser() user: JwtUser,
    @Body() dto: ReorderFeeHeadsDto,
  ) {
    return this.feeHeads.reorder(user, dto);
  }

  @Get('cycles')
  @RequireAnyPermission('fees:read', 'fees:manage')
  listFeeCycles(
    @CurrentUser() user: JwtUser,
    @Query() query: FeeCycleQueryDto,
  ) {
    return this.feeCycles.list(user.tid, query);
  }

  @Get('cycles/:id')
  @RequireAnyPermission('fees:read', 'fees:manage')
  getFeeCycle(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.feeCycles.getOne(user.tid, id);
  }

  @Post('cycles')
  @RequirePermissions('fees:manage')
  createFeeCycle(@CurrentUser() user: JwtUser, @Body() dto: CreateFeeCycleDto) {
    return this.feeCycles.create(user, dto);
  }

  @Patch('cycles/:id')
  @RequirePermissions('fees:manage')
  updateFeeCycle(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateFeeCycleDto,
  ) {
    return this.feeCycles.update(user, id, dto);
  }

  @Post('cycles/:id/activate')
  @RequirePermissions('fees:manage')
  activateFeeCycle(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.feeCycles.activate(user, id);
  }

  @Post('cycles/:id/deactivate')
  @RequirePermissions('fees:manage')
  deactivateFeeCycle(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.feeCycles.deactivate(user, id);
  }

  @Delete('cycles/:id')
  @RequirePermissions('fees:manage')
  deleteFeeCycle(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.feeCycles.remove(user, id);
  }

  @Post('cycle-demands/preview')
  @RequireAnyPermission('fees:read', 'fees:manage')
  previewCycleDemand(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateCycleDemandDto,
  ) {
    return this.cycleEngine.previewForStudent(
      user.tid,
      dto.studentId,
      dto.semesterNumber,
    );
  }

  @Post('cycle-demands/generate')
  @RequirePermissions('fees:manage')
  generateCycleDemand(
    @CurrentUser() user: JwtUser,
    @Body() dto: GenerateCycleDemandDto,
  ) {
    return this.cycleEngine.generateForStudent(user, dto);
  }

  @Post('cycle-demands/bulk')
  @RequirePermissions('fees:manage')
  bulkGenerateCycleDemand(
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkGenerateCycleDemandDto,
  ) {
    return this.cycleEngine.generateBulk(user, dto);
  }

  @Get('students/:studentId/fee-summary')
  @RequireAnyPermission('fees:read', 'fees:manage')
  studentFeeSummary(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.feeSummary.get(user.tid, studentId);
  }

  @Get('me/summary')
  @RequireAnyPermission('fees:read', 'fees:manage', 'student:portal:self')
  async myFeeSummary(@CurrentUser() user: JwtUser) {
    const student = await this.feeAccount.getMyAccount(user.tid, user.sub);
    if (!student.studentId)
      return { studentId: null, totalOutstanding: 0, feeStatus: 'CLEAR' };
    return this.feeSummary.get(user.tid, student.studentId);
  }

  @Get('students/:studentId/fee-account')
  @RequireAnyPermission('fees:read', 'fees:manage')
  studentFeeAccount(
    @CurrentUser() user: JwtUser,
    @Param('studentId') studentId: string,
  ) {
    return this.feeAccount.getAccount(user.tid, studentId);
  }

  @Get('me/fee-account')
  @RequireAnyPermission('fees:read', 'fees:manage', 'student:portal:self')
  myFeeAccount(@CurrentUser() user: JwtUser) {
    return this.feeAccount.getMyAccount(user.tid, user.sub);
  }

  @Get('me/external-payments')
  @RequireAnyPermission('student:portal:self')
  async myExternalPayments(
    @CurrentUser() user: JwtUser,
    @Query('status') status?: string,
  ) {
    const account = await this.feeAccount.getMyAccount(user.tid, user.sub);
    if (!account.studentId) return [];
    return this.externalPayments.list(user.tid, {
      studentId: account.studentId,
      status,
      limit: 30,
    });
  }

  @Post('me/external-payments')
  @RequireAnyPermission('student:portal:self')
  async submitMyExternalPayment(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: {
      paymentSource: string;
      externalReference?: string;
      transactionDate: string;
      amount: number;
      demandIds?: string[];
      remarks?: string;
      attachmentUrls?: string[];
    },
  ) {
    const account = await this.feeAccount.getMyAccount(user.tid, user.sub);
    if (!account.studentId)
      throw new BadRequestException(
        'No student profile linked to this account.',
      );
    return this.externalPayments.submit(user, {
      ...dto,
      studentId: account.studentId,
      approveImmediately: false,
    });
  }

  @Post('me/payment-requests')
  @RequireAnyPermission('student:portal:self')
  async createMyPaymentRequest(
    @CurrentUser() user: JwtUser,
    @Body()
    dto: {
      demandIds: string[];
      channel?: 'OFFICE_QR' | 'PAYMENT_LINK' | 'STUDENT_PORTAL';
    },
  ) {
    const account = await this.feeAccount.getMyAccount(user.tid, user.sub);
    if (!account.studentId)
      throw new BadRequestException(
        'No student profile linked to this account.',
      );
    return this.paymentRequests.create(user, {
      studentId: account.studentId,
      demandIds: dto.demandIds,
      channel: dto.channel ?? 'STUDENT_PORTAL',
    });
  }

  @Get('settings')
  @RequireAnyPermission('fees:read', 'fees:manage')
  getFinanceSettings(@CurrentUser() user: JwtUser) {
    return this.financeSettings.get(user.tid);
  }

  @Patch('settings')
  @RequirePermissions('fees:manage')
  updateFinanceSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.financeSettings.update(
      user,
      dto as {
        monthlyDueDay?: number;
        lateFeeEnabled?: boolean;
        lateFeeMode?: string;
        lateFeeAmount?: number;
        receiptPrefix?: string;
        onlinePaymentEnabled?: boolean;
        cashCollectionEnabled?: boolean;
        paymentRequestExpiryMinutes?: number;
        officeQrEnabled?: boolean;
        blockHallTicketOnDue?: boolean;
        blockRegistrationOnDue?: boolean;
      },
    );
  }

  @Get('monthly-plans')
  @RequireAnyPermission('fees:read', 'fees:manage')
  listMonthlyPlans(@CurrentUser() user: JwtUser) {
    return this.monthlyPlans.list(user.tid);
  }

  @Post('monthly-plans')
  @RequirePermissions('fees:manage')
  createMonthlyPlan(
    @CurrentUser() user: JwtUser,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.monthlyPlans.create(
      user,
      dto as {
        code: string;
        name: string;
        lines?: Array<{ code: string; name: string; amount: number }>;
      },
    );
  }

  @Patch('monthly-plans/:id')
  @RequirePermissions('fees:manage')
  updateMonthlyPlan(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.monthlyPlans.update(user, id, dto);
  }

  @Post('monthly-demands/generate')
  @RequirePermissions('fees:manage')
  generateMonthlyDemands(
    @CurrentUser() user: JwtUser,
    @Body() body: { period?: string; studentId?: string; monthsAhead?: number },
  ) {
    if (body.studentId) {
      if (body.monthsAhead && body.monthsAhead > 1) {
        return this.monthlyEngine.generateAdvanceForStudent(
          user,
          body.studentId,
          body.monthsAhead,
          body.period,
        );
      }
      return this.monthlyEngine.generateForStudent(
        user,
        body.studentId,
        body.period,
      );
    }
    return this.monthlyEngine.generateBulk(user.tid, body.period, user.sub);
  }

  @Post('monthly-demands/preview')
  @RequireAnyPermission('fees:read', 'fees:manage')
  previewMonthlyDemand(
    @CurrentUser() user: JwtUser,
    @Body() body: { studentId: string; period?: string },
  ) {
    return this.monthlyEngine.previewForStudent(
      user.tid,
      body.studentId,
      body.period,
    );
  }

  @Get('scholarships')
  @RequireAnyPermission('fees:read', 'fees:manage')
  listScholarships(@CurrentUser() user: JwtUser) {
    return this.scholarships.list(user.tid);
  }

  @Post('scholarships')
  @RequirePermissions('fees:manage')
  createScholarship(
    @CurrentUser() user: JwtUser,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.scholarships.create(
      user,
      dto as {
        code: string;
        name: string;
        schemeType: string;
        calculationType: string;
        value: number;
      },
    );
  }

  @Patch('scholarships/:id')
  @RequirePermissions('fees:manage')
  updateScholarship(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
  ) {
    return this.scholarships.update(user, id, dto);
  }

  @Post('payments/verify')
  @RequireAnyPermission('fees:read', 'fees:manage', 'student:portal:self')
  verifyPayment(
    @CurrentUser() user: JwtUser,
    @Body() dto: VerifyFeePaymentDto,
  ) {
    return this.gateways.verifyRazorpay(user, dto);
  }

  @Post('payments/:paymentId/simulate')
  @RequireAnyPermission('fees:manage', 'student:portal:self')
  simulatePayment(
    @CurrentUser() user: JwtUser,
    @Param('paymentId') paymentId: string,
  ) {
    return this.gateways.simulateMockPayment(user, paymentId);
  }

  @Get('payment-requests')
  @RequireAnyPermission('fees:read', 'fees:manage')
  listPaymentRequests(
    @CurrentUser() user: JwtUser,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
  ) {
    return this.paymentRequests.list(user.tid, { studentId, status });
  }

  @Get('payment-requests/:id')
  @RequireAnyPermission('fees:read', 'fees:manage', 'student:portal:self')
  getPaymentRequest(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.paymentRequests.getOne(user.tid, id);
  }

  @Post('payment-requests')
  @RequirePermissions('fees:manage')
  createPaymentRequest(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePaymentRequestDto,
  ) {
    return this.paymentRequests.create(user, dto);
  }

  @Post('payment-requests/:id/cancel')
  @RequirePermissions('fees:manage')
  cancelPaymentRequest(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.paymentRequests.cancel(user, id, body.reason);
  }

  @Post('reminders/send')
  @RequirePermissions('fees:manage')
  sendDueReminders(@CurrentUser() user: JwtUser) {
    return this.feeReminders.sendOutstandingReminders(user.tid, user.sub);
  }

  @Get('reports/day-closing')
  @RequireAnyPermission('fees:read', 'fees:manage')
  dayClosingReport(@CurrentUser() user: JwtUser, @Query('date') date?: string) {
    return this.reports.dayClosing(user.tid, date);
  }

  @Get('reports/day-closing/export')
  @RequireAnyPermission('fees:read', 'fees:manage')
  async exportDayClosing(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query('date') date?: string,
    @Query('format') format?: string,
  ) {
    const result = await this.reports.exportDayClosing(
      user.tid,
      date,
      format ?? 'csv',
    );
    if (result.format === 'pdf' || result.format === 'xlsx') {
      const buffer = (result as { buffer: Buffer }).buffer;
      const filename = (result as { filename: string }).filename;
      res.setHeader(
        'Content-Type',
        result.format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Length', String(buffer.length));
      return res.send(buffer);
    }
    return res.json(result);
  }

  @Get('receipts/recent')
  @RequireAnyPermission('fees:read', 'fees:manage')
  recentReceipts(
    @CurrentUser() user: JwtUser,
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reports.recentReceipts(user.tid, {
      date,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('receipts/bulk-pdf')
  @RequireAnyPermission('fees:read', 'fees:manage')
  async bulkReceiptPdf(
    @CurrentUser() user: JwtUser,
    @Body() dto: { receiptIds: string[]; layout?: 'single' | 'two_per_page' },
    @Res() res: Response,
  ) {
    const buffer = await this.receiptDocs.generateBulkPdfBuffer(
      user.tid,
      dto.receiptIds ?? [],
      dto.layout ?? 'two_per_page',
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="fee-receipts-bulk.pdf"',
    );
    res.setHeader('Content-Length', String(buffer.length));
    return res.send(buffer);
  }

  @Get('receipts/:id/pdf')
  @RequireAnyPermission('fees:read', 'fees:manage', 'student:portal:self')
  async receiptPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const { buffer, receiptNo } = await this.receiptDocs.generatePdfBuffer(
      user.tid,
      id,
    );
    const safeName = receiptNo.replace(/\//g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeName}.pdf"`);
    return res.send(buffer);
  }

  @Post('receipts/:id/send')
  @RequirePermissions('fees:manage')
  sendReceipt(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: SendReceiptDto,
  ) {
    return this.receiptNotify.sendReceipt(user.tid, id, dto.channels, user.sub);
  }

  @Post('receipts/:id/cancel')
  @RequirePermissions('fees:manage')
  cancelReceipt(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CancelReceiptDto,
  ) {
    return this.feeReversal.cancelReceipt(user, id, dto.reason);
  }

  @Post('refunds')
  @RequirePermissions('fees:manage')
  refundPayment(@CurrentUser() user: JwtUser, @Body() dto: RefundPaymentDto) {
    if (!dto.receiptId && !dto.paymentId) {
      throw new BadRequestException('Provide receiptId or paymentId.');
    }
    return this.feeReversal.refundPayment(user, dto);
  }

  @Get('reports/:type/export')
  @RequireAnyPermission('fees:read', 'fees:manage')
  async exportReport(
    @CurrentUser() user: JwtUser,
    @Param('type') type: string,
    @Query() query: ReportsQueryDto & { format?: string },
    @Res() res: Response,
  ) {
    const result = await this.reports.exportReport(user.tid, type, query);
    if (result.format === 'pdf' || result.format === 'xlsx') {
      const buffer = (result as { buffer: Buffer }).buffer;
      const filename = (result as { filename: string }).filename;
      res.setHeader(
        'Content-Type',
        result.format === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Length', String(buffer.length));
      return res.send(buffer);
    }
    return res.json(result);
  }
}
