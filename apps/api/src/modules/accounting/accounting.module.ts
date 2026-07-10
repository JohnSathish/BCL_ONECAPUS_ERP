import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountingAuditService } from './services/accounting-audit.service';
import { AccountingBootstrapService } from './services/accounting-bootstrap.service';
import { AccountingDashboardService } from './services/accounting-dashboard.service';
import { AccountingSettingsService } from './services/accounting-settings.service';
import { AutoVoucherService } from './services/auto-voucher.service';
import { BooksService } from './services/books.service';
import { BudgetService, ExpenseService } from './services/expense.service';
import { ChartOfAccountsService } from './services/chart-of-accounts.service';
import { FeesJournalBridgeService } from './services/fees-journal-bridge.service';
import {
  BankReconciliationService,
  FixedAssetService,
} from './services/fixed-asset.service';
import { FinancialYearService } from './services/financial-year.service';
import { AccountingReportExportService } from './services/accounting-report-export.service';
import { FinancialReportsService } from './services/financial-reports.service';
import { PayrollJournalBridgeService } from './services/payroll-journal-bridge.service';
import { PostingService } from './services/posting.service';
import { VendorService } from './services/vendor.service';
import { VoucherService } from './services/voucher.service';

@Module({
  controllers: [AccountingController],
  providers: [
    AccountingAuditService,
    AccountingBootstrapService,
    AccountingDashboardService,
    AccountingSettingsService,
    AutoVoucherService,
    BooksService,
    BudgetService,
    ChartOfAccountsService,
    ExpenseService,
    FeesJournalBridgeService,
    AccountingReportExportService,
    FinancialReportsService,
    FixedAssetService,
    BankReconciliationService,
    FinancialYearService,
    PayrollJournalBridgeService,
    PostingService,
    VendorService,
    VoucherService,
  ],
  exports: [
    PostingService,
    VoucherService,
    FeesJournalBridgeService,
    PayrollJournalBridgeService,
    AutoVoucherService,
    AccountingSettingsService,
  ],
})
export class AccountingModule {}
