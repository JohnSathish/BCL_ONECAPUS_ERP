import { Module } from '@nestjs/common';
import { CourseDeliveryFeeService } from '../../common/services/course-delivery-fee.service';
import { CommunicationModule } from '../communication/communication.module';
import { LicensingModule } from '../licensing/licensing.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CacheModule } from '../../shared/cache/cache.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { FeesController } from './fees.controller';
import { FeeCycleConfigService } from './services/fee-cycle-config.service';
import { FeeCycleEngineService } from './services/fee-cycle-engine.service';
import { FeeEnforcementService } from './services/fee-enforcement.service';
import { FeeFinanceSettingsService } from './services/fee-finance-settings.service';
import { FeeFineEngineService } from './services/fee-fine-engine.service';
import { FeeHeadMasterService } from './services/fee-head-master.service';
import { FeeDemandEngineService } from './services/fee-demand-engine.service';
import { FeeLedgerService } from './services/fee-ledger.service';
import { FeeReceiptDocumentService } from './services/fee-receipt-document.service';
import { FeeReceiptNotificationService } from './services/fee-receipt-notification.service';
import { FeePaymentRequestService } from './services/fee-payment-request.service';
import { FeeReversalService } from './services/fee-reversal.service';
import { FeeReminderService } from './services/fee-reminder.service';
import { FeeReportsService } from './services/fee-reports.service';
import { FeeSchedulerService } from './services/fee-scheduler.service';
import { FeeStructureService } from './services/fee-structure.service';
import { FineConcessionService } from './services/fine-concession.service';
import { GatewayPaymentService } from './services/gateway-payment.service';
import { MonthlyFeeEngineService } from './services/monthly-fee-engine.service';
import { MonthlyFeePlanService } from './services/monthly-fee-plan.service';
import { PaymentCollectionService } from './services/payment-collection.service';
import { RenewalFeeService } from './services/renewal-fee.service';
import { ScholarshipSchemeService } from './services/scholarship-scheme.service';
import { StudentFeeAccountService } from './services/student-fee-account.service';
import { StudentFeeSummaryService } from './services/student-fee-summary.service';
import { ExternalFeePaymentService } from './services/external-fee-payment.service';
import { FeeReceiptPdfProcessor } from './processors/fee-receipt-pdf.processor';

@Module({
  imports: [
    CommunicationModule,
    LicensingModule,
    TenantsModule,
    CacheModule,
    StorageModule,
  ],
  controllers: [FeesController],
  providers: [
    CourseDeliveryFeeService,
    FeeStructureService,
    FeeHeadMasterService,
    FeeCycleConfigService,
    FeeCycleEngineService,
    FeeDemandEngineService,
    RenewalFeeService,
    FeeLedgerService,
    PaymentCollectionService,
    GatewayPaymentService,
    FineConcessionService,
    FeeReportsService,
    FeeFinanceSettingsService,
    MonthlyFeePlanService,
    MonthlyFeeEngineService,
    FeeSchedulerService,
    FeeFineEngineService,
    StudentFeeAccountService,
    StudentFeeSummaryService,
    FeeEnforcementService,
    FeeReceiptDocumentService,
    FeeReceiptNotificationService,
    FeePaymentRequestService,
    FeeReversalService,
    FeeReminderService,
    ExternalFeePaymentService,
    ScholarshipSchemeService,
    FeeReceiptPdfProcessor,
  ],
  exports: [
    FeeStructureService,
    FeeDemandEngineService,
    FeeLedgerService,
    FeeReportsService,
    FeeCycleEngineService,
    FeeEnforcementService,
    MonthlyFeeEngineService,
    StudentFeeAccountService,
    StudentFeeSummaryService,
    FeeReceiptPdfProcessor,
  ],
})
export class FeesModule {}
