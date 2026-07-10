'use client';

import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  BookOpen,
  Building2,
  FileSpreadsheet,
  Landmark,
  Plus,
  Receipt,
  Scale,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AccountsLoadingBlock,
  AccountsPageIntro,
  AccountsPanel,
  AccountsStatusBanner,
} from '@/components/accounts-module/accounts-ui';
import { cn } from '@/utils/cn';

export type AccountsKpiTone = 'income' | 'asset' | 'expense' | 'budget' | 'alert' | 'default';

export type AccountsKpi = {
  label: string;
  value: string;
  sub?: string;
  tone?: AccountsKpiTone;
  icon?: ComponentType<{ className?: string }>;
};

const KPI_CARD_TONE: Record<AccountsKpiTone, string> = {
  income: 'border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-card',
  asset: 'border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-card',
  expense: 'border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-card',
  budget: 'border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-card',
  alert: 'border-rose-500/20 bg-gradient-to-br from-rose-500/10 to-card',
  default: 'border-border/60 bg-gradient-to-br from-primary/10 to-card',
};

const KPI_ICON_TONE: Record<AccountsKpiTone, string> = {
  income: 'text-emerald-600',
  asset: 'text-blue-600',
  expense: 'text-orange-600',
  budget: 'text-violet-600',
  alert: 'text-rose-600',
  default: 'text-primary',
};

export function AccountsKpiCard({ label, value, sub, tone = 'default', icon: Icon }: AccountsKpi) {
  return (
    <div className={cn('rounded-2xl border p-4 shadow-sm', KPI_CARD_TONE[tone])}>
      {Icon ? <Icon className={cn('mb-2 h-5 w-5', KPI_ICON_TONE[tone])} /> : null}
      <p className="text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export function AccountsKpiGrid({ kpis }: { kpis: AccountsKpi[] }) {
  if (!kpis.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <AccountsKpiCard key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}

const PAGE_QUICK_ACTIONS: Record<
  string,
  Array<{ label: string; href: string; icon: ComponentType<{ className?: string }> }>
> = {
  'cash-book': [
    { label: 'Receipt Voucher', href: '/admin/accounts/vouchers/new?type=RECEIPT', icon: Receipt },
    { label: 'Payment Voucher', href: '/admin/accounts/vouchers/new?type=PAYMENT', icon: Wallet },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
    { label: 'General Ledger', href: '/admin/accounts/ledger', icon: FileSpreadsheet },
  ],
  'bank-book': [
    { label: 'Payment Voucher', href: '/admin/accounts/vouchers/new?type=PAYMENT', icon: Wallet },
    { label: 'Bank Reconciliation', href: '/admin/accounts/bank-reconciliation', icon: Scale },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
    { label: 'Financial Reports', href: '/admin/accounts/reports', icon: FileSpreadsheet },
  ],
  ledger: [
    { label: 'Chart of Accounts', href: '/admin/accounts/chart-of-accounts', icon: BookOpen },
    { label: 'Trial Balance', href: '/admin/accounts/reports', icon: FileSpreadsheet },
    { label: 'New Voucher', href: '/admin/accounts/vouchers/new', icon: Plus },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
  ],
  expenses: [
    { label: 'Add Expense', href: '/admin/accounts/expenses', icon: Plus },
    { label: 'Vendors', href: '/admin/accounts/vendors', icon: Building2 },
    { label: 'Payment Voucher', href: '/admin/accounts/vouchers/new?type=PAYMENT', icon: Wallet },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
  ],
  vouchers: [
    { label: 'New Voucher', href: '/admin/accounts/vouchers/new', icon: Plus },
    { label: 'Expenses', href: '/admin/accounts/expenses', icon: Receipt },
    { label: 'Cash Book', href: '/admin/accounts/cash-book', icon: Wallet },
    { label: 'Reports', href: '/admin/accounts/reports', icon: BarChart3 },
  ],
  'voucher-new': [
    { label: 'All Vouchers', href: '/admin/accounts/vouchers', icon: Receipt },
    { label: 'Cash Book', href: '/admin/accounts/cash-book', icon: Wallet },
    { label: 'Bank Book', href: '/admin/accounts/bank-book', icon: Landmark },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
  ],
  vendors: [
    { label: 'Add Expense', href: '/admin/accounts/expenses', icon: Receipt },
    { label: 'Payment Voucher', href: '/admin/accounts/vouchers/new?type=PAYMENT', icon: Wallet },
    { label: 'Expenses', href: '/admin/accounts/expenses', icon: Plus },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
  ],
  budgets: [
    { label: 'Expenses', href: '/admin/accounts/expenses', icon: Receipt },
    { label: 'Financial Reports', href: '/admin/accounts/reports', icon: FileSpreadsheet },
    { label: 'Chart of Accounts', href: '/admin/accounts/chart-of-accounts', icon: BookOpen },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
  ],
  reports: [
    { label: 'Trial Balance', href: '/admin/accounts/reports', icon: FileSpreadsheet },
    { label: 'Balance Sheet', href: '/admin/accounts/reports', icon: BarChart3 },
    { label: 'Audit Trail', href: '/admin/accounts/audit-logs', icon: ShieldCheck },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
  ],
  'bank-reconciliation': [
    { label: 'Bank Book', href: '/admin/accounts/bank-book', icon: Landmark },
    { label: 'Payment Voucher', href: '/admin/accounts/vouchers/new?type=PAYMENT', icon: Wallet },
    { label: 'Financial Reports', href: '/admin/accounts/reports', icon: FileSpreadsheet },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
  ],
  'chart-of-accounts': [
    { label: 'New Voucher', href: '/admin/accounts/vouchers/new', icon: Plus },
    { label: 'General Ledger', href: '/admin/accounts/ledger', icon: FileSpreadsheet },
    { label: 'GL Mappings', href: '/admin/accounts/settings', icon: BookOpen },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
  ],
  'financial-years': [
    { label: 'Reports', href: '/admin/accounts/reports', icon: FileSpreadsheet },
    { label: 'Budgets', href: '/admin/accounts/budgets', icon: BarChart3 },
    { label: 'Chart of Accounts', href: '/admin/accounts/chart-of-accounts', icon: BookOpen },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
  ],
  settings: [
    { label: 'Fee Collection', href: '/admin/fees/fee-collection', icon: Receipt },
    { label: 'Chart of Accounts', href: '/admin/accounts/chart-of-accounts', icon: BookOpen },
    { label: 'Vouchers', href: '/admin/accounts/vouchers', icon: FileSpreadsheet },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
  ],
  'fixed-assets': [
    { label: 'Depreciation Run', href: '/admin/accounts/fixed-assets', icon: BarChart3 },
    { label: 'Journal Entry', href: '/admin/accounts/vouchers/new?type=JOURNAL', icon: Plus },
    { label: 'Balance Sheet', href: '/admin/accounts/reports', icon: FileSpreadsheet },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
  ],
  'audit-logs': [
    { label: 'Financial Reports', href: '/admin/accounts/reports', icon: FileSpreadsheet },
    { label: 'Vouchers', href: '/admin/accounts/vouchers', icon: Receipt },
    { label: 'Bank Reconciliation', href: '/admin/accounts/bank-reconciliation', icon: Scale },
    { label: 'Accounts Dashboard', href: '/admin/accounts', icon: BarChart3 },
  ],
};

export function AccountsPageQuickActions({ page }: { page: string }) {
  const actions = PAGE_QUICK_ACTIONS[page];
  if (!actions?.length) return null;
  return (
    <AccountsPanel title="Quick Actions" icon={Plus}>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => (
          <Button
            key={action.href + action.label}
            asChild
            variant="outline"
            className="h-auto justify-start py-3"
          >
            <Link href={action.href}>
              <action.icon className="mr-2 h-4 w-4 shrink-0" />
              {action.label}
            </Link>
          </Button>
        ))}
      </div>
    </AccountsPanel>
  );
}

export function AccountsPageShell({
  page,
  kpis = [],
  headerAction,
  analytics,
  children,
  showQuickActions = true,
  loading,
  loadingLabel,
  message,
  error,
}: {
  page: string;
  kpis?: AccountsKpi[];
  headerAction?: ReactNode;
  analytics?: ReactNode;
  children: ReactNode;
  showQuickActions?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  message?: string;
  error?: string;
}) {
  return (
    <div className="space-y-5">
      <AccountsPageIntro page={page} action={headerAction} />
      <AccountsStatusBanner message={message ?? ''} error={error ?? ''} />
      {loading ? (
        <AccountsLoadingBlock label={loadingLabel ?? 'Loading…'} />
      ) : (
        <>
          <AccountsKpiGrid kpis={kpis} />
          {analytics}
          {children}
          {showQuickActions ? <AccountsPageQuickActions page={page} /> : null}
        </>
      )}
    </div>
  );
}

export function AccountsEntriesTable({
  entries,
  formatAmount,
}: {
  entries: Array<{
    id: string;
    voucherDate: string;
    voucherNo: string;
    entryType: string;
    amount: number;
    narration?: string | null;
    runningBalance: number;
    ledgerName?: string;
  }>;
  formatAmount: (value: number) => string;
}) {
  if (!entries.length) {
    return <p className="text-sm text-muted-foreground">No posted entries in this period.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Voucher</th>
            {entries.some((e) => e.ledgerName) ? <th className="px-3 py-2">Ledger</th> : null}
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className="border-b border-border/50">
              <td className="px-3 py-2 whitespace-nowrap">
                {new Date(entry.voucherDate).toLocaleDateString('en-IN')}
              </td>
              <td className="px-3 py-2 font-medium">{entry.voucherNo}</td>
              {entries.some((e) => e.ledgerName) ? (
                <td className="px-3 py-2 text-muted-foreground">{entry.ledgerName ?? '—'}</td>
              ) : null}
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-medium',
                    entry.entryType === 'DEBIT'
                      ? 'bg-orange-500/10 text-orange-700'
                      : 'bg-emerald-500/10 text-emerald-700',
                  )}
                >
                  {entry.entryType}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-medium">{formatAmount(entry.amount)}</td>
              <td className="px-3 py-2 text-right font-medium text-blue-600">
                {formatAmount(entry.runningBalance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
