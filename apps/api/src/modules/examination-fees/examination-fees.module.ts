import { Module } from '@nestjs/common';
import { FeesModule } from '../fees/fees.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { ExaminationFeesController } from './examination-fees.controller';
import { ExamApplicationService } from './services/exam-application.service';
import { ExamDashboardService } from './services/exam-dashboard.service';
import { ExamFeeCalcService } from './services/exam-fee-calc.service';
import { ExamFeeMasterService } from './services/exam-fee-master.service';
import { ExamFeeSessionService } from './services/exam-fee-session.service';
import { ExamFeeSettingsService } from './services/exam-fee-settings.service';
import { ExamPaymentService } from './services/exam-payment.service';
import { ExamReceiptService } from './services/exam-receipt.service';
import { ExamReportService } from './services/exam-report.service';
import { ExamVerificationService } from './services/exam-verification.service';

@Module({
  imports: [FeesModule, StorageModule],
  controllers: [ExaminationFeesController],
  providers: [
    ExamFeeSettingsService,
    ExamFeeMasterService,
    ExamFeeSessionService,
    ExamFeeCalcService,
    ExamApplicationService,
    ExamReceiptService,
    ExamPaymentService,
    ExamVerificationService,
    ExamDashboardService,
    ExamReportService,
  ],
  exports: [
    ExamApplicationService,
    ExamDashboardService,
    ExamReportService,
    ExamReceiptService,
    ExamPaymentService,
    ExamVerificationService,
    ExamFeeSessionService,
  ],
})
export class ExaminationFeesModule {}
