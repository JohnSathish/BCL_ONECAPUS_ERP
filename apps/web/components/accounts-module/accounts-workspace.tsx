'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Plus,
  Receipt,
  Scale,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  activateFinancialYear,
  createFinancialYear,
  createLedger,
  approveExpense,
  autoMatchBankReconciliation,
  createBankReconciliation,
  createBudget,
  createFixedAsset,
  createVendor,
  downloadAccountingReportExport,
  fetchAccountingAuditLogs,
  fetchAccountingSettings,
  fetchAccountGroups,
  fetchAccountingDashboard,
  fetchActiveFinancialYear,
  fetchBalanceSheet,
  fetchBankBook,
  fetchBankReconciliation,
  fetchBankReconciliations,
  fetchBudgets,
  fetchCashBook,
  fetchDepreciationEntries,
  fetchExpenses,
  fetchFeeHeadMappings,
  fetchFinancialYears,
  fetchFixedAssets,
  fetchGeneralLedger,
  fetchLedgers,
  fetchPayrollComponentMappings,
  fetchPaymentModeMappings,
  fetchProfitAndLoss,
  fetchTrialBalance,
  fetchVendors,
  fetchVouchers,
  finalizeBankReconciliation,
  importBankStatement,
  postVoucher,
  runDepreciation,
  updateAccountingSettings,
  updateBudget,
  updateFixedAsset,
  type CreateLedgerPayload,
} from '@/services/accounting';
import { LineChartWidget } from '@/components/analytics/charts/line-chart-widget';
import {
  AccountsPanel,
  AccountsLoadingBlock,
  AccountsStatusBanner,
  formatInr,
} from '@/components/accounts-module/accounts-ui';
import { AccountsDashboardView } from '@/components/accounts-module/accounts-dashboard-view';
import { AccountsExpenseForm } from '@/components/accounts-module/accounts-expense-form';
import {
  AccountsEntriesTable,
  AccountsKpi,
  AccountsPageShell,
} from '@/components/accounts-module/accounts-page-shell';
import { AccountsVoucherForm } from '@/components/accounts-module/accounts-voucher-form';
import { usePermissions } from '@/hooks/use-permissions';
import type { AccountingBudget, AccountingExpense, AccountingFixedAsset } from '@/types/accounting';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';
import { cn } from '@/utils/cn';

type AccountsPage =
  | 'dashboard'
  | 'chart-of-accounts'
  | 'vouchers'
  | 'voucher-new'
  | 'cash-book'
  | 'bank-book'
  | 'ledger'
  | 'financial-years'
  | 'settings'
  | 'vendors'
  | 'expenses'
  | 'budgets'
  | 'fixed-assets'
  | 'bank-reconciliation'
  | 'reports'
  | 'audit-logs';

function inr(value: number) {
  return formatInr(value);
}

function createBudgetDraft() {
  return { ledgerAccountId: '', allocatedAmount: '' };
}

function createAssetDraft() {
  return {
    code: '',
    name: '',
    category: '',
    acquisitionDate: new Date().toISOString().slice(0, 10),
    cost: '',
    usefulLifeMonths: '',
    assetLedgerId: '',
    accumDepreciationLedgerId: '',
    expenseLedgerId: '',
  };
}

function createVendorDraft() {
  return { code: '', name: '', gstin: '', contactName: '', phone: '', email: '' };
}

function createBankStatementLineDraft() {
  return {
    lineDate: new Date().toISOString().slice(0, 10),
    description: '',
    referenceNo: '',
    debitAmount: '',
    creditAmount: '',
  };
}

export function AccountsWorkspace({ page = 'dashboard' }: { page?: AccountsPage }) {
  const { canAny } = usePermissions();
  const qc = useQueryClient();
  const canManage = canAny('accounts:manage');
  const canPost = canAny('accounts:post', 'accounts:manage');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [selectedLedgerId, setSelectedLedgerId] = useState('');
  const [voucherFilter, setVoucherFilter] = useState<'ALL' | 'DRAFT' | 'POSTED'>('ALL');
  const [reportTab, setReportTab] = useState<'trial-balance' | 'profit-loss' | 'balance-sheet'>(
    'trial-balance',
  );
  const [reportExporting, setReportExporting] = useState<'pdf' | 'xlsx' | null>(null);
  const [editingExpense, setEditingExpense] = useState<AccountingExpense | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [budgetRows, setBudgetRows] = useState([createBudgetDraft()]);
  const [assetRows, setAssetRows] = useState([createAssetDraft()]);
  const [vendorRows, setVendorRows] = useState([createVendorDraft()]);
  const [bankStatementRows, setBankStatementRows] = useState([createBankStatementLineDraft()]);
  const [bankStatementJson, setBankStatementJson] = useState('');
  const [savingBudgetRows, setSavingBudgetRows] = useState(false);
  const [savingAssetRows, setSavingAssetRows] = useState(false);
  const [savingVendorRows, setSavingVendorRows] = useState(false);
  const [vendorRowErrors, setVendorRowErrors] = useState<Record<number, string>>({});
  const [budgetRowErrors, setBudgetRowErrors] = useState<Record<number, string>>({});
  const [assetRowErrors, setAssetRowErrors] = useState<Record<number, string>>({});
  const [importingBankLines, setImportingBankLines] = useState(false);
  const [newLedger, setNewLedger] = useState<CreateLedgerPayload>({
    groupId: '',
    code: '',
    name: '',
  });

  const overviewPages: AccountsPage[] = [
    'dashboard',
    'cash-book',
    'bank-book',
    'expenses',
    'budgets',
    'reports',
    'vouchers',
    'bank-reconciliation',
    'ledger',
    'chart-of-accounts',
    'financial-years',
    'vendors',
    'fixed-assets',
    'audit-logs',
  ];

  const dashboardQ = useQuery({
    queryKey: ['accounting', 'dashboard'],
    queryFn: fetchAccountingDashboard,
    enabled: overviewPages.includes(page),
  });
  const groupsQ = useQuery({
    queryKey: ['accounting', 'groups'],
    queryFn: fetchAccountGroups,
    enabled: page === 'chart-of-accounts',
  });
  const ledgersQ = useQuery({
    queryKey: ['accounting', 'ledgers', ledgerSearch],
    queryFn: () => fetchLedgers({ search: ledgerSearch || undefined, limit: 200 }),
    enabled:
      page === 'chart-of-accounts' ||
      page === 'ledger' ||
      page === 'cash-book' ||
      page === 'bank-book' ||
      page === 'expenses' ||
      page === 'budgets' ||
      page === 'settings' ||
      page === 'fixed-assets' ||
      page === 'bank-reconciliation',
  });
  const vouchersQ = useQuery({
    queryKey: ['accounting', 'vouchers', voucherFilter],
    queryFn: () =>
      fetchVouchers({
        status: voucherFilter === 'ALL' ? undefined : voucherFilter,
        limit: 50,
      }),
    enabled: page === 'vouchers',
  });
  const cashBookQ = useQuery({
    queryKey: ['accounting', 'cash-book'],
    queryFn: () => fetchCashBook(),
    enabled: page === 'cash-book',
  });
  const bankBookQ = useQuery({
    queryKey: ['accounting', 'bank-book'],
    queryFn: () => fetchBankBook(),
    enabled: page === 'bank-book',
  });
  const generalLedgerQ = useQuery({
    queryKey: ['accounting', 'general-ledger', selectedLedgerId],
    queryFn: () => fetchGeneralLedger({ ledgerAccountId: selectedLedgerId }),
    enabled: page === 'ledger' && Boolean(selectedLedgerId),
  });
  const financialYearsQ = useQuery({
    queryKey: ['accounting', 'financial-years'],
    queryFn: fetchFinancialYears,
    enabled: page === 'financial-years' || page === 'budgets',
  });
  const settingsQ = useQuery({
    queryKey: ['accounting', 'settings'],
    queryFn: fetchAccountingSettings,
    enabled: page === 'settings',
  });
  const feeMappingsQ = useQuery({
    queryKey: ['accounting', 'fee-mappings'],
    queryFn: fetchFeeHeadMappings,
    enabled: page === 'settings',
  });
  const paymentMappingsQ = useQuery({
    queryKey: ['accounting', 'payment-mappings'],
    queryFn: fetchPaymentModeMappings,
    enabled: page === 'settings',
  });
  const payrollMappingsQ = useQuery({
    queryKey: ['accounting', 'payroll-mappings'],
    queryFn: fetchPayrollComponentMappings,
    enabled: page === 'settings',
  });
  const vendorsQ = useQuery({
    queryKey: ['accounting', 'vendors'],
    queryFn: () => fetchVendors({ limit: 100 }),
    enabled: page === 'vendors' || page === 'expenses',
  });
  const expensesQ = useQuery({
    queryKey: ['accounting', 'expenses'],
    queryFn: () => fetchExpenses({ limit: 50 }),
    enabled: page === 'expenses',
  });
  const budgetsQ = useQuery({
    queryKey: ['accounting', 'budgets'],
    queryFn: () => fetchBudgets(),
    enabled: page === 'budgets',
  });
  const activeFyQ = useQuery({
    queryKey: ['accounting', 'financial-years', 'active'],
    queryFn: fetchActiveFinancialYear,
    enabled:
      page === 'budgets' ||
      page === 'reports' ||
      page === 'audit-logs' ||
      page === 'financial-years',
  });
  const fixedAssetsQ = useQuery({
    queryKey: ['accounting', 'fixed-assets'],
    queryFn: () => fetchFixedAssets(),
    enabled: page === 'fixed-assets',
  });
  const depreciationQ = useQuery({
    queryKey: ['accounting', 'depreciation-entries'],
    queryFn: () => fetchDepreciationEntries({ limit: 50 } as Record<string, number>),
    enabled: page === 'fixed-assets',
  });
  const bankReconciliationsQ = useQuery({
    queryKey: ['accounting', 'bank-reconciliations'],
    queryFn: () => fetchBankReconciliations(),
    enabled: page === 'bank-reconciliation',
  });
  const [selectedReconciliationId, setSelectedReconciliationId] = useState('');
  const bankReconciliationQ = useQuery({
    queryKey: ['accounting', 'bank-reconciliation', selectedReconciliationId],
    queryFn: () => fetchBankReconciliation(selectedReconciliationId),
    enabled: page === 'bank-reconciliation' && Boolean(selectedReconciliationId),
  });
  const trialBalanceQ = useQuery({
    queryKey: ['accounting', 'trial-balance', activeFyQ.data?.id],
    queryFn: () =>
      fetchTrialBalance(activeFyQ.data ? { financialYearId: activeFyQ.data.id } : undefined),
    enabled: page === 'reports' && reportTab === 'trial-balance' && Boolean(activeFyQ.data),
  });
  const profitLossQ = useQuery({
    queryKey: ['accounting', 'profit-loss', activeFyQ.data?.id],
    queryFn: () =>
      fetchProfitAndLoss(activeFyQ.data ? { financialYearId: activeFyQ.data.id } : undefined),
    enabled: page === 'reports' && reportTab === 'profit-loss' && Boolean(activeFyQ.data),
  });
  const balanceSheetQ = useQuery({
    queryKey: ['accounting', 'balance-sheet', activeFyQ.data?.id],
    queryFn: () =>
      fetchBalanceSheet(activeFyQ.data ? { financialYearId: activeFyQ.data.id } : undefined),
    enabled: page === 'reports' && reportTab === 'balance-sheet' && Boolean(activeFyQ.data),
  });
  const auditLogsQ = useQuery({
    queryKey: ['accounting', 'audit-logs'],
    queryFn: () => fetchAccountingAuditLogs({ limit: 100 }),
    enabled: page === 'audit-logs',
  });

  const createLedgerM = useMutation({
    mutationFn: createLedger,
    onSuccess: () => {
      setMessage('Ledger created');
      setError('');
      setNewLedger({ groupId: '', code: '', name: '' });
      qc.invalidateQueries({ queryKey: ['accounting'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const postVoucherM = useMutation({
    mutationFn: postVoucher,
    onSuccess: () => {
      setMessage('Voucher posted to general ledger');
      setError('');
      qc.invalidateQueries({ queryKey: ['accounting'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const createFyM = useMutation({
    mutationFn: (startYear: number) => createFinancialYear(startYear),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting', 'financial-years'] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const activateFyM = useMutation({
    mutationFn: activateFinancialYear,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounting'] }),
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const leafGroups = useMemo(() => (groupsQ.data ?? []).filter((g) => g.parentId), [groupsQ.data]);

  const exportReport = async (format: 'pdf' | 'xlsx') => {
    if (!activeFyQ.data) return;
    setReportExporting(format);
    setError('');
    try {
      const params = { financialYearId: activeFyQ.data.id };
      const blob = await downloadAccountingReportExport(reportTab, format, params);
      const ext = format === 'pdf' ? 'pdf' : 'xlsx';
      const name =
        reportTab === 'trial-balance'
          ? 'trial-balance'
          : reportTab === 'profit-loss'
            ? 'profit-and-loss'
            : 'balance-sheet';
      downloadBlob(blob, `${name}.${ext}`);
      setMessage(`Report downloaded as ${format.toUpperCase()}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setReportExporting(null);
    }
  };

  if (page === 'dashboard') {
    return (
      <div className="space-y-5">
        <AccountsStatusBanner message={message} error={error} />
        <AccountsDashboardView
          data={dashboardQ.data}
          loading={dashboardQ.isLoading}
          error={dashboardQ.error}
        />
      </div>
    );
  }

  if (page === 'chart-of-accounts') {
    const groups = groupsQ.data ?? [];
    const ledgerCount = groups.reduce((sum, g) => sum + (g.ledgers?.length ?? 0), 0);
    const totalBalance = groups.reduce((sum, g) => sum + Number(g.currentBalance ?? 0), 0);
    const overview = dashboardQ.data;

    const kpis: AccountsKpi[] = [
      {
        label: 'Account Groups',
        value: String(groups.length),
        tone: 'default',
        icon: BookOpen,
      },
      {
        label: 'Active Ledgers',
        value: String(ledgerCount),
        tone: 'asset',
        icon: FileSpreadsheet,
      },
      {
        label: 'Cash in Hand',
        value: inr(overview?.summary.cashInHand ?? 0),
        tone: 'asset',
        icon: Wallet,
      },
      {
        label: 'Bank Balance',
        value: inr(overview?.summary.bankBalance ?? 0),
        tone: 'asset',
        icon: Landmark,
      },
    ];

    return (
      <AccountsPageShell
        page={page}
        kpis={kpis}
        message={message}
        error={error}
        loading={groupsQ.isLoading}
        loadingLabel="Loading chart of accounts…"
      >
        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            {groups.map((group) => (
              <AccountsPanel
                key={group.id}
                title={group.name}
                icon={BookOpen}
                action={
                  <span className="text-sm font-semibold">
                    {inr(Number(group.currentBalance ?? 0))}
                  </span>
                }
              >
                <p className="mb-3 text-xs text-muted-foreground">
                  {group.code} · {group.nature}
                </p>
                <div className="divide-y rounded-xl border border-border/60">
                  {(group.ledgers ?? []).length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No ledgers in this group.</p>
                  ) : (
                    (group.ledgers ?? []).map((ledger) => (
                      <div
                        key={ledger.id}
                        className="flex items-center justify-between px-4 py-2 text-sm"
                      >
                        <span>
                          {ledger.name}{' '}
                          <span className="text-muted-foreground">({ledger.code})</span>
                        </span>
                        <span className="font-medium">{inr(Number(ledger.currentBalance))}</span>
                      </div>
                    ))
                  )}
                </div>
              </AccountsPanel>
            ))}
          </div>
          <AccountsPanel title="Add Ledger" icon={Plus}>
            <div className="space-y-3">
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={newLedger.groupId}
                onChange={(e) => setNewLedger((p) => ({ ...p, groupId: e.target.value }))}
              >
                <option value="">Select group</option>
                {leafGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Ledger code"
                value={newLedger.code}
                onChange={(e) => setNewLedger((p) => ({ ...p, code: e.target.value }))}
              />
              <input
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Ledger name"
                value={newLedger.name}
                onChange={(e) => setNewLedger((p) => ({ ...p, name: e.target.value }))}
              />
              <Button
                className="w-full"
                disabled={createLedgerM.isPending}
                onClick={() => createLedgerM.mutate(newLedger)}
              >
                {createLedgerM.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Create Ledger'
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Combined group balance: {inr(totalBalance)}
              </p>
            </div>
          </AccountsPanel>
        </div>
      </AccountsPageShell>
    );
  }

  if (page === 'vouchers' || page === 'voucher-new') {
    if (page === 'voucher-new') {
      if (!canManage) {
        return (
          <AccountsPageShell page={page} message={message} error={error} showQuickActions>
            <AccountsPanel title="New Voucher" icon={Receipt}>
              <p className="text-sm text-muted-foreground">
                You have read-only access for voucher creation.
              </p>
            </AccountsPanel>
          </AccountsPageShell>
        );
      }
      return <AccountsVoucherForm />;
    }

    const voucherItems = vouchersQ.data?.items ?? [];
    const draftVouchers = voucherItems.filter((v) => v.status === 'DRAFT');
    const postedVouchers = voucherItems.filter((v) => v.status === 'POSTED');
    const draftAmount = draftVouchers.reduce((sum, v) => sum + Number(v.totalAmount), 0);
    const overview = dashboardQ.data;

    const kpis: AccountsKpi[] = [
      {
        label: 'Draft Vouchers',
        value: String(draftVouchers.length),
        tone: 'alert',
        icon: Receipt,
      },
      {
        label: 'Posted (Listed)',
        value: String(postedVouchers.length),
        tone: 'income',
        icon: FileSpreadsheet,
      },
      {
        label: 'Draft Amount',
        value: inr(draftAmount),
        tone: 'expense',
        icon: Wallet,
      },
      {
        label: 'Pending Approvals',
        value: String(overview?.approvalQueue.voucherApproval ?? draftVouchers.length),
        tone: 'budget',
        icon: Scale,
      },
    ];

    return (
      <AccountsPageShell
        page={page}
        kpis={kpis}
        message={message}
        error={error}
        loading={vouchersQ.isLoading}
        loadingLabel="Loading vouchers…"
        headerAction={
          canManage ? (
            <Button asChild>
              <Link href="/admin/accounts/vouchers/new">
                <Plus className="mr-2 h-4 w-4" /> New Voucher
              </Link>
            </Button>
          ) : undefined
        }
      >
        <AccountsPanel
          title="Voucher Register"
          icon={Receipt}
          action={
            <div className="flex gap-2">
              {(['ALL', 'DRAFT', 'POSTED'] as const).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={voucherFilter === status ? 'default' : 'outline'}
                  onClick={() => setVoucherFilter(status)}
                >
                  {status}
                </Button>
              ))}
            </div>
          }
        >
          <div className="divide-y rounded-xl border border-border/60">
            {voucherItems.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No vouchers found for this filter.
              </p>
            ) : (
              voucherItems.map((voucher) => (
                <div
                  key={voucher.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{voucher.voucherNo}</p>
                    <p className="text-sm text-muted-foreground">
                      {voucher.voucherType?.name} ·{' '}
                      {new Date(voucher.voucherDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-semibold">{inr(Number(voucher.totalAmount))}</p>
                      <p className="text-xs uppercase text-muted-foreground">{voucher.status}</p>
                    </div>
                    {voucher.status === 'DRAFT' && (
                      <>
                        {canManage ? (
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/accounts/vouchers/new?id=${voucher.id}`}>Edit</Link>
                          </Button>
                        ) : null}
                        {canPost ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={postVoucherM.isPending}
                            onClick={() => postVoucherM.mutate(voucher.id)}
                          >
                            Post
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </AccountsPanel>
      </AccountsPageShell>
    );
  }

  if (page === 'cash-book' || page === 'bank-book') {
    const isCash = page === 'cash-book';
    const book = isCash ? cashBookQ.data : bankBookQ.data;
    const loading = isCash ? cashBookQ.isLoading : bankBookQ.isLoading;
    const overview = dashboardQ.data;
    const position = isCash ? overview?.cashPosition.cash : overview?.cashPosition.bank;

    const kpis: AccountsKpi[] = book
      ? [
          {
            label: 'Opening Balance',
            value: inr(book.openingBalance),
            tone: 'asset',
            icon: isCash ? Wallet : Landmark,
          },
          {
            label: isCash ? "Today's Receipts" : "Today's Deposits",
            value: inr(book.receipts),
            tone: 'income',
            icon: Receipt,
          },
          {
            label: isCash ? "Today's Payments" : "Today's Withdrawals",
            value: inr(book.payments),
            tone: 'expense',
            icon: Receipt,
          },
          {
            label: 'Closing Balance',
            value: inr(book.closingBalance),
            tone: 'asset',
            icon: isCash ? Wallet : Landmark,
          },
        ]
      : position
        ? [
            {
              label: 'Opening Balance',
              value: inr(position.openingBalance),
              tone: 'asset',
              icon: isCash ? Wallet : Landmark,
            },
            {
              label: isCash ? "Today's Receipts" : "Today's Deposits",
              value: inr(position.receipts),
              tone: 'income',
              icon: Receipt,
            },
            {
              label: isCash ? "Today's Payments" : "Today's Withdrawals",
              value: inr(position.payments),
              tone: 'expense',
              icon: Receipt,
            },
            {
              label: 'Closing Balance',
              value: inr(position.closingBalance),
              tone: 'asset',
              icon: isCash ? Wallet : Landmark,
            },
          ]
        : [];

    const analytics =
      overview && overview.charts.incomeVsExpense.length > 0 ? (
        <AccountsPanel title="Income vs Expense Trend" icon={BarChart3}>
          <LineChartWidget
            data={overview.charts.incomeVsExpense.map((p) => ({
              label: p.label,
              value: p.income,
              income: p.income,
              expense: p.expense,
            }))}
            height={200}
            lines={[
              { key: 'income', name: 'Income', color: '#059669' },
              { key: 'expense', name: 'Expense', color: '#ea580c' },
            ]}
          />
        </AccountsPanel>
      ) : null;

    return (
      <AccountsPageShell
        page={page}
        kpis={kpis}
        analytics={analytics}
        message={message}
        error={error}
        loading={loading}
        loadingLabel={`Loading ${isCash ? 'cash' : 'bank'} book…`}
      >
        {book ? (
          <AccountsPanel
            title={isCash ? "Today's Cash Entries" : "Today's Bank Entries"}
            icon={BookOpen}
          >
            <AccountsEntriesTable entries={book.entries} formatAmount={inr} />
          </AccountsPanel>
        ) : null}
      </AccountsPageShell>
    );
  }

  if (page === 'ledger') {
    const book = generalLedgerQ.data;
    const selectedLedger = (ledgersQ.data?.items ?? []).find((l) => l.id === selectedLedgerId);
    const overview = dashboardQ.data;

    const kpis: AccountsKpi[] = book
      ? [
          {
            label: 'Opening Balance',
            value: inr(book.openingBalance),
            tone: 'asset',
            icon: FileSpreadsheet,
          },
          {
            label: 'Period Receipts',
            value: inr(book.receipts),
            tone: 'income',
            icon: Receipt,
          },
          {
            label: 'Period Payments',
            value: inr(book.payments),
            tone: 'expense',
            icon: Wallet,
          },
          {
            label: 'Closing Balance',
            value: inr(book.closingBalance),
            tone: 'asset',
            icon: Landmark,
          },
        ]
      : selectedLedger
        ? [
            {
              label: 'Current Balance',
              value: inr(Number(selectedLedger.currentBalance)),
              tone: 'asset',
              icon: FileSpreadsheet,
              sub: selectedLedger.name,
            },
            {
              label: 'Cash in Hand',
              value: inr(overview?.summary.cashInHand ?? 0),
              tone: 'asset',
              icon: Wallet,
            },
            {
              label: 'Bank Balance',
              value: inr(overview?.summary.bankBalance ?? 0),
              tone: 'asset',
              icon: Landmark,
            },
            {
              label: 'Active Ledgers',
              value: String(ledgersQ.data?.items.length ?? 0),
              tone: 'default',
              icon: BookOpen,
            },
          ]
        : [
            {
              label: 'Active Ledgers',
              value: String(ledgersQ.data?.items.length ?? 0),
              tone: 'default',
              icon: BookOpen,
            },
            {
              label: 'Cash in Hand',
              value: inr(overview?.summary.cashInHand ?? 0),
              tone: 'asset',
              icon: Wallet,
            },
            {
              label: 'Bank Balance',
              value: inr(overview?.summary.bankBalance ?? 0),
              tone: 'asset',
              icon: Landmark,
            },
            {
              label: 'Fund Balance',
              value: inr(overview?.fundBalance ?? 0),
              tone: 'income',
              icon: BarChart3,
            },
          ];

    return (
      <AccountsPageShell page={page} kpis={kpis} message={message} error={error}>
        <AccountsPanel title="Ledger Account" icon={FileSpreadsheet}>
          <select
            className="w-full max-w-md rounded-md border bg-background px-3 py-2 text-sm"
            value={selectedLedgerId}
            onChange={(e) => setSelectedLedgerId(e.target.value)}
          >
            <option value="">Select ledger to view transactions</option>
            {(ledgersQ.data?.items ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.code}) · {inr(Number(l.currentBalance))}
              </option>
            ))}
          </select>
        </AccountsPanel>
        {selectedLedgerId && generalLedgerQ.isLoading ? (
          <AccountsLoadingBlock label="Loading ledger entries…" />
        ) : book ? (
          <AccountsPanel title={`Ledger · ${selectedLedger?.name ?? ''}`} icon={BookOpen}>
            <AccountsEntriesTable entries={book.entries} formatAmount={inr} />
          </AccountsPanel>
        ) : selectedLedgerId ? (
          <AccountsPanel title="Ledger Entries" icon={BookOpen}>
            <p className="text-sm text-muted-foreground">No posted entries for this ledger yet.</p>
          </AccountsPanel>
        ) : null}
      </AccountsPageShell>
    );
  }

  if (page === 'financial-years') {
    const years = financialYearsQ.data ?? [];
    const activeYear = years.find((fy) => fy.status === 'ACTIVE');

    const kpis: AccountsKpi[] = [
      {
        label: 'Financial Years',
        value: String(years.length),
        tone: 'default',
        icon: FileSpreadsheet,
      },
      {
        label: 'Active Year',
        value: activeYear?.label ?? '—',
        tone: 'income',
        icon: BarChart3,
      },
      {
        label: 'Closed Years',
        value: String(years.filter((fy) => fy.status === 'CLOSED').length),
        tone: 'budget',
        icon: Scale,
      },
      {
        label: 'Budget Utilization',
        value: `${dashboardQ.data?.summary.budgetUtilization ?? 0}%`,
        tone: 'budget',
        icon: BarChart3,
      },
    ];

    return (
      <AccountsPageShell
        page={page}
        kpis={kpis}
        message={message}
        error={error}
        loading={financialYearsQ.isLoading}
        loadingLabel="Loading financial years…"
        headerAction={
          <Button
            variant="outline"
            disabled={createFyM.isPending}
            onClick={() => createFyM.mutate(new Date().getFullYear())}
          >
            Add Current FY
          </Button>
        }
      >
        <AccountsPanel title="Financial Years" icon={FileSpreadsheet}>
          <div className="divide-y rounded-xl border border-border/60">
            {years.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No financial years configured yet.
              </p>
            ) : (
              years.map((fy) => (
                <div key={fy.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="font-medium">{fy.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(fy.startDate).toLocaleDateString('en-IN')} –{' '}
                      {new Date(fy.endDate).toLocaleDateString('en-IN')} · {fy.status}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {fy.status !== 'ACTIVE' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={activateFyM.isPending}
                        onClick={() => activateFyM.mutate(fy.id)}
                      >
                        Activate
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </AccountsPanel>
      </AccountsPageShell>
    );
  }

  if (page === 'settings') {
    const settings = settingsQ.data;
    const feeMappings = feeMappingsQ.data ?? [];
    const paymentMappings = paymentMappingsQ.data ?? [];
    const payrollMappings = payrollMappingsQ.data ?? [];

    const kpis: AccountsKpi[] = [
      {
        label: 'Fee Head Mappings',
        value: String(feeMappings.length),
        tone: 'income',
        icon: Receipt,
      },
      {
        label: 'Payment Mode Mappings',
        value: String(paymentMappings.length),
        tone: 'asset',
        icon: Wallet,
      },
      {
        label: 'Payroll Mappings',
        value: String(payrollMappings.length),
        tone: 'budget',
        icon: Building2,
      },
      {
        label: 'Auto-Journal',
        value:
          settings?.autoPostFees && settings?.autoPostPayroll
            ? 'Fees & Payroll'
            : settings?.autoPostFees
              ? 'Fees'
              : settings?.autoPostPayroll
                ? 'Payroll'
                : 'Manual',
        tone: settings?.autoPostFees || settings?.autoPostPayroll ? 'income' : 'alert',
        icon: FileSpreadsheet,
      },
    ];

    return (
      <AccountsPageShell
        page={page}
        kpis={kpis}
        message={message}
        error={error}
        loading={settingsQ.isLoading}
        loadingLabel="Loading GL settings…"
      >
        {settings && (
          <AccountsPanel title="Integration Settings" icon={FileSpreadsheet}>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.autoPostFees}
                  onChange={(e) =>
                    updateAccountingSettings({ autoPostFees: e.target.checked }).then(() =>
                      qc.invalidateQueries({ queryKey: ['accounting', 'settings'] }),
                    )
                  }
                />
                Automatically post fee collections to general ledger
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settings.autoPostPayroll}
                  onChange={(e) =>
                    updateAccountingSettings({ autoPostPayroll: e.target.checked }).then(() =>
                      qc.invalidateQueries({ queryKey: ['accounting', 'settings'] }),
                    )
                  }
                />
                Automatically post payroll accrual and payment journals
              </label>
              <div className="grid gap-3 md:grid-cols-3">
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={settings.defaultCashLedgerId ?? ''}
                  onChange={(e) =>
                    updateAccountingSettings({ defaultCashLedgerId: e.target.value || null }).then(
                      () => qc.invalidateQueries({ queryKey: ['accounting', 'settings'] }),
                    )
                  }
                >
                  <option value="">Default cash ledger</option>
                  {(ledgersQ.data?.items ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={settings.defaultBankLedgerId ?? ''}
                  onChange={(e) =>
                    updateAccountingSettings({ defaultBankLedgerId: e.target.value || null }).then(
                      () => qc.invalidateQueries({ queryKey: ['accounting', 'settings'] }),
                    )
                  }
                >
                  <option value="">Default bank ledger</option>
                  {(ledgersQ.data?.items ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={settings.defaultIncomeLedgerId ?? ''}
                  onChange={(e) =>
                    updateAccountingSettings({
                      defaultIncomeLedgerId: e.target.value || null,
                    }).then(() => qc.invalidateQueries({ queryKey: ['accounting', 'settings'] }))
                  }
                >
                  <option value="">Default income ledger</option>
                  {(ledgersQ.data?.items ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={settings.salaryExpenseLedgerId ?? ''}
                  onChange={(e) =>
                    updateAccountingSettings({
                      salaryExpenseLedgerId: e.target.value || null,
                    }).then(() => qc.invalidateQueries({ queryKey: ['accounting', 'settings'] }))
                  }
                >
                  <option value="">Salary expense ledger</option>
                  {(ledgersQ.data?.items ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={settings.salaryPayableLedgerId ?? ''}
                  onChange={(e) =>
                    updateAccountingSettings({
                      salaryPayableLedgerId: e.target.value || null,
                    }).then(() => qc.invalidateQueries({ queryKey: ['accounting', 'settings'] }))
                  }
                >
                  <option value="">Salary payable ledger</option>
                  {(ledgersQ.data?.items ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={settings.payrollDeductionsLedgerId ?? ''}
                  onChange={(e) =>
                    updateAccountingSettings({
                      payrollDeductionsLedgerId: e.target.value || null,
                    }).then(() => qc.invalidateQueries({ queryKey: ['accounting', 'settings'] }))
                  }
                >
                  <option value="">Default payroll deductions ledger</option>
                  {(ledgersQ.data?.items ?? []).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </AccountsPanel>
        )}
        <div className="grid gap-6 xl:grid-cols-3">
          <AccountsPanel title="Fee Head Mappings" icon={Receipt}>
            <div className="space-y-2 text-sm">
              {feeMappings.length === 0 ? (
                <p className="text-muted-foreground">No fee head mappings configured.</p>
              ) : (
                feeMappings.map(
                  (m: { id: string; sourceKey: string; incomeLedger?: { name: string } }) => (
                    <div key={m.id} className="flex justify-between">
                      <span>{m.sourceKey}</span>
                      <span className="text-muted-foreground">{m.incomeLedger?.name}</span>
                    </div>
                  ),
                )
              )}
            </div>
          </AccountsPanel>
          <AccountsPanel title="Payment Mode Mappings" icon={Wallet}>
            <div className="space-y-2 text-sm">
              {paymentMappings.length === 0 ? (
                <p className="text-muted-foreground">No payment mode mappings configured.</p>
              ) : (
                paymentMappings.map(
                  (m: { id: string; paymentMode: string; debitLedger?: { name: string } }) => (
                    <div key={m.id} className="flex justify-between">
                      <span>{m.paymentMode}</span>
                      <span className="text-muted-foreground">{m.debitLedger?.name}</span>
                    </div>
                  ),
                )
              )}
            </div>
          </AccountsPanel>
          <AccountsPanel title="Payroll Component Mappings" icon={Building2}>
            <div className="space-y-2 text-sm">
              {payrollMappings.length === 0 ? (
                <p className="text-muted-foreground">No payroll mappings configured.</p>
              ) : (
                payrollMappings.map(
                  (m: { id: string; componentCode: string; ledgerAccount?: { name: string } }) => (
                    <div key={m.id} className="flex justify-between">
                      <span>{m.componentCode}</span>
                      <span className="text-muted-foreground">{m.ledgerAccount?.name}</span>
                    </div>
                  ),
                )
              )}
            </div>
          </AccountsPanel>
        </div>
      </AccountsPageShell>
    );
  }

  if (page === 'vendors') {
    const vendorItems = vendorsQ.data?.items ?? [];
    const overview = dashboardQ.data;

    const kpis: AccountsKpi[] = [
      {
        label: 'Active Vendors',
        value: String(vendorItems.filter((v) => v.isActive).length),
        tone: 'asset',
        icon: Building2,
      },
      {
        label: 'Total Vendors',
        value: String(vendorItems.length),
        tone: 'default',
        icon: Building2,
      },
      {
        label: 'Vendor Bills Pending',
        value: String(overview?.approvalQueue.vendorBills ?? 0),
        tone: 'alert',
        icon: Receipt,
      },
      {
        label: 'Outstanding Payables',
        value: inr(overview?.summary.outstandingPayables ?? 0),
        tone: 'expense',
        icon: Wallet,
      },
    ];

    const duplicateVendorRow = (index: number) => {
      setVendorRows((prev) => {
        const copy = { ...prev[index], code: '', name: '' };
        return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
      });
    };

    const saveVendorRows = async () => {
      const validationErrors: Record<number, string> = {};
      vendorRows.forEach((r, idx) => {
        if (!r.code?.trim()) validationErrors[idx] = 'Code is required.';
        else if (!r.name?.trim()) validationErrors[idx] = 'Name is required.';
        else if (r.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) {
          validationErrors[idx] = 'Email format looks invalid.';
        }
      });
      setVendorRowErrors(validationErrors);

      const rows = vendorRows.filter((_, idx) => !validationErrors[idx]);
      if (!rows.length || Object.keys(validationErrors).length > 0) {
        setError('Fix highlighted vendor row errors before saving.');
        return;
      }
      setSavingVendorRows(true);
      setError('');
      try {
        await Promise.all(
          rows.map((r) =>
            createVendor({
              code: r.code,
              name: r.name,
              gstin: r.gstin || undefined,
              contactName: r.contactName || undefined,
              phone: r.phone || undefined,
              email: r.email || undefined,
            }),
          ),
        );
        setMessage(`${rows.length} vendor(s) created`);
        setVendorRows([createVendorDraft()]);
        setVendorRowErrors({});
        qc.invalidateQueries({ queryKey: ['accounting', 'vendors'] });
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setSavingVendorRows(false);
      }
    };

    return (
      <AccountsPageShell
        page={page}
        kpis={kpis}
        message={message}
        error={error}
        loading={vendorsQ.isLoading}
        loadingLabel="Loading vendors…"
      >
        <AccountsPanel title="Add Vendors" icon={Plus}>
          <p className="text-xs text-muted-foreground">
            Tip: Press Enter to duplicate this row and Ctrl+S to save all rows.
          </p>
          {canManage ? (
            <div
              className="space-y-3"
              onKeyDownCapture={(e) => {
                if (e.ctrlKey && e.key.toLowerCase() === 's') {
                  e.preventDefault();
                  void saveVendorRows();
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
                  const target = e.target as HTMLElement;
                  const rowEl = target.closest('[data-vendor-row-index]') as HTMLElement | null;
                  const rowIndex = rowEl?.dataset.vendorRowIndex;
                  if (rowIndex != null) {
                    e.preventDefault();
                    duplicateVendorRow(Number(rowIndex));
                  }
                }
              }}
            >
              {vendorRows.map((row, index) => (
                <div
                  key={`vendor-row-${index}`}
                  data-vendor-row-index={index}
                  className="grid gap-2 md:grid-cols-6"
                >
                  <input
                    className={`rounded-md border px-3 py-2 text-sm ${
                      vendorRowErrors[index] && !row.code?.trim()
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    placeholder="Code"
                    value={row.code}
                    onChange={(e) =>
                      setVendorRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, code: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    className={`rounded-md border px-3 py-2 text-sm md:col-span-2 ${
                      vendorRowErrors[index] && !row.name?.trim()
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    placeholder="Name"
                    value={row.name}
                    onChange={(e) =>
                      setVendorRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, name: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    className={`rounded-md border px-3 py-2 text-sm ${
                      vendorRowErrors[index] && !row.code?.trim()
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    placeholder="GSTIN"
                    value={row.gstin}
                    onChange={(e) =>
                      setVendorRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, gstin: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    className={`rounded-md border px-3 py-2 text-sm ${
                      vendorRowErrors[index] && !row.name?.trim()
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    placeholder="Contact"
                    value={row.contactName}
                    onChange={(e) =>
                      setVendorRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, contactName: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    className={`rounded-md border px-3 py-2 text-sm ${
                      vendorRowErrors[index] &&
                      row.email &&
                      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    placeholder="Phone"
                    value={row.phone}
                    onChange={(e) =>
                      setVendorRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, phone: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    className={`rounded-md border px-3 py-2 text-sm md:col-span-2 ${
                      vendorRowErrors[index] &&
                      row.email &&
                      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    placeholder="Email"
                    value={row.email}
                    onChange={(e) =>
                      setVendorRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, email: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => duplicateVendorRow(index)}
                  >
                    Duplicate
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={vendorRows.length <= 1}
                    onClick={() =>
                      setVendorRows((prev) =>
                        prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                  {vendorRowErrors[index] ? (
                    <p className="md:col-span-6 text-xs font-medium text-rose-600">
                      {vendorRowErrors[index]}
                    </p>
                  ) : null}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setVendorRows((prev) => [...prev, createVendorDraft()])}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Row
                </Button>
                <Button disabled={savingVendorRows} onClick={() => void saveVendorRows()}>
                  {savingVendorRows ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Save Vendors
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              You have read-only access for vendor records.
            </p>
          )}
        </AccountsPanel>
        <AccountsPanel title="Vendor Directory" icon={Building2}>
          <div className="divide-y rounded-xl border border-border/60">
            {vendorItems.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No vendors registered yet.</p>
            ) : (
              vendorItems.map((vendor) => (
                <div key={vendor.id} className="flex justify-between px-4 py-3 text-sm">
                  <span>
                    {vendor.name} ({vendor.code})
                  </span>
                  <span className="text-muted-foreground">{vendor.gstin ?? '—'}</span>
                </div>
              ))
            )}
          </div>
        </AccountsPanel>
      </AccountsPageShell>
    );
  }

  if (page === 'expenses') {
    const expenseItems = expensesQ.data?.items ?? [];
    const drafts = expenseItems.filter((e) => e.status === 'DRAFT');
    const posted = expenseItems.filter((e) => e.status !== 'DRAFT');
    const draftAmount = drafts.reduce((sum, e) => sum + Number(e.amount), 0);
    const overview = dashboardQ.data;

    const kpis: AccountsKpi[] = [
      {
        label: "Today's Expenses",
        value: inr(overview?.summary.todayExpenses ?? 0),
        tone: 'expense',
        icon: Receipt,
      },
      {
        label: 'Draft Expenses',
        value: String(drafts.length),
        tone: 'alert',
        icon: AlertTriangle,
      },
      {
        label: 'Pending Amount',
        value: inr(draftAmount),
        tone: 'expense',
        icon: Wallet,
      },
      {
        label: 'Posted (Listed)',
        value: String(posted.length),
        tone: 'income',
        icon: FileSpreadsheet,
      },
    ];

    const analytics =
      overview && overview.charts.expenseDistribution.length > 0 ? (
        <AccountsPanel title="Expense Distribution (This Month)" icon={BarChart3}>
          <div className="space-y-3">
            {overview.charts.expenseDistribution.map((row) => (
              <div key={row.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{row.label}</span>
                  <span className="font-medium text-orange-600">{row.pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-orange-500"
                    style={{ width: `${Math.min(row.pct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </AccountsPanel>
      ) : null;

    return (
      <AccountsPageShell
        page={page}
        kpis={kpis}
        analytics={analytics}
        message={message}
        error={error}
        loading={expensesQ.isLoading}
        loadingLabel="Loading expenses…"
      >
        <AccountsExpenseForm
          onSuccess={(msg) => {
            setMessage(msg);
            setError('');
            setEditingExpense(null);
          }}
          onError={(msg) => setError(msg)}
          editingExpense={editingExpense}
          onCancelEdit={() => setEditingExpense(null)}
          canManage={canManage}
        />
        <AccountsPanel title="Expense Bills" icon={Receipt}>
          <div className="divide-y rounded-xl border border-border/60">
            {expenseItems.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No expenses recorded yet.</p>
            ) : (
              expenseItems.map((expense) => (
                <div
                  key={expense.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{expense.expenseNo}</p>
                    <p className="text-sm text-muted-foreground">
                      {expense.ledgerAccount?.name} ·{' '}
                      {new Date(expense.expenseDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{inr(Number(expense.amount))}</span>
                    <span className="text-xs uppercase text-muted-foreground">
                      {expense.status}
                    </span>
                    {expense.status === 'DRAFT' && (
                      <>
                        {canManage ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingExpense(expense as AccountingExpense)}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {canPost ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              approveExpense(expense.id)
                                .then(() => {
                                  setMessage('Expense posted');
                                  qc.invalidateQueries({ queryKey: ['accounting', 'expenses'] });
                                })
                                .catch((e) => setError(apiErrorMessage(e)))
                            }
                          >
                            Approve & Post
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </AccountsPanel>
      </AccountsPageShell>
    );
  }

  if (page === 'budgets') {
    const budgets = budgetsQ.data ?? [];
    const editingBudget = editingBudgetId ? budgets.find((b) => b.id === editingBudgetId) : null;
    const overview = dashboardQ.data;
    const totalAllocated = budgets.reduce((sum, b) => sum + Number(b.allocatedAmount), 0);
    const totalSpent = budgets.reduce((sum, b) => sum + Number(b.spent), 0);
    const exceeded = budgets.filter((b) => b.utilizationPct >= 100).length;
    const avgUtil =
      budgets.length > 0
        ? Math.round(budgets.reduce((sum, b) => sum + b.utilizationPct, 0) / budgets.length)
        : (overview?.summary.budgetUtilization ?? 0);

    const kpis: AccountsKpi[] = [
      {
        label: 'Budget Utilization',
        value: `${avgUtil}%`,
        tone: 'budget',
        icon: BarChart3,
      },
      {
        label: 'Total Allocated',
        value: inr(totalAllocated),
        tone: 'asset',
        icon: Wallet,
      },
      {
        label: 'Total Spent',
        value: inr(totalSpent),
        tone: 'expense',
        icon: Receipt,
      },
      {
        label: 'Budgets Exceeded',
        value: String(exceeded),
        tone: exceeded > 0 ? 'alert' : 'income',
        icon: AlertTriangle,
      },
    ];

    const analytics =
      overview && overview.departmentBudgets.length > 0 ? (
        <AccountsPanel title="Department Budget Progress" icon={Building2}>
          <div className="space-y-3">
            {overview.departmentBudgets.map((row) => (
              <div key={row.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{row.name}</span>
                  <span className="font-medium text-violet-600">{row.utilizationPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      row.utilizationPct >= 90 ? 'bg-rose-500' : 'bg-violet-500',
                    )}
                    style={{ width: `${Math.min(row.utilizationPct, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </AccountsPanel>
      ) : null;

    const duplicateBudgetRow = (index: number) => {
      setBudgetRows((prev) => {
        const copy = { ...prev[index], allocatedAmount: '' };
        return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
      });
    };

    const saveBudgetRows = async () => {
      const validationErrors: Record<number, string> = {};
      budgetRows.forEach((r, idx) => {
        if (!r.ledgerAccountId) validationErrors[idx] = 'Select expense ledger.';
        else if (!(Number(r.allocatedAmount) > 0))
          validationErrors[idx] = 'Enter amount greater than 0.';
      });
      setBudgetRowErrors(validationErrors);

      const rows = budgetRows.filter((_, idx) => !validationErrors[idx]);
      if (!rows.length || !activeFyQ.data || Object.keys(validationErrors).length > 0) {
        setError('Fix highlighted budget row errors before saving.');
        return;
      }
      setSavingBudgetRows(true);
      setError('');
      try {
        if (editingBudgetId) {
          await updateBudget(editingBudgetId, {
            financialYearId: activeFyQ.data.id,
            ledgerAccountId: rows[0].ledgerAccountId,
            allocatedAmount: Number(rows[0].allocatedAmount),
          });
          setMessage('Budget line updated');
        } else {
          await Promise.all(
            rows.map((r) =>
              createBudget({
                financialYearId: activeFyQ.data.id,
                ledgerAccountId: r.ledgerAccountId,
                allocatedAmount: Number(r.allocatedAmount),
              }),
            ),
          );
          setMessage(`${rows.length} budget line(s) added`);
        }
        setBudgetRows([createBudgetDraft()]);
        setBudgetRowErrors({});
        setEditingBudgetId(null);
        qc.invalidateQueries({ queryKey: ['accounting', 'budgets'] });
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setSavingBudgetRows(false);
      }
    };

    return (
      <AccountsPageShell
        page={page}
        kpis={kpis}
        analytics={analytics}
        message={message}
        error={error}
        loading={budgetsQ.isLoading}
        loadingLabel="Loading budgets…"
      >
        <AccountsPanel title="Budget Lines" icon={BarChart3}>
          <div className="divide-y rounded-xl border border-border/60">
            {budgets.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No budget lines for the active financial year.
              </p>
            ) : (
              budgets.map((budget) => (
                <div
                  key={budget.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{budget.ledgerAccount?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Allocated {inr(Number(budget.allocatedAmount))} · Spent{' '}
                      {inr(Number(budget.spent))}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-violet-600">{budget.utilizationPct}%</p>
                    <p className="text-xs text-muted-foreground">
                      Remaining {inr(Number(budget.remaining))}
                    </p>
                    {canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          const b = budget as AccountingBudget;
                          setEditingBudgetId(b.id);
                          setBudgetRows([
                            {
                              ledgerAccountId: b.ledgerAccountId ?? b.ledgerAccount?.id ?? '',
                              allocatedAmount: String(b.allocatedAmount ?? ''),
                            },
                          ]);
                        }}
                      >
                        Edit
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </AccountsPanel>
        {activeFyQ.data && canManage && (
          <AccountsPanel
            title={editingBudgetId ? 'Edit Budget Line' : 'Add Budget Line'}
            icon={Plus}
          >
            {editingBudget ? (
              <p className="text-xs font-medium text-amber-700">
                Editing: {editingBudget.ledgerAccount?.name ?? 'Budget line'}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Tip: Press Enter to duplicate this row and Ctrl+S to save all rows.
            </p>
            <div
              className="space-y-3"
              onKeyDownCapture={(e) => {
                if (e.ctrlKey && e.key.toLowerCase() === 's') {
                  e.preventDefault();
                  void saveBudgetRows();
                  return;
                }
                if (
                  !editingBudgetId &&
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.ctrlKey &&
                  !e.altKey &&
                  !e.metaKey
                ) {
                  const target = e.target as HTMLElement;
                  const rowEl = target.closest('[data-budget-row-index]') as HTMLElement | null;
                  const rowIndex = rowEl?.dataset.budgetRowIndex;
                  if (rowIndex != null) {
                    e.preventDefault();
                    duplicateBudgetRow(Number(rowIndex));
                  }
                }
              }}
            >
              {budgetRows.map((row, index) => (
                <div
                  key={`budget-row-${index}`}
                  data-budget-row-index={index}
                  className="grid gap-2 md:grid-cols-[2fr_1fr_auto]"
                >
                  <select
                    className={`rounded-md border px-3 py-2 text-sm ${
                      budgetRowErrors[index] && !row.ledgerAccountId
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    value={row.ledgerAccountId}
                    onChange={(e) =>
                      setBudgetRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, ledgerAccountId: e.target.value } : item,
                        ),
                      )
                    }
                  >
                    <option value="">Expense ledger</option>
                    {(ledgersQ.data?.items ?? []).map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className={`rounded-md border px-3 py-2 text-sm ${
                      budgetRowErrors[index] && !(Number(row.allocatedAmount) > 0)
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    placeholder="Amount"
                    value={row.allocatedAmount}
                    onChange={(e) =>
                      setBudgetRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, allocatedAmount: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  {!editingBudgetId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateBudgetRow(index)}
                    >
                      Duplicate
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={budgetRows.length <= 1}
                    onClick={() =>
                      setBudgetRows((prev) =>
                        prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                  {budgetRowErrors[index] ? (
                    <p className="md:col-span-3 text-xs font-medium text-rose-600">
                      {budgetRowErrors[index]}
                    </p>
                  ) : null}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {!editingBudgetId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBudgetRows((prev) => [...prev, createBudgetDraft()])}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Row
                  </Button>
                ) : null}
                {editingBudgetId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingBudgetId(null);
                      setBudgetRows([createBudgetDraft()]);
                    }}
                  >
                    Cancel Edit
                  </Button>
                ) : null}
                <Button disabled={savingBudgetRows} onClick={() => void saveBudgetRows()}>
                  {savingBudgetRows ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {editingBudgetId ? 'Update Budget Line' : 'Save Budget Lines'}
                </Button>
              </div>
            </div>
          </AccountsPanel>
        )}
      </AccountsPageShell>
    );
  }

  if (page === 'fixed-assets') {
    const assetLedgers = (ledgersQ.data?.items ?? []).filter((l) => l.code.startsWith('FA-'));
    const assets = fixedAssetsQ.data ?? [];
    const editingAsset = editingAssetId ? assets.find((a) => a.id === editingAssetId) : null;
    const totalBookValue = assets.reduce((sum, a) => sum + Number(a.bookValue), 0);
    const totalCost = assets.reduce((sum, a) => sum + Number(a.cost), 0);

    const kpis: AccountsKpi[] = [
      {
        label: 'Registered Assets',
        value: String(assets.length),
        tone: 'asset',
        icon: Building2,
      },
      {
        label: 'Total Book Value',
        value: inr(totalBookValue),
        tone: 'asset',
        icon: Landmark,
      },
      {
        label: 'Original Cost',
        value: inr(totalCost),
        tone: 'default',
        icon: FileSpreadsheet,
      },
      {
        label: 'Depreciation Runs',
        value: String((depreciationQ.data ?? []).length),
        tone: 'budget',
        icon: BarChart3,
      },
    ];

    const duplicateAssetRow = (index: number) => {
      setAssetRows((prev) => {
        const copy = {
          ...prev[index],
          code: '',
          name: '',
          cost: '',
        };
        return [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
      });
    };

    const saveAssetRows = async () => {
      const validationErrors: Record<number, string> = {};
      assetRows.forEach((r, idx) => {
        if (!editingAssetId && !r.code?.trim()) validationErrors[idx] = 'Code is required.';
        else if (!r.name?.trim()) validationErrors[idx] = 'Name is required.';
        else if (!r.category?.trim()) validationErrors[idx] = 'Category is required.';
        else if (!(Number(r.cost) > 0)) validationErrors[idx] = 'Cost must be greater than 0.';
        else if (!(Number(r.usefulLifeMonths) > 0)) {
          validationErrors[idx] = 'Useful life must be greater than 0.';
        } else if (!r.assetLedgerId || !r.accumDepreciationLedgerId || !r.expenseLedgerId) {
          validationErrors[idx] = 'Select all three ledger mappings.';
        }
      });
      setAssetRowErrors(validationErrors);

      const rows = assetRows.filter((_, idx) => !validationErrors[idx]);
      if (!rows.length || Object.keys(validationErrors).length > 0) {
        setError('Fix highlighted fixed asset row errors before saving.');
        return;
      }
      setSavingAssetRows(true);
      setError('');
      try {
        if (editingAssetId) {
          const r = rows[0];
          await updateFixedAsset(editingAssetId, {
            name: r.name,
            category: r.category,
            acquisitionDate: r.acquisitionDate || new Date().toISOString().slice(0, 10),
            cost: Number(r.cost),
            usefulLifeMonths: Number(r.usefulLifeMonths),
            assetLedgerId: r.assetLedgerId,
            accumDepreciationLedgerId: r.accumDepreciationLedgerId,
            expenseLedgerId: r.expenseLedgerId,
          });
          setMessage('Fixed asset updated');
        } else {
          await Promise.all(
            rows.map((r) =>
              createFixedAsset({
                code: r.code,
                name: r.name,
                category: r.category,
                acquisitionDate: r.acquisitionDate || new Date().toISOString().slice(0, 10),
                cost: Number(r.cost),
                usefulLifeMonths: Number(r.usefulLifeMonths),
                assetLedgerId: r.assetLedgerId,
                accumDepreciationLedgerId: r.accumDepreciationLedgerId,
                expenseLedgerId: r.expenseLedgerId,
              }),
            ),
          );
          setMessage(`${rows.length} fixed asset(s) registered`);
        }
        setAssetRows([createAssetDraft()]);
        setAssetRowErrors({});
        setEditingAssetId(null);
        qc.invalidateQueries({ queryKey: ['accounting', 'fixed-assets'] });
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setSavingAssetRows(false);
      }
    };

    return (
      <AccountsPageShell page={page} kpis={kpis} message={message} error={error}>
        {canManage ? (
          <AccountsPanel
            title={editingAssetId ? 'Edit Fixed Asset' : 'Register Fixed Asset'}
            icon={Plus}
          >
            {editingAsset ? (
              <p className="text-xs font-medium text-amber-700">
                Editing: {editingAsset.name} ({editingAsset.code})
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Tip: Press Enter to duplicate this row and Ctrl+S to save all rows.
            </p>
            <div
              className="space-y-3"
              onKeyDownCapture={(e) => {
                if (e.ctrlKey && e.key.toLowerCase() === 's') {
                  e.preventDefault();
                  void saveAssetRows();
                  return;
                }
                if (
                  !editingAssetId &&
                  e.key === 'Enter' &&
                  !e.shiftKey &&
                  !e.ctrlKey &&
                  !e.altKey &&
                  !e.metaKey
                ) {
                  const target = e.target as HTMLElement;
                  const rowEl = target.closest('[data-asset-row-index]') as HTMLElement | null;
                  const rowIndex = rowEl?.dataset.assetRowIndex;
                  if (rowIndex != null) {
                    e.preventDefault();
                    duplicateAssetRow(Number(rowIndex));
                  }
                }
              }}
            >
              {assetRows.map((row, index) => (
                <div
                  key={`asset-row-${index}`}
                  data-asset-row-index={index}
                  className="grid gap-2 md:grid-cols-5"
                >
                  <input
                    className={`rounded-md border px-3 py-2 text-sm ${
                      assetRowErrors[index] && !editingAssetId && !row.code?.trim()
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    placeholder="Code"
                    value={row.code}
                    onChange={(e) =>
                      setAssetRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, code: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    className={`rounded-md border px-3 py-2 text-sm ${
                      assetRowErrors[index] && !row.name?.trim()
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    placeholder="Name"
                    value={row.name}
                    onChange={(e) =>
                      setAssetRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, name: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    className={`rounded-md border px-3 py-2 text-sm ${
                      assetRowErrors[index] && !row.category?.trim()
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    placeholder="Category"
                    value={row.category}
                    onChange={(e) =>
                      setAssetRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, category: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    type="date"
                    className={`rounded-md border px-3 py-2 text-sm ${
                      assetRowErrors[index] && !row.acquisitionDate
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    value={row.acquisitionDate}
                    onChange={(e) =>
                      setAssetRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, acquisitionDate: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  {!editingAssetId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => duplicateAssetRow(index)}
                    >
                      Duplicate
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={assetRows.length <= 1}
                    onClick={() =>
                      setAssetRows((prev) =>
                        prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                  <input
                    type="number"
                    className={`rounded-md border px-3 py-2 text-sm ${
                      assetRowErrors[index] && !(Number(row.cost) > 0)
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    placeholder="Cost"
                    value={row.cost}
                    onChange={(e) =>
                      setAssetRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, cost: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <input
                    type="number"
                    className={`rounded-md border px-3 py-2 text-sm ${
                      assetRowErrors[index] && !(Number(row.usefulLifeMonths) > 0)
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    placeholder="Useful life (months)"
                    value={row.usefulLifeMonths}
                    onChange={(e) =>
                      setAssetRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, usefulLifeMonths: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <select
                    className={`rounded-md border px-3 py-2 text-sm ${
                      assetRowErrors[index] && !row.assetLedgerId
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    value={row.assetLedgerId}
                    onChange={(e) =>
                      setAssetRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, assetLedgerId: e.target.value } : item,
                        ),
                      )
                    }
                  >
                    <option value="">Asset ledger</option>
                    {assetLedgers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className={`rounded-md border px-3 py-2 text-sm ${
                      assetRowErrors[index] && !row.accumDepreciationLedgerId
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    value={row.accumDepreciationLedgerId}
                    onChange={(e) =>
                      setAssetRows((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, accumDepreciationLedgerId: e.target.value }
                            : item,
                        ),
                      )
                    }
                  >
                    <option value="">Accum. depreciation ledger</option>
                    {(ledgersQ.data?.items ?? [])
                      .filter((l) => l.code === 'ACCUM-DEP')
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                  <select
                    className={`rounded-md border px-3 py-2 text-sm ${
                      assetRowErrors[index] && !row.expenseLedgerId
                        ? 'border-rose-500 focus-visible:ring-rose-500'
                        : ''
                    }`}
                    value={row.expenseLedgerId}
                    onChange={(e) =>
                      setAssetRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, expenseLedgerId: e.target.value } : item,
                        ),
                      )
                    }
                  >
                    <option value="">Depreciation expense ledger</option>
                    {(ledgersQ.data?.items ?? [])
                      .filter((l) => l.code === 'DEPRECIATION')
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                  </select>
                  {assetRowErrors[index] ? (
                    <p className="md:col-span-5 text-xs font-medium text-rose-600">
                      {assetRowErrors[index]}
                    </p>
                  ) : null}
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                {!editingAssetId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAssetRows((prev) => [...prev, createAssetDraft()])}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Row
                  </Button>
                ) : null}
                {editingAssetId ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingAssetId(null);
                      setAssetRows([createAssetDraft()]);
                    }}
                  >
                    Cancel Edit
                  </Button>
                ) : null}
                <Button disabled={savingAssetRows} onClick={() => void saveAssetRows()}>
                  {savingAssetRows ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  {editingAssetId ? 'Update Fixed Asset' : 'Register Assets'}
                </Button>
              </div>
            </div>
          </AccountsPanel>
        ) : (
          <AccountsPanel title="Register Fixed Asset" icon={Plus}>
            <p className="text-sm text-muted-foreground">
              You have read-only access for fixed assets.
            </p>
          </AccountsPanel>
        )}
        <AccountsPanel
          title="Depreciation"
          icon={BarChart3}
          action={
            canPost ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date();
                  runDepreciation({ periodYear: d.getFullYear(), periodMonth: d.getMonth() + 1 })
                    .then((result) => {
                      setMessage(`Depreciation posted for ${result.entriesPosted} assets`);
                      qc.invalidateQueries({ queryKey: ['accounting', 'fixed-assets'] });
                      qc.invalidateQueries({ queryKey: ['accounting', 'depreciation-entries'] });
                    })
                    .catch((e) => setError(apiErrorMessage(e)));
                }}
              >
                Run Current Month
              </Button>
            ) : null
          }
        >
          <div className="divide-y rounded-xl border border-border/60">
            {(depreciationQ.data ?? []).slice(0, 10).map((entry) => (
              <div key={entry.id} className="flex justify-between px-4 py-2 text-sm">
                <span>
                  {entry.asset?.name} · {entry.periodMonth}/{entry.periodYear}
                </span>
                <span>
                  {inr(Number(entry.amount))} · {entry.status}
                </span>
              </div>
            ))}
            {(depreciationQ.data ?? []).length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">No depreciation entries yet.</p>
            )}
          </div>
        </AccountsPanel>
        <AccountsPanel title="Asset Register" icon={Building2}>
          <div className="divide-y rounded-xl border border-border/60">
            {assets.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No fixed assets registered yet.</p>
            ) : (
              assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {asset.name} ({asset.code})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {asset.category} · Acquired{' '}
                      {new Date(asset.acquisitionDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">{inr(Number(asset.bookValue))}</p>
                    <p className="text-xs text-muted-foreground">
                      Cost {inr(Number(asset.cost))} · Depn{' '}
                      {inr(Number(asset.accumulatedDepreciation))}
                    </p>
                    {canManage ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          const a = asset as AccountingFixedAsset;
                          setEditingAssetId(a.id);
                          setAssetRows([
                            {
                              code: a.code ?? '',
                              name: a.name ?? '',
                              category: a.category ?? '',
                              acquisitionDate:
                                a.acquisitionDate?.slice(0, 10) ??
                                new Date().toISOString().slice(0, 10),
                              cost: String(a.cost ?? ''),
                              usefulLifeMonths: String(a.usefulLifeMonths ?? ''),
                              assetLedgerId: a.assetLedgerId ?? a.assetLedger?.id ?? '',
                              accumDepreciationLedgerId:
                                a.accumDepreciationLedgerId ?? a.accumDepreciationLedger?.id ?? '',
                              expenseLedgerId: a.expenseLedgerId ?? a.expenseLedger?.id ?? '',
                            },
                          ]);
                        }}
                      >
                        Edit
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </AccountsPanel>
      </AccountsPageShell>
    );
  }

  if (page === 'bank-reconciliation') {
    const bankLedgers = (ledgersQ.data?.items ?? []).filter((l) => l.isBank);
    const session = bankReconciliationQ.data;
    const recoList = bankReconciliationsQ.data ?? [];
    const overview = dashboardQ.data;
    const recoStats = overview?.bankReconciliation;

    const kpis: AccountsKpi[] = [
      {
        label: 'Open Sessions',
        value: String(
          recoStats?.pendingSessions ?? recoList.filter((r) => r.status === 'DRAFT').length,
        ),
        tone: 'asset',
        icon: Scale,
      },
      {
        label: 'Matched Lines',
        value: String(recoStats?.matched ?? 0),
        tone: 'income',
        icon: Receipt,
      },
      {
        label: 'Unmatched Lines',
        value: String(recoStats?.unmatched ?? 0),
        tone: 'alert',
        icon: AlertTriangle,
      },
      {
        label: 'Bank Balance',
        value: inr(overview?.summary.bankBalance ?? 0),
        tone: 'asset',
        icon: Landmark,
      },
    ];

    return (
      <AccountsPageShell page={page} kpis={kpis} message={message} error={error}>
        {canManage ? (
          <AccountsPanel title="New Reconciliation Session" icon={Plus}>
            <div className="grid gap-2 md:grid-cols-3">
              <select className="rounded-md border px-3 py-2 text-sm" id="reco-ledger">
                <option value="">Bank ledger</option>
                {bankLedgers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <input type="date" className="rounded-md border px-3 py-2 text-sm" id="reco-from" />
              <input type="date" className="rounded-md border px-3 py-2 text-sm" id="reco-to" />
              <input
                type="number"
                className="rounded-md border px-3 py-2 text-sm"
                placeholder="Statement opening"
                id="reco-open"
              />
              <input
                type="number"
                className="rounded-md border px-3 py-2 text-sm"
                placeholder="Statement closing"
                id="reco-close"
              />
              <Button
                onClick={() => {
                  createBankReconciliation({
                    ledgerAccountId: (document.getElementById('reco-ledger') as HTMLSelectElement)
                      .value,
                    statementStartDate: (document.getElementById('reco-from') as HTMLInputElement)
                      .value,
                    statementEndDate: (document.getElementById('reco-to') as HTMLInputElement)
                      .value,
                    statementOpeningBalance: Number(
                      (document.getElementById('reco-open') as HTMLInputElement).value,
                    ),
                    statementClosingBalance: Number(
                      (document.getElementById('reco-close') as HTMLInputElement).value,
                    ),
                  })
                    .then((created) => {
                      setMessage('Reconciliation session created');
                      setSelectedReconciliationId(created.id);
                      qc.invalidateQueries({ queryKey: ['accounting', 'bank-reconciliations'] });
                    })
                    .catch((e) => setError(apiErrorMessage(e)));
                }}
              >
                Create Session
              </Button>
            </div>
          </AccountsPanel>
        ) : (
          <AccountsPanel title="New Reconciliation Session" icon={Plus}>
            <p className="text-sm text-muted-foreground">
              You have read-only access for creating reconciliation sessions.
            </p>
          </AccountsPanel>
        )}
        <div className="grid gap-6 xl:grid-cols-2">
          <AccountsPanel title="Reconciliation Sessions" icon={Scale}>
            <div className="divide-y rounded-xl border border-border/60">
              {recoList.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No reconciliation sessions yet.</p>
              ) : (
                recoList.map((reco) => (
                  <button
                    key={reco.id}
                    type="button"
                    className="flex w-full justify-between px-4 py-3 text-left text-sm hover:bg-muted/40"
                    onClick={() => setSelectedReconciliationId(reco.id)}
                  >
                    <span>{reco.ledgerAccount?.name}</span>
                    <span className="text-muted-foreground">{reco.status}</span>
                  </button>
                ))
              )}
            </div>
          </AccountsPanel>
          {session && (
            <AccountsPanel title="Active Session" icon={Landmark}>
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{session.ledgerAccount?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(session.statementStartDate).toLocaleDateString('en-IN')} –{' '}
                      {new Date(session.statementEndDate).toLocaleDateString('en-IN')}
                    </p>
                  </div>
                  <span className="text-xs uppercase text-muted-foreground">{session.status}</span>
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-medium">Statement lines</p>
                  {bankStatementRows.map((row, index) => (
                    <div
                      key={`bank-line-${index}`}
                      className="grid gap-2 md:grid-cols-[1fr_2fr_1fr_1fr_1fr_auto]"
                    >
                      <input
                        type="date"
                        className="rounded-md border px-3 py-2 text-sm"
                        value={row.lineDate}
                        onChange={(e) =>
                          setBankStatementRows((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, lineDate: e.target.value } : item,
                            ),
                          )
                        }
                      />
                      <input
                        className="rounded-md border px-3 py-2 text-sm"
                        placeholder="Description"
                        value={row.description}
                        onChange={(e) =>
                          setBankStatementRows((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, description: e.target.value } : item,
                            ),
                          )
                        }
                      />
                      <input
                        className="rounded-md border px-3 py-2 text-sm"
                        placeholder="Reference"
                        value={row.referenceNo}
                        onChange={(e) =>
                          setBankStatementRows((prev) =>
                            prev.map((item, i) =>
                              i === index ? { ...item, referenceNo: e.target.value } : item,
                            ),
                          )
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="rounded-md border px-3 py-2 text-sm"
                        placeholder="Debit"
                        value={row.debitAmount}
                        onChange={(e) =>
                          setBankStatementRows((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, debitAmount: e.target.value, creditAmount: '' }
                                : item,
                            ),
                          )
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="rounded-md border px-3 py-2 text-sm"
                        placeholder="Credit"
                        value={row.creditAmount}
                        onChange={(e) =>
                          setBankStatementRows((prev) =>
                            prev.map((item, i) =>
                              i === index
                                ? { ...item, creditAmount: e.target.value, debitAmount: '' }
                                : item,
                            ),
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={bankStatementRows.length <= 1}
                        onClick={() =>
                          setBankStatementRows((prev) =>
                            prev.length <= 1 ? prev : prev.filter((_, i) => i !== index),
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setBankStatementRows((prev) => [...prev, createBankStatementLineDraft()])
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Row
                    </Button>
                  </div>
                  <details className="rounded-lg border border-border/60 p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Or paste JSON (bulk import)
                    </summary>
                    <textarea
                      className="mt-2 min-h-24 w-full rounded-md border px-3 py-2 text-sm font-mono"
                      placeholder='[{"lineDate":"2026-06-01","description":"NEFT","creditAmount":5000}]'
                      value={bankStatementJson}
                      onChange={(e) => setBankStatementJson(e.target.value)}
                    />
                  </details>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canManage ? (
                    <Button
                      variant="outline"
                      disabled={importingBankLines}
                      onClick={async () => {
                        setImportingBankLines(true);
                        setError('');
                        try {
                          let lines: Array<{
                            lineDate: string;
                            description?: string;
                            referenceNo?: string;
                            debitAmount?: number;
                            creditAmount?: number;
                          }>;

                          if (bankStatementJson.trim()) {
                            lines = JSON.parse(bankStatementJson) as typeof lines;
                          } else {
                            lines = bankStatementRows
                              .filter(
                                (r) =>
                                  r.lineDate &&
                                  (Number(r.debitAmount) > 0 || Number(r.creditAmount) > 0),
                              )
                              .map((r) => ({
                                lineDate: r.lineDate,
                                description: r.description || undefined,
                                referenceNo: r.referenceNo || undefined,
                                debitAmount:
                                  Number(r.debitAmount) > 0 ? Number(r.debitAmount) : undefined,
                                creditAmount:
                                  Number(r.creditAmount) > 0 ? Number(r.creditAmount) : undefined,
                              }));
                          }

                          if (!lines.length) {
                            setError(
                              'Add at least one statement line with date and debit or credit.',
                            );
                            return;
                          }

                          await importBankStatement(session.id, lines);
                          setMessage(`${lines.length} statement line(s) imported`);
                          setBankStatementRows([createBankStatementLineDraft()]);
                          setBankStatementJson('');
                          qc.invalidateQueries({
                            queryKey: ['accounting', 'bank-reconciliation', session.id],
                          });
                        } catch (e) {
                          setError(apiErrorMessage(e));
                        } finally {
                          setImportingBankLines(false);
                        }
                      }}
                    >
                      {importingBankLines ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : null}
                      Import Lines
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        autoMatchBankReconciliation(session.id)
                          .then((result) => {
                            setMessage(`Auto-matched ${result.matched} lines`);
                            qc.invalidateQueries({
                              queryKey: ['accounting', 'bank-reconciliation', session.id],
                            });
                          })
                          .catch((e) => setError(apiErrorMessage(e)))
                      }
                    >
                      Auto Match
                    </Button>
                  ) : null}
                  {canPost && session.status !== 'RECONCILED' && (
                    <Button
                      onClick={() =>
                        finalizeBankReconciliation(session.id)
                          .then(() => {
                            setMessage('Bank reconciliation finalized');
                            qc.invalidateQueries({
                              queryKey: ['accounting', 'bank-reconciliations'],
                            });
                            qc.invalidateQueries({
                              queryKey: ['accounting', 'bank-reconciliation', session.id],
                            });
                          })
                          .catch((e) => setError(apiErrorMessage(e)))
                      }
                    >
                      Finalize
                    </Button>
                  )}
                </div>
                <div className="divide-y max-h-80 overflow-y-auto rounded-xl border border-border/60">
                  {(session.lines ?? []).map((line) => (
                    <div key={line.id} className="flex justify-between px-4 py-2 text-sm">
                      <span>
                        {new Date(line.lineDate).toLocaleDateString('en-IN')} ·{' '}
                        {line.description ?? '—'}
                      </span>
                      <span className="text-muted-foreground">
                        {line.debitAmount > 0
                          ? `Dr ${inr(Number(line.debitAmount))}`
                          : `Cr ${inr(Number(line.creditAmount))}`}{' '}
                        · {line.matchStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </AccountsPanel>
          )}
        </div>
      </AccountsPageShell>
    );
  }

  if (page === 'reports') {
    const tb = trialBalanceQ.data as
      | {
          rows?: Array<{
            code: string;
            name: string;
            groupName: string;
            openingDebit: number;
            openingCredit: number;
            periodDebit: number;
            periodCredit: number;
            closingDebit: number;
            closingCredit: number;
          }>;
          totals?: {
            closingDebit: number;
            closingCredit: number;
          };
        }
      | undefined;
    const pl = profitLossQ.data as
      | {
          income?: Array<{ groupName: string; amount: number }>;
          expenses?: Array<{ groupName: string; amount: number }>;
          totalIncome?: number;
          totalExpenses?: number;
          netProfit?: number;
          resultLabel?: string;
        }
      | undefined;
    const bs = balanceSheetQ.data as
      | {
          assets?: Array<{ groupName: string; amount: number }>;
          liabilities?: Array<{ groupName: string; amount: number }>;
          surplus?: number;
          surplusLabel?: string;
          totalAssets?: number;
          totalLiabilitiesAndSurplus?: number;
          balanced?: boolean;
        }
      | undefined;

    const overview = dashboardQ.data;

    const kpis: AccountsKpi[] =
      reportTab === 'trial-balance'
        ? [
            {
              label: 'Ledgers',
              value: String(tb?.rows?.length ?? 0),
              tone: 'default',
              icon: FileSpreadsheet,
            },
            {
              label: 'Closing Debit',
              value: inr(Number(tb?.totals?.closingDebit ?? 0)),
              tone: 'asset',
              icon: Wallet,
            },
            {
              label: 'Closing Credit',
              value: inr(Number(tb?.totals?.closingCredit ?? 0)),
              tone: 'income',
              icon: Receipt,
            },
            {
              label: 'Financial Year',
              value: activeFyQ.data?.label ?? '—',
              tone: 'budget',
              icon: BarChart3,
            },
          ]
        : reportTab === 'profit-loss'
          ? [
              {
                label: 'Total Income',
                value: inr(Number(pl?.totalIncome ?? overview?.monthIncome ?? 0)),
                tone: 'income',
                icon: TrendingUp,
              },
              {
                label: 'Total Expenses',
                value: inr(Number(pl?.totalExpenses ?? overview?.monthExpense ?? 0)),
                tone: 'expense',
                icon: Receipt,
              },
              {
                label: pl?.resultLabel ?? 'Net Result',
                value: inr(Number(pl?.netProfit ?? 0)),
                tone: Number(pl?.netProfit ?? 0) >= 0 ? 'income' : 'alert',
                icon: BarChart3,
              },
              {
                label: 'Financial Year',
                value: activeFyQ.data?.label ?? '—',
                tone: 'budget',
                icon: FileSpreadsheet,
              },
            ]
          : [
              {
                label: 'Total Assets',
                value: inr(Number(bs?.totalAssets ?? overview?.fundBalance ?? 0)),
                tone: 'asset',
                icon: Landmark,
              },
              {
                label: 'Liabilities & Surplus',
                value: inr(Number(bs?.totalLiabilitiesAndSurplus ?? 0)),
                tone: 'expense',
                icon: Wallet,
              },
              {
                label: 'Balance Status',
                value: bs?.balanced ? 'Balanced' : 'Review',
                tone: bs?.balanced ? 'income' : 'alert',
                icon: Scale,
              },
              {
                label: bs?.surplusLabel ?? 'Surplus',
                value: inr(Number(bs?.surplus ?? 0)),
                tone: 'budget',
                icon: BarChart3,
              },
            ];

    const analytics =
      overview && reportTab === 'profit-loss' && overview.charts.incomeVsExpense.length > 0 ? (
        <AccountsPanel title="Income vs Expense Trend" icon={BarChart3}>
          <LineChartWidget
            data={overview.charts.incomeVsExpense.map((p) => ({
              label: p.label,
              value: p.income,
              income: p.income,
              expense: p.expense,
            }))}
            height={200}
            lines={[
              { key: 'income', name: 'Income', color: '#059669' },
              { key: 'expense', name: 'Expense', color: '#ea580c' },
            ]}
          />
        </AccountsPanel>
      ) : null;

    return (
      <AccountsPageShell
        page={page}
        kpis={kpis}
        analytics={analytics}
        message={message}
        error={error}
        headerAction={
          <div className="flex flex-wrap items-center gap-2">
            {(['trial-balance', 'profit-loss', 'balance-sheet'] as const).map((tab) => (
              <Button
                key={tab}
                variant={reportTab === tab ? 'default' : 'outline'}
                size="sm"
                onClick={() => setReportTab(tab)}
              >
                {tab === 'trial-balance'
                  ? 'Trial Balance'
                  : tab === 'profit-loss'
                    ? 'Profit & Loss'
                    : 'Balance Sheet'}
              </Button>
            ))}
            <span className="mx-1 hidden h-6 w-px bg-border sm:inline-block" />
            <Button
              variant="outline"
              size="sm"
              disabled={!activeFyQ.data || reportExporting !== null}
              onClick={() => exportReport('pdf')}
            >
              {reportExporting === 'pdf' ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Download PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!activeFyQ.data || reportExporting !== null}
              onClick={() => exportReport('xlsx')}
            >
              {reportExporting === 'xlsx' ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : null}
              Download Excel
            </Button>
          </div>
        }
      >
        {activeFyQ.data && (
          <p className="text-sm text-muted-foreground -mt-2">
            Financial year {activeFyQ.data.label}
          </p>
        )}
        {reportTab === 'trial-balance' && (
          <AccountsPanel title="Trial Balance" icon={FileSpreadsheet}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left">Ledger</th>
                    <th className="px-3 py-2 text-right">Open Dr</th>
                    <th className="px-3 py-2 text-right">Open Cr</th>
                    <th className="px-3 py-2 text-right">Period Dr</th>
                    <th className="px-3 py-2 text-right">Period Cr</th>
                    <th className="px-3 py-2 text-right">Close Dr</th>
                    <th className="px-3 py-2 text-right">Close Cr</th>
                  </tr>
                </thead>
                <tbody>
                  {(tb?.rows ?? []).map((row) => (
                    <tr key={row.code} className="border-b">
                      <td className="px-3 py-2">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.groupName}</p>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.openingDebit ? inr(row.openingDebit) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.openingCredit ? inr(row.openingCredit) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.periodDebit ? inr(row.periodDebit) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.periodCredit ? inr(row.periodCredit) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.closingDebit ? inr(row.closingDebit) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.closingCredit ? inr(row.closingCredit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {tb?.totals && (
                  <tfoot className="border-t bg-muted/20 font-semibold">
                    <tr>
                      <td className="px-3 py-2">Totals</td>
                      <td colSpan={4} />
                      <td className="px-3 py-2 text-right">{inr(tb.totals.closingDebit)}</td>
                      <td className="px-3 py-2 text-right">{inr(tb.totals.closingCredit)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </AccountsPanel>
        )}
        {reportTab === 'profit-loss' && pl && (
          <div className="grid gap-6 xl:grid-cols-2">
            <ReportGroupPanel title="Income" rows={pl.income ?? []} tone="income" />
            <ReportGroupPanel title="Expenses" rows={pl.expenses ?? []} tone="expense" />
            <AccountsPanel title="Profit & Loss Summary" icon={BarChart3} className="xl:col-span-2">
              <div className="flex flex-wrap justify-between gap-3 text-sm">
                <span>
                  Total Income:{' '}
                  <strong className="text-emerald-600">{inr(Number(pl.totalIncome ?? 0))}</strong>
                </span>
                <span>
                  Total Expenses:{' '}
                  <strong className="text-orange-600">{inr(Number(pl.totalExpenses ?? 0))}</strong>
                </span>
                <span className="font-semibold">
                  {pl.resultLabel}: {inr(Number(pl.netProfit ?? 0))}
                </span>
              </div>
            </AccountsPanel>
          </div>
        )}
        {reportTab === 'balance-sheet' && bs && (
          <div className="grid gap-6 xl:grid-cols-2">
            <ReportGroupPanel title="Assets" rows={bs.assets ?? []} />
            <ReportGroupPanel
              title="Liabilities & Funds"
              rows={[
                ...(bs.liabilities ?? []),
                {
                  groupName: bs.surplusLabel ?? 'Surplus',
                  amount: Number(bs.surplus ?? 0),
                },
              ]}
            />
            <AccountsPanel title="Balance Sheet Summary" icon={Scale} className="xl:col-span-2">
              <div className="flex flex-wrap justify-between gap-3 text-sm">
                <span>
                  Total Assets:{' '}
                  <strong className="text-blue-600">{inr(Number(bs.totalAssets ?? 0))}</strong>
                </span>
                <span>
                  Total Liabilities & Surplus:{' '}
                  <strong>{inr(Number(bs.totalLiabilitiesAndSurplus ?? 0))}</strong>
                </span>
                <span
                  className={cn(
                    'font-semibold',
                    bs.balanced ? 'text-emerald-600' : 'text-amber-600',
                  )}
                >
                  {bs.balanced ? 'Balanced' : 'Out of balance'}
                </span>
              </div>
            </AccountsPanel>
          </div>
        )}
      </AccountsPageShell>
    );
  }

  if (page === 'audit-logs') {
    const logs = auditLogsQ.data?.items ?? [];
    const kpis: AccountsKpi[] = [
      {
        label: 'Audit Entries',
        value: String(logs.length),
        tone: 'default',
        icon: ShieldCheck,
      },
      {
        label: 'Pending Vouchers',
        value: String(dashboardQ.data?.approvalQueue.voucherApproval ?? 0),
        tone: 'alert',
        icon: Receipt,
      },
      {
        label: 'Pending Expenses',
        value: String(dashboardQ.data?.approvalQueue.expenseApproval ?? 0),
        tone: 'expense',
        icon: Wallet,
      },
      {
        label: 'Active FY',
        value: dashboardQ.data?.summary.financialYearLabel ?? activeFyQ.data?.label ?? '—',
        tone: 'budget',
        icon: FileSpreadsheet,
      },
    ];

    return (
      <AccountsPageShell
        page={page}
        kpis={kpis}
        message={message}
        error={error}
        loading={auditLogsQ.isLoading}
        loadingLabel="Loading audit trail…"
      >
        <AccountsPanel title="Audit Trail" icon={ShieldCheck}>
          <div className="divide-y rounded-xl border border-border/60">
            {logs.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No audit entries yet.</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{log.action}</p>
                    <p className="text-muted-foreground">
                      {log.entityType} · {new Date(log.createdAt).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{log.entityId.slice(0, 8)}…</span>
                </div>
              ))
            )}
          </div>
        </AccountsPanel>
      </AccountsPageShell>
    );
  }

  return null;
}

function ReportGroupPanel({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: Array<{ groupName: string; amount: number }>;
  tone?: 'income' | 'expense';
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.groupName} className="flex justify-between text-sm">
            <span>{row.groupName}</span>
            <span
              className={cn(
                'font-medium',
                tone === 'income' && 'text-emerald-600',
                tone === 'expense' && 'text-rose-600',
              )}
            >
              {inr(row.amount)}
            </span>
          </div>
        ))}
        {!rows.length && (
          <p className="text-sm text-muted-foreground">No balances in this section.</p>
        )}
      </div>
    </div>
  );
}
