import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Version,
  forwardRef,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  ActivateGatewayDto,
  ConfigureGatewayDto,
  ReplayWebhookDto,
  TransactionLogQueryDto,
  UpdatePaymentSettingsDto,
  WebhookLogQueryDto,
} from './dto/payment-gateway.dto';
import { PaymentGatewayHealthService } from './services/payment-gateway-health.service';
import { PaymentGatewayManagementService } from './services/payment-gateway-management.service';
import { PaymentGatewaySettingsService } from './services/payment-gateway-settings.service';
import { PaymentGatewayTransactionLogService } from './services/payment-gateway-transaction-log.service';
import { PaymentGatewayWebhookLogService } from './services/payment-gateway-webhook-log.service';
import { PaymentGatewayAuditService } from './services/payment-gateway-audit.service';
import { PaymentGatewayResolverService } from './services/payment-gateway-resolver.service';
import { GatewayPaymentService } from '../fees/services/gateway-payment.service';
import { TenantResolutionService } from '../tenants/tenant-resolution.service';

@Controller('payment-gateway')
export class PaymentGatewayController {
  constructor(
    private readonly management: PaymentGatewayManagementService,
    private readonly settings: PaymentGatewaySettingsService,
    private readonly health: PaymentGatewayHealthService,
    private readonly transactions: PaymentGatewayTransactionLogService,
    private readonly webhooks: PaymentGatewayWebhookLogService,
    private readonly audit: PaymentGatewayAuditService,
    private readonly resolver: PaymentGatewayResolverService,
    @Inject(forwardRef(() => GatewayPaymentService))
    private readonly gatewayPayments: GatewayPaymentService,
    private readonly tenants: TenantResolutionService,
  ) {}

  @Get('gateways')
  @Version('1')
  @RequireAnyPermission(
    'payment-gateway:read',
    'payment-gateway:manage',
    'fees:manage',
  )
  listGateways(@CurrentUser() user: JwtUser) {
    return this.management.listGateways(user.tid);
  }

  @Get('gateways/active')
  @Version('1')
  @RequireAnyPermission(
    'payment-gateway:read',
    'payment-gateway:manage',
    'fees:manage',
  )
  activeGateway(@CurrentUser() user: JwtUser) {
    return this.management.getActiveGateway(user.tid);
  }

  @Patch('gateways/:providerCode/configure')
  @Version('1')
  @RequireAnyPermission('payment-gateway:manage', 'fees:manage')
  configure(
    @CurrentUser() user: JwtUser,
    @Param('providerCode') providerCode: string,
    @Body() dto: ConfigureGatewayDto,
    @Ip() ip: string,
  ) {
    return this.management.configure(user, providerCode, dto, ip);
  }

  @Post('gateways/:providerCode/activate')
  @Version('1')
  @RequireAnyPermission('payment-gateway:manage', 'fees:manage')
  activate(
    @CurrentUser() user: JwtUser,
    @Param('providerCode') providerCode: string,
    @Ip() ip: string,
  ) {
    return this.management.activate(user, providerCode, ip);
  }

  @Post('gateways/:providerCode/deactivate')
  @Version('1')
  @RequireAnyPermission('payment-gateway:manage', 'fees:manage')
  deactivate(
    @CurrentUser() user: JwtUser,
    @Param('providerCode') providerCode: string,
    @Ip() ip: string,
  ) {
    return this.management.deactivate(user, providerCode, ip);
  }

  @Post('gateways/:providerCode/enable')
  @Version('1')
  @RequireAnyPermission('payment-gateway:manage', 'fees:manage')
  enable(
    @CurrentUser() user: JwtUser,
    @Param('providerCode') providerCode: string,
    @Ip() ip: string,
  ) {
    return this.management.setStatus(user, providerCode, 'ENABLED', ip);
  }

  @Post('gateways/:providerCode/disable')
  @Version('1')
  @RequireAnyPermission('payment-gateway:manage', 'fees:manage')
  disable(
    @CurrentUser() user: JwtUser,
    @Param('providerCode') providerCode: string,
    @Ip() ip: string,
  ) {
    return this.management.setStatus(user, providerCode, 'DISABLED', ip);
  }

  @Post('gateways/:providerCode/test')
  @Version('1')
  @RequireAnyPermission('payment-gateway:manage', 'fees:manage')
  testConnection(
    @CurrentUser() user: JwtUser,
    @Param('providerCode') providerCode: string,
  ) {
    return this.health.testGateway(user.tid, providerCode);
  }

  @Get('health')
  @Version('1')
  @RequireAnyPermission(
    'payment-gateway:read',
    'payment-gateway:manage',
    'fees:manage',
  )
  healthMonitor(@CurrentUser() user: JwtUser) {
    return this.health.checkTenant(user.tid);
  }

  @Get('settings')
  @Version('1')
  @RequireAnyPermission(
    'payment-gateway:read',
    'payment-gateway:manage',
    'fees:manage',
  )
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.get(user.tid);
  }

  @Patch('settings')
  @Version('1')
  @RequireAnyPermission('payment-gateway:manage', 'fees:manage')
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdatePaymentSettingsDto,
  ) {
    return this.settings.update(user.tid, dto as Record<string, unknown>);
  }

  @Get('transactions')
  @Version('1')
  @RequireAnyPermission(
    'payment-gateway:read',
    'payment-gateway:manage',
    'fees:read',
    'fees:manage',
  )
  transactionLogs(
    @CurrentUser() user: JwtUser,
    @Query() query: TransactionLogQueryDto,
  ) {
    return this.transactions.list(user.tid, query);
  }

  @Get('webhooks')
  @Version('1')
  @RequireAnyPermission(
    'payment-gateway:read',
    'payment-gateway:manage',
    'fees:manage',
  )
  webhookLogs(
    @CurrentUser() user: JwtUser,
    @Query() query: WebhookLogQueryDto,
  ) {
    return this.webhooks.list(user.tid, query);
  }

  @Post('webhooks/replay')
  @Version('1')
  @RequireAnyPermission('payment-gateway:manage', 'fees:manage')
  async replayWebhook(
    @CurrentUser() user: JwtUser,
    @Body() dto: ReplayWebhookDto,
  ) {
    const log = await this.webhooks.list(user.tid, { limit: 1, offset: 0 });
    const entry = log.items.find(
      (i: { id: string }) => i.id === dto.webhookLogId,
    );
    if (!entry) {
      return { replayed: false, message: 'Webhook log not found.' };
    }
    await this.gatewayPayments.webhook(
      user.tid,
      entry.providerCode,
      entry.payload as Record<string, unknown>,
    );
    await this.webhooks.markReplayed(dto.webhookLogId, user.tid);
    return { replayed: true };
  }

  @Get('audit')
  @Version('1')
  @RequireAnyPermission('payment-gateway:manage', 'fees:manage')
  auditLogs(@CurrentUser() user: JwtUser) {
    return this.audit.list(user.tid);
  }

  @Public()
  @Post('webhook/:providerCode')
  @Version('1')
  async publicWebhook(
    @Param('providerCode') providerCode: string,
    @Headers('host') host: string,
    @Headers('x-razorpay-signature') razorpaySignature: string | undefined,
    @Headers('x-webhook-signature')
    cashfreeWebhookSignature: string | undefined,
    @Headers('x-webhook-timestamp')
    cashfreeWebhookTimestamp: string | undefined,
    @Req() req: { rawBody?: Buffer; body?: Record<string, unknown> },
  ) {
    const tenant = await this.tenants.resolveHost(host);
    const code = providerCode.toUpperCase();
    const rawBody =
      req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {});
    const signature =
      razorpaySignature ??
      cashfreeWebhookSignature ??
      (code === 'BILLDESK' || code === 'NTT_DATA' ? rawBody : undefined) ??
      (req.body as { signature?: string })?.signature;

    const verified = await this.resolver.verifyWebhook(
      tenant.id,
      providerCode,
      rawBody,
      signature,
      cashfreeWebhookTimestamp
        ? { timestamp: cashfreeWebhookTimestamp }
        : undefined,
    );

    let payload: Record<string, unknown>;
    if (code === 'BILLDESK') {
      payload = { _billdeskJws: rawBody };
    } else if (code === 'NTT_DATA') {
      payload = { _nttDataRaw: rawBody };
    } else if (code === 'CASHFREE') {
      payload =
        req.body && Object.keys(req.body).length > 0
          ? req.body
          : (JSON.parse(rawBody) as Record<string, unknown>);
    } else {
      payload = (req.body ?? {}) as Record<string, unknown>;
    }

    await this.webhooks.record({
      tenantId: tenant.id,
      providerCode,
      eventName: String(
        payload.event ??
          payload.type ??
          (code === 'BILLDESK' ? 'billdesk' : 'unknown'),
      ),
      payload,
      verificationStatus: verified ? 'VERIFIED' : 'FAILED',
      processingStatus: verified ? 'PENDING' : 'REJECTED',
    });

    if (!verified) {
      return { received: false, error: 'Invalid signature' };
    }

    await this.gatewayPayments.webhook(tenant.id, code, payload);

    return { received: true };
  }
}
