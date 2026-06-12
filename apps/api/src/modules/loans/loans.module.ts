import { Module } from '@nestjs/common';

import { CommunicationModule } from '../communication/communication.module';

import { LoansController } from './loans.controller';

import { LoansDashboardService } from './services/loans-dashboard.service';

import { LoansManagementService } from './services/loans-management.service';

import { LoansPayrollBridgeService } from './services/loans-payroll-bridge.service';

import { LoansReceiptDocumentService } from './services/loans-receipt-document.service';

import { LoansReceiptService } from './services/loans-receipt.service';

import { LoansReportsService } from './services/loans-reports.service';

import { LoansSetupService } from './services/loans-setup.service';

@Module({
  imports: [CommunicationModule],

  controllers: [LoansController],

  providers: [
    LoansSetupService,

    LoansManagementService,

    LoansDashboardService,

    LoansReportsService,

    LoansPayrollBridgeService,

    LoansReceiptDocumentService,

    LoansReceiptService,
  ],

  exports: [
    LoansManagementService,
    LoansPayrollBridgeService,
    LoansSetupService,
    LoansReceiptService,
  ],
})
export class LoansModule {}
