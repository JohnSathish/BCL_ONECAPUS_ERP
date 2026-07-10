import { Module, forwardRef } from '@nestjs/common';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { FeesModule } from '../fees/fees.module';
import { TenantsModule } from '../tenants/tenants.module';
import { RazorpayGatewayAdapter } from './adapters/razorpay.adapter';
import { BilldeskGatewayAdapter } from './adapters/billdesk.adapter';
import { CashfreeGatewayAdapter } from './adapters/cashfree.adapter';
import { NttDataGatewayAdapter } from './adapters/nttdata.adapter';
import { PaymentGatewayController } from './payment-gateway.controller';
import { PaymentGatewayFactory } from './payment-gateway.factory';
import { PaymentGatewayAuditService } from './services/payment-gateway-audit.service';
import { PaymentGatewayCredentialsService } from './services/payment-gateway-credentials.service';
import { PaymentGatewayHealthService } from './services/payment-gateway-health.service';
import { PaymentGatewayManagementService } from './services/payment-gateway-management.service';
import { PaymentGatewayResolverService } from './services/payment-gateway-resolver.service';
import { PaymentGatewaySettingsService } from './services/payment-gateway-settings.service';
import { PaymentGatewayTransactionLogService } from './services/payment-gateway-transaction-log.service';
import { PaymentGatewayWebhookLogService } from './services/payment-gateway-webhook-log.service';

@Module({
  imports: [CryptoModule, TenantsModule, forwardRef(() => FeesModule)],
  controllers: [PaymentGatewayController],
  providers: [
    RazorpayGatewayAdapter,
    CashfreeGatewayAdapter,
    BilldeskGatewayAdapter,
    NttDataGatewayAdapter,
    PaymentGatewayFactory,
    PaymentGatewayCredentialsService,
    PaymentGatewayResolverService,
    PaymentGatewayManagementService,
    PaymentGatewayHealthService,
    PaymentGatewaySettingsService,
    PaymentGatewayTransactionLogService,
    PaymentGatewayWebhookLogService,
    PaymentGatewayAuditService,
  ],
  exports: [
    PaymentGatewayResolverService,
    PaymentGatewayCredentialsService,
    PaymentGatewayWebhookLogService,
  ],
})
export class PaymentGatewayModule {}
