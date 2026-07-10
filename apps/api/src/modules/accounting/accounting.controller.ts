import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type JwtUser,
} from '../../common/decorators/current-user.decorator';
import { RequireAnyPermission } from '../../common/decorators/require-permissions.decorator';
import {
  BooksQueryDto,
  CreateAccountGroupDto,
  CreateBudgetDto,
  CreateExpenseDto,
  CreateFinancialYearDto,
  CreateFixedAssetDto,
  CreateBankReconciliationDto,
  CreateLedgerAccountDto,
  CreateVendorDto,
  CreateVoucherDto,
  ExpenseListQueryDto,
  ImportBankStatementDto,
  LedgerQueryDto,
  ListQueryDto,
  RunDepreciationDto,
  UpdateAccountGroupDto,
  UpdateAccountingSettingsDto,
  UpdateBudgetDto,
  UpdateExpenseDto,
  UpdateFixedAssetDto,
  UpdateLedgerAccountDto,
  UpdateVendorDto,
  UpdateVoucherDto,
  UpsertFeeHeadMappingDto,
  UpsertPaymentModeMappingDto,
  UpsertPayrollComponentMappingDto,
  VoucherListQueryDto,
} from './dto/accounting.dto';
import { AccountingDashboardService } from './services/accounting-dashboard.service';
import { AccountingAuditService } from './services/accounting-audit.service';
import { AccountingSettingsService } from './services/accounting-settings.service';
import { BooksService } from './services/books.service';
import { ChartOfAccountsService } from './services/chart-of-accounts.service';
import { BudgetService, ExpenseService } from './services/expense.service';
import {
  BankReconciliationService,
  FixedAssetService,
} from './services/fixed-asset.service';
import { FinancialYearService } from './services/financial-year.service';
import { AccountingReportExportService } from './services/accounting-report-export.service';
import { FinancialReportsService } from './services/financial-reports.service';
import { VendorService } from './services/vendor.service';
import { VoucherService } from './services/voucher.service';

const ACC_READ = ['accounts:read', 'accounts:manage', 'accounts:post'] as const;
const ACC_MANAGE = ['accounts:manage'] as const;
const ACC_POST = ['accounts:post', 'accounts:manage'] as const;

@ApiBearerAuth()
@ApiTags('accounting')
@Controller({ path: 'accounting', version: '1' })
export class AccountingController {
  constructor(
    private readonly dashboard: AccountingDashboardService,
    private readonly financialYears: FinancialYearService,
    private readonly chartOfAccounts: ChartOfAccountsService,
    private readonly vouchers: VoucherService,
    private readonly books: BooksService,
    private readonly settings: AccountingSettingsService,
    private readonly vendors: VendorService,
    private readonly expenses: ExpenseService,
    private readonly budgets: BudgetService,
    private readonly fixedAssets: FixedAssetService,
    private readonly bankReconciliation: BankReconciliationService,
    private readonly reports: FinancialReportsService,
    private readonly reportExports: AccountingReportExportService,
    private readonly audit: AccountingAuditService,
  ) {}

  @Get('dashboard')
  @RequireAnyPermission(...ACC_READ)
  getDashboard(@CurrentUser() user: JwtUser) {
    return this.dashboard.summary(user.tid);
  }

  @Get('financial-years')
  @RequireAnyPermission(...ACC_READ)
  listFinancialYears(@CurrentUser() user: JwtUser) {
    return this.financialYears.list(user.tid);
  }

  @Get('financial-years/active')
  @RequireAnyPermission(...ACC_READ)
  getActiveFinancialYear(@CurrentUser() user: JwtUser) {
    return this.financialYears.getActive(user.tid);
  }

  @Post('financial-years')
  @RequireAnyPermission(...ACC_MANAGE)
  createFinancialYear(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFinancialYearDto,
  ) {
    return this.financialYears.create(user.tid, dto);
  }

  @Post('financial-years/:id/activate')
  @RequireAnyPermission(...ACC_MANAGE)
  activateFinancialYear(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.financialYears.activate(user.tid, id);
  }

  @Get('chart-of-accounts/groups')
  @RequireAnyPermission(...ACC_READ)
  listGroups(@CurrentUser() user: JwtUser) {
    return this.chartOfAccounts.listGroups(user.tid);
  }

  @Post('chart-of-accounts/groups')
  @RequireAnyPermission(...ACC_MANAGE)
  createGroup(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAccountGroupDto,
  ) {
    return this.chartOfAccounts.createGroup(user.tid, dto);
  }

  @Patch('chart-of-accounts/groups/:id')
  @RequireAnyPermission(...ACC_MANAGE)
  updateGroup(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateAccountGroupDto,
  ) {
    return this.chartOfAccounts.updateGroup(user.tid, id, dto);
  }

  @Get('chart-of-accounts/ledgers')
  @RequireAnyPermission(...ACC_READ)
  listLedgers(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.chartOfAccounts.listLedgers(user.tid, query);
  }

  @Get('chart-of-accounts/ledgers/:id')
  @RequireAnyPermission(...ACC_READ)
  getLedger(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.chartOfAccounts.getLedger(user.tid, id);
  }

  @Post('chart-of-accounts/ledgers')
  @RequireAnyPermission(...ACC_MANAGE)
  createLedger(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateLedgerAccountDto,
  ) {
    return this.chartOfAccounts.createLedger(user.tid, dto);
  }

  @Patch('chart-of-accounts/ledgers/:id')
  @RequireAnyPermission(...ACC_MANAGE)
  updateLedger(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateLedgerAccountDto,
  ) {
    return this.chartOfAccounts.updateLedger(user.tid, id, dto);
  }

  @Get('voucher-types')
  @RequireAnyPermission(...ACC_READ)
  listVoucherTypes(@CurrentUser() user: JwtUser) {
    return this.vouchers.listTypes(user.tid);
  }

  @Get('vouchers')
  @RequireAnyPermission(...ACC_READ)
  listVouchers(
    @CurrentUser() user: JwtUser,
    @Query() query: VoucherListQueryDto,
  ) {
    return this.vouchers.list(user.tid, query);
  }

  @Get('vouchers/:id')
  @RequireAnyPermission(...ACC_READ)
  getVoucher(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.vouchers.get(user.tid, id);
  }

  @Post('vouchers')
  @RequireAnyPermission(...ACC_MANAGE)
  createVoucher(@CurrentUser() user: JwtUser, @Body() dto: CreateVoucherDto) {
    return this.vouchers.create(user.tid, dto, user.sub);
  }

  @Patch('vouchers/:id')
  @RequireAnyPermission(...ACC_MANAGE)
  updateVoucher(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateVoucherDto,
  ) {
    return this.vouchers.update(user.tid, id, dto);
  }

  @Post('vouchers/:id/post')
  @RequireAnyPermission(...ACC_POST)
  postVoucher(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.vouchers.post(
      user.tid,
      id,
      user.sub,
      req.ip ?? req.socket.remoteAddress,
    );
  }

  @Get('books/cash')
  @RequireAnyPermission(...ACC_READ)
  cashBook(@CurrentUser() user: JwtUser, @Query() query: BooksQueryDto) {
    return this.books.cashBook(user.tid, query);
  }

  @Get('books/bank')
  @RequireAnyPermission(...ACC_READ)
  bankBook(@CurrentUser() user: JwtUser, @Query() query: BooksQueryDto) {
    return this.books.bankBook(user.tid, query);
  }

  @Get('books/ledger')
  @RequireAnyPermission(...ACC_READ)
  generalLedger(@CurrentUser() user: JwtUser, @Query() query: LedgerQueryDto) {
    return this.books.generalLedger(user.tid, query);
  }

  @Get('dashboard/insights')
  @RequireAnyPermission(...ACC_READ)
  dashboardInsights(@CurrentUser() user: JwtUser) {
    return this.reports.insights(user.tid);
  }

  @Get('reports/trial-balance')
  @RequireAnyPermission(...ACC_READ)
  trialBalance(@CurrentUser() user: JwtUser, @Query() query: BooksQueryDto) {
    return this.reports.trialBalance(user.tid, query);
  }

  @Get('reports/profit-loss')
  @RequireAnyPermission(...ACC_READ)
  profitAndLoss(@CurrentUser() user: JwtUser, @Query() query: BooksQueryDto) {
    return this.reports.profitAndLoss(user.tid, query);
  }

  @Get('reports/balance-sheet')
  @RequireAnyPermission(...ACC_READ)
  balanceSheet(@CurrentUser() user: JwtUser, @Query() query: BooksQueryDto) {
    return this.reports.balanceSheet(user.tid, query);
  }

  @Get('reports/trial-balance/export')
  @RequireAnyPermission(...ACC_READ)
  async exportTrialBalance(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query() query: BooksQueryDto,
    @Query('format') format?: string,
  ) {
    const result = await this.reportExports.exportTrialBalance(
      user.tid,
      query,
      format === 'xlsx' ? 'xlsx' : 'pdf',
    );
    return this.sendReportExport(res, result);
  }

  @Get('reports/profit-loss/export')
  @RequireAnyPermission(...ACC_READ)
  async exportProfitAndLoss(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query() query: BooksQueryDto,
    @Query('format') format?: string,
  ) {
    const result = await this.reportExports.exportProfitAndLoss(
      user.tid,
      query,
      format === 'xlsx' ? 'xlsx' : 'pdf',
    );
    return this.sendReportExport(res, result);
  }

  @Get('reports/balance-sheet/export')
  @RequireAnyPermission(...ACC_READ)
  async exportBalanceSheet(
    @CurrentUser() user: JwtUser,
    @Res() res: Response,
    @Query() query: BooksQueryDto,
    @Query('format') format?: string,
  ) {
    const result = await this.reportExports.exportBalanceSheet(
      user.tid,
      query,
      format === 'xlsx' ? 'xlsx' : 'pdf',
    );
    return this.sendReportExport(res, result);
  }

  @Get('audit-logs')
  @RequireAnyPermission(...ACC_READ)
  listAuditLogs(
    @CurrentUser() user: JwtUser,
    @Query() query: ListQueryDto,
    @Query('entityType') entityType?: string,
  ) {
    return this.audit.list(user.tid, {
      page: query.page,
      limit: query.limit,
      entityType,
    });
  }

  @Get('settings')
  @RequireAnyPermission(...ACC_READ)
  getSettings(@CurrentUser() user: JwtUser) {
    return this.settings.getSettings(user.tid);
  }

  @Patch('settings')
  @RequireAnyPermission(...ACC_MANAGE)
  updateSettings(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateAccountingSettingsDto,
  ) {
    return this.settings.updateSettings(user.tid, dto);
  }

  @Get('integrations/fee-head-mappings')
  @RequireAnyPermission(...ACC_READ)
  listFeeHeadMappings(@CurrentUser() user: JwtUser) {
    return this.settings.listFeeHeadMappings(user.tid);
  }

  @Post('integrations/fee-head-mappings')
  @RequireAnyPermission(...ACC_MANAGE)
  upsertFeeHeadMapping(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertFeeHeadMappingDto,
  ) {
    return this.settings.upsertFeeHeadMapping(user.tid, dto);
  }

  @Get('integrations/payment-mode-mappings')
  @RequireAnyPermission(...ACC_READ)
  listPaymentModeMappings(@CurrentUser() user: JwtUser) {
    return this.settings.listPaymentModeMappings(user.tid);
  }

  @Post('integrations/payment-mode-mappings')
  @RequireAnyPermission(...ACC_MANAGE)
  upsertPaymentModeMapping(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertPaymentModeMappingDto,
  ) {
    return this.settings.upsertPaymentModeMapping(user.tid, dto);
  }

  @Get('integrations/payroll-component-mappings')
  @RequireAnyPermission(...ACC_READ)
  listPayrollComponentMappings(@CurrentUser() user: JwtUser) {
    return this.settings.listPayrollComponentMappings(user.tid);
  }

  @Post('integrations/payroll-component-mappings')
  @RequireAnyPermission(...ACC_MANAGE)
  upsertPayrollComponentMapping(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpsertPayrollComponentMappingDto,
  ) {
    return this.settings.upsertPayrollComponentMapping(user.tid, dto);
  }

  @Get('vendors')
  @RequireAnyPermission(...ACC_READ)
  listVendors(@CurrentUser() user: JwtUser, @Query() query: ListQueryDto) {
    return this.vendors.list(user.tid, query);
  }

  @Post('vendors')
  @RequireAnyPermission(...ACC_MANAGE)
  createVendor(@CurrentUser() user: JwtUser, @Body() dto: CreateVendorDto) {
    return this.vendors.create(user.tid, dto);
  }

  @Patch('vendors/:id')
  @RequireAnyPermission(...ACC_MANAGE)
  updateVendor(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendors.update(user.tid, id, dto);
  }

  @Get('expenses')
  @RequireAnyPermission(...ACC_READ)
  listExpenses(
    @CurrentUser() user: JwtUser,
    @Query() query: ExpenseListQueryDto,
  ) {
    return this.expenses.list(user.tid, query);
  }

  @Post('expenses')
  @RequireAnyPermission(...ACC_MANAGE)
  createExpense(@CurrentUser() user: JwtUser, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(user.tid, dto, user.sub);
  }

  @Patch('expenses/:id')
  @RequireAnyPermission(...ACC_MANAGE)
  updateExpense(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenses.update(user.tid, id, dto);
  }

  @Post('expenses/:id/approve')
  @RequireAnyPermission(...ACC_POST)
  approveExpense(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.expenses.approve(user.tid, id, user.sub);
  }

  @Get('budgets')
  @RequireAnyPermission(...ACC_READ)
  listBudgets(
    @CurrentUser() user: JwtUser,
    @Query('financialYearId') financialYearId?: string,
  ) {
    return this.budgets.list(user.tid, financialYearId);
  }

  @Post('budgets')
  @RequireAnyPermission(...ACC_MANAGE)
  createBudget(@CurrentUser() user: JwtUser, @Body() dto: CreateBudgetDto) {
    return this.budgets.create(user.tid, dto);
  }

  @Patch('budgets/:id')
  @RequireAnyPermission(...ACC_MANAGE)
  updateBudget(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.budgets.update(user.tid, id, dto);
  }

  @Get('fixed-assets')
  @RequireAnyPermission(...ACC_READ)
  listFixedAssets(
    @CurrentUser() user: JwtUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.fixedAssets.list(user.tid, { search, status });
  }

  @Post('fixed-assets')
  @RequireAnyPermission(...ACC_MANAGE)
  createFixedAsset(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFixedAssetDto,
  ) {
    return this.fixedAssets.create(user.tid, dto);
  }

  @Patch('fixed-assets/:id')
  @RequireAnyPermission(...ACC_MANAGE)
  updateFixedAsset(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateFixedAssetDto,
  ) {
    return this.fixedAssets.update(user.tid, id, dto);
  }

  @Get('depreciation-entries')
  @RequireAnyPermission(...ACC_READ)
  listDepreciationEntries(
    @CurrentUser() user: JwtUser,
    @Query('periodYear') periodYear?: string,
    @Query('periodMonth') periodMonth?: string,
    @Query('status') status?: string,
  ) {
    return this.fixedAssets.listDepreciationEntries(user.tid, {
      periodYear: periodYear ? Number(periodYear) : undefined,
      periodMonth: periodMonth ? Number(periodMonth) : undefined,
      status,
    });
  }

  @Post('depreciation/run')
  @RequireAnyPermission(...ACC_POST)
  runDepreciation(
    @CurrentUser() user: JwtUser,
    @Body() dto: RunDepreciationDto,
  ) {
    return this.fixedAssets.runDepreciation(
      user.tid,
      dto.periodYear,
      dto.periodMonth,
      user.sub,
    );
  }

  @Get('bank-reconciliations')
  @RequireAnyPermission(...ACC_READ)
  listBankReconciliations(
    @CurrentUser() user: JwtUser,
    @Query('ledgerAccountId') ledgerAccountId?: string,
  ) {
    return this.bankReconciliation.list(user.tid, ledgerAccountId);
  }

  @Get('bank-reconciliations/:id')
  @RequireAnyPermission(...ACC_READ)
  getBankReconciliation(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.bankReconciliation.get(user.tid, id);
  }

  @Post('bank-reconciliations')
  @RequireAnyPermission(...ACC_MANAGE)
  createBankReconciliation(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateBankReconciliationDto,
  ) {
    return this.bankReconciliation.create(user.tid, dto, user.sub);
  }

  @Post('bank-reconciliations/:id/import')
  @RequireAnyPermission(...ACC_MANAGE)
  importBankStatement(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: ImportBankStatementDto,
  ) {
    return this.bankReconciliation.importLines(user.tid, id, dto.lines);
  }

  @Post('bank-reconciliations/:id/auto-match')
  @RequireAnyPermission(...ACC_MANAGE)
  autoMatchBankReconciliation(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.bankReconciliation.autoMatch(user.tid, id);
  }

  @Post('bank-reconciliations/:id/reconcile')
  @RequireAnyPermission(...ACC_POST)
  finalizeBankReconciliation(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.bankReconciliation.reconcile(user.tid, id, user.sub);
  }

  private sendReportExport(
    res: Response,
    result: { format: 'pdf' | 'xlsx'; buffer: Buffer; filename: string },
  ) {
    res.setHeader(
      'Content-Type',
      result.format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader('Content-Length', String(result.buffer.length));
    return res.send(result.buffer);
  }
}
