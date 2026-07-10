import { api } from '@/services/api';
import type {
  AccountingAccountGroup,
  AccountingBook,
  AccountingDashboardOverview,
  AccountingFinancialYear,
  AccountingLedgerAccount,
  AccountingVoucher,
  AccountingVoucherLine,
  AccountingVoucherType,
  Paginated,
} from '@/types/accounting';

export type CreateVoucherPayload = {
  voucherTypeId: string;
  voucherDate: string;
  narration?: string;
  referenceNo?: string;
  chequeNo?: string;
  paymentMode?: string;
  lines: AccountingVoucherLine[];
};

export type CreateLedgerPayload = {
  groupId: string;
  code: string;
  name: string;
  ledgerType?: string;
  isCash?: boolean;
  isBank?: boolean;
  bankName?: string;
  accountNumber?: string;
  openingBalance?: number;
};

export async function fetchAccountingDashboard() {
  const { data } = await api.get('/v1/accounting/dashboard');
  return data as AccountingDashboardOverview;
}

export async function fetchAccountingInsights() {
  const { data } = await api.get('/v1/accounting/dashboard/insights');
  return data as import('@/types/accounting').AccountingInsights;
}

export async function fetchTrialBalance(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/accounting/reports/trial-balance', { params });
  return data;
}

export async function fetchProfitAndLoss(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/accounting/reports/profit-loss', { params });
  return data;
}

export async function fetchBalanceSheet(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/accounting/reports/balance-sheet', { params });
  return data;
}

export async function downloadAccountingReportExport(
  report: 'trial-balance' | 'profit-loss' | 'balance-sheet',
  format: 'pdf' | 'xlsx',
  params?: Record<string, string | undefined>,
) {
  const res = await api.get(`/v1/accounting/reports/${report}/export`, {
    params: { ...params, format },
    responseType: 'blob',
    headers:
      format === 'pdf'
        ? { Accept: 'application/pdf' }
        : { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  });
  const blob = res.data as Blob;
  if (!(blob instanceof Blob) || blob.size < 500) {
    throw new Error('Export failed — the server returned an empty or invalid file.');
  }
  return blob;
}

export async function fetchAccountingAuditLogs(
  params?: Record<string, string | number | undefined>,
) {
  const { data } = await api.get('/v1/accounting/audit-logs', { params });
  return data as Paginated<import('@/types/accounting').AccountingAuditLog>;
}

export async function fetchFinancialYears() {
  const { data } = await api.get('/v1/accounting/financial-years');
  return data as AccountingFinancialYear[];
}

export async function fetchActiveFinancialYear() {
  const { data } = await api.get('/v1/accounting/financial-years/active');
  return data as AccountingFinancialYear;
}

export async function createFinancialYear(startYear: number) {
  const { data } = await api.post('/v1/accounting/financial-years', { startYear });
  return data as AccountingFinancialYear;
}

export async function activateFinancialYear(id: string) {
  const { data } = await api.post(`/v1/accounting/financial-years/${id}/activate`, {});
  return data as AccountingFinancialYear;
}

export async function fetchAccountGroups() {
  const { data } = await api.get('/v1/accounting/chart-of-accounts/groups');
  return data as AccountingAccountGroup[];
}

export async function fetchLedgers(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get('/v1/accounting/chart-of-accounts/ledgers', { params });
  return data as Paginated<AccountingLedgerAccount>;
}

export async function createLedger(payload: CreateLedgerPayload) {
  const { data } = await api.post('/v1/accounting/chart-of-accounts/ledgers', payload);
  return data as AccountingLedgerAccount;
}

export async function fetchVoucherTypes() {
  const { data } = await api.get('/v1/accounting/voucher-types');
  return data as AccountingVoucherType[];
}

export async function fetchVouchers(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get('/v1/accounting/vouchers', { params });
  return data as Paginated<AccountingVoucher>;
}

export async function fetchVoucher(id: string) {
  const { data } = await api.get(`/v1/accounting/vouchers/${id}`);
  return data as AccountingVoucher;
}

export async function createVoucher(payload: CreateVoucherPayload) {
  const { data } = await api.post('/v1/accounting/vouchers', payload);
  return data as AccountingVoucher;
}

export async function updateVoucher(id: string, payload: CreateVoucherPayload) {
  const { data } = await api.patch(`/v1/accounting/vouchers/${id}`, payload);
  return data as AccountingVoucher;
}

export async function postVoucher(id: string) {
  const { data } = await api.post(`/v1/accounting/vouchers/${id}/post`, {});
  return data as AccountingVoucher;
}

export async function fetchCashBook(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/accounting/books/cash', { params });
  return data as AccountingBook;
}

export async function fetchBankBook(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/accounting/books/bank', { params });
  return data as AccountingBook;
}

export async function fetchGeneralLedger(params: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/accounting/books/ledger', { params });
  return data as AccountingBook & { ledger: AccountingLedgerAccount };
}

export async function fetchAccountingSettings() {
  const { data } = await api.get('/v1/accounting/settings');
  return data as import('@/types/accounting').AccountingSettings;
}

export async function updateAccountingSettings(
  payload: Partial<import('@/types/accounting').AccountingSettings>,
) {
  const { data } = await api.patch('/v1/accounting/settings', payload);
  return data;
}

export async function fetchFeeHeadMappings() {
  const { data } = await api.get('/v1/accounting/integrations/fee-head-mappings');
  return data;
}

export async function fetchPaymentModeMappings() {
  const { data } = await api.get('/v1/accounting/integrations/payment-mode-mappings');
  return data;
}

export async function fetchVendors(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get('/v1/accounting/vendors', { params });
  return data as Paginated<import('@/types/accounting').AccountingVendor>;
}

export async function createVendor(payload: {
  code: string;
  name: string;
  gstin?: string;
  contactName?: string;
  phone?: string;
  email?: string;
}) {
  const { data } = await api.post('/v1/accounting/vendors', payload);
  return data;
}

export async function fetchExpenses(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get('/v1/accounting/expenses', { params });
  return data as Paginated<import('@/types/accounting').AccountingExpense>;
}

export async function createExpense(payload: {
  vendorId?: string;
  ledgerAccountId: string;
  departmentId?: string;
  expenseDate: string;
  amount: number;
  gstAmount?: number;
  description?: string;
  billNo?: string;
}) {
  const { data } = await api.post('/v1/accounting/expenses', payload);
  return data;
}

export async function updateExpense(
  id: string,
  payload: Partial<{
    vendorId: string;
    ledgerAccountId: string;
    departmentId: string;
    expenseDate: string;
    amount: number;
    gstAmount: number;
    description: string;
    billNo: string;
  }>,
) {
  const { data } = await api.patch(`/v1/accounting/expenses/${id}`, payload);
  return data;
}

export async function approveExpense(id: string) {
  const { data } = await api.post(`/v1/accounting/expenses/${id}/approve`, {});
  return data;
}

export async function fetchBudgets(financialYearId?: string) {
  const { data } = await api.get('/v1/accounting/budgets', {
    params: financialYearId ? { financialYearId } : undefined,
  });
  return data as import('@/types/accounting').AccountingBudget[];
}

export async function createBudget(payload: {
  financialYearId: string;
  departmentId?: string;
  ledgerAccountId: string;
  allocatedAmount: number;
  notes?: string;
}) {
  const { data } = await api.post('/v1/accounting/budgets', payload);
  return data;
}

export async function updateBudget(
  id: string,
  payload: Partial<{
    financialYearId: string;
    departmentId: string;
    ledgerAccountId: string;
    allocatedAmount: number;
    notes: string;
  }>,
) {
  const { data } = await api.patch(`/v1/accounting/budgets/${id}`, payload);
  return data;
}

export async function fetchPayrollComponentMappings() {
  const { data } = await api.get('/v1/accounting/integrations/payroll-component-mappings');
  return data;
}

export async function fetchFixedAssets(params?: Record<string, string | undefined>) {
  const { data } = await api.get('/v1/accounting/fixed-assets', { params });
  return data as import('@/types/accounting').AccountingFixedAsset[];
}

export async function createFixedAsset(payload: {
  code: string;
  name: string;
  category: string;
  acquisitionDate: string;
  cost: number;
  salvageValue?: number;
  usefulLifeMonths: number;
  assetLedgerId: string;
  accumDepreciationLedgerId: string;
  expenseLedgerId: string;
  location?: string;
}) {
  const { data } = await api.post('/v1/accounting/fixed-assets', payload);
  return data;
}

export async function updateFixedAsset(
  id: string,
  payload: Partial<{
    name: string;
    category: string;
    acquisitionDate: string;
    cost: number;
    salvageValue: number;
    usefulLifeMonths: number;
    assetLedgerId: string;
    accumDepreciationLedgerId: string;
    expenseLedgerId: string;
    location: string;
    status: string;
  }>,
) {
  const { data } = await api.patch(`/v1/accounting/fixed-assets/${id}`, payload);
  return data;
}

export async function fetchDepreciationEntries(
  params?: Record<string, string | number | undefined>,
) {
  const { data } = await api.get('/v1/accounting/depreciation-entries', { params });
  return data as import('@/types/accounting').AccountingDepreciationEntry[];
}

export async function runDepreciation(payload: { periodYear: number; periodMonth: number }) {
  const { data } = await api.post('/v1/accounting/depreciation/run', payload);
  return data as { entriesCreated: number; entriesPosted: number; voucherId: string | null };
}

export async function fetchBankReconciliations(ledgerAccountId?: string) {
  const { data } = await api.get('/v1/accounting/bank-reconciliations', {
    params: ledgerAccountId ? { ledgerAccountId } : undefined,
  });
  return data as import('@/types/accounting').AccountingBankReconciliation[];
}

export async function fetchBankReconciliation(id: string) {
  const { data } = await api.get(`/v1/accounting/bank-reconciliations/${id}`);
  return data as import('@/types/accounting').AccountingBankReconciliation;
}

export async function createBankReconciliation(payload: {
  ledgerAccountId: string;
  statementStartDate: string;
  statementEndDate: string;
  statementOpeningBalance: number;
  statementClosingBalance: number;
}) {
  const { data } = await api.post('/v1/accounting/bank-reconciliations', payload);
  return data;
}

export async function importBankStatement(
  id: string,
  lines: Array<{
    lineDate: string;
    description?: string;
    referenceNo?: string;
    debitAmount?: number;
    creditAmount?: number;
  }>,
) {
  const { data } = await api.post(`/v1/accounting/bank-reconciliations/${id}/import`, { lines });
  return data;
}

export async function autoMatchBankReconciliation(id: string) {
  const { data } = await api.post(`/v1/accounting/bank-reconciliations/${id}/auto-match`, {});
  return data as { matched: number };
}

export async function finalizeBankReconciliation(id: string) {
  const { data } = await api.post(`/v1/accounting/bank-reconciliations/${id}/reconcile`, {});
  return data;
}
