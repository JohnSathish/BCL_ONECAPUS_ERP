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
  CollectionDto,
  ConcessionDto,
  CreateFeeStructureDto,
  DemandScopeDto,
  FeeStructureQueryDto,
  FineRuleDto,
  GatewayPaymentDto,
  GenerateDemandDto,
  PublishDemandDto,
  ReportsQueryDto,
} from './dto/fees.dto';
import { FeeDemandEngineService } from './services/fee-demand-engine.service';
import { FeeLedgerService } from './services/fee-ledger.service';
import { FeeReportsService } from './services/fee-reports.service';
import { FeeStructureService } from './services/fee-structure.service';
import { FineConcessionService } from './services/fine-concession.service';
import { GatewayPaymentService } from './services/gateway-payment.service';
import { PaymentCollectionService } from './services/payment-collection.service';
import { RenewalFeeService } from './services/renewal-fee.service';

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
  @RequirePermissions('fees:manage')
  collect(@CurrentUser() user: JwtUser, @Body() dto: CollectionDto) {
    return this.collections.collect(user, dto);
  }

  @Post('payments/initiate')
  @RequireAnyPermission('fees:read', 'fees:manage')
  initiatePayment(
    @CurrentUser() user: JwtUser,
    @Body() dto: GatewayPaymentDto,
  ) {
    return this.gateways.initiate(user, dto);
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

  @Post('payments/webhook/:provider')
  webhook(
    @CurrentUser() user: JwtUser,
    @Param('provider') provider: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.gateways.webhook(user.tid, provider, payload);
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
}
