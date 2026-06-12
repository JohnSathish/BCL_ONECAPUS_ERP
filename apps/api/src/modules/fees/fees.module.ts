import { Module } from '@nestjs/common';
import { CourseDeliveryFeeService } from '../../common/services/course-delivery-fee.service';
import { CommunicationModule } from '../communication/communication.module';
import { LicensingModule } from '../licensing/licensing.module';
import { FeesController } from './fees.controller';
import { FeeDemandEngineService } from './services/fee-demand-engine.service';
import { FeeLedgerService } from './services/fee-ledger.service';
import { FeeReportsService } from './services/fee-reports.service';
import { FeeStructureService } from './services/fee-structure.service';
import { FineConcessionService } from './services/fine-concession.service';
import { GatewayPaymentService } from './services/gateway-payment.service';
import { PaymentCollectionService } from './services/payment-collection.service';
import { RenewalFeeService } from './services/renewal-fee.service';

@Module({
  imports: [CommunicationModule, LicensingModule],
  controllers: [FeesController],
  providers: [
    CourseDeliveryFeeService,
    FeeStructureService,
    FeeDemandEngineService,
    RenewalFeeService,
    FeeLedgerService,
    PaymentCollectionService,
    GatewayPaymentService,
    FineConcessionService,
    FeeReportsService,
  ],
  exports: [
    FeeStructureService,
    FeeDemandEngineService,
    FeeLedgerService,
    FeeReportsService,
  ],
})
export class FeesModule {}
