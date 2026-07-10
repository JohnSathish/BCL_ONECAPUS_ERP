'use client';

import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Receipt,
  Scale,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { LineChartWidget } from '@/components/analytics/charts/line-chart-widget';
import { Button } from '@/components/ui/button';
import type { AccountingDashboard, AccountingInsights } from '@/types/accounting';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

export function formatInr(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export type AccountsPageMeta = {
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

export const ACCOUNTS_PAGE_META: Partial<Record<string, AccountsPageMeta>> = {
  'chart-of-accounts': {
    title: 'Chart of Accounts',
    description: 'Configure account groups, ledgers, cash/bank accounts, and opening balances.',
    icon: BookOpen,
  },
  vouchers: {
    title: 'Vouchers',
    description: 'Create, review, and post receipt, payment, journal, and contra vouchers.',
    icon: Receipt,
  },
  'voucher-new': {
    title: 'New Voucher',
    description: 'Record a balanced double-entry voucher with debit and credit lines.',
    icon: Receipt,
  },
  'cash-book': {
    title: 'Cash Book',
    description: 'Daily cash receipts and payments with running balance.',
    icon: Wallet,
  },
  'bank-book': {
    title: 'Bank Book',
    description: 'Bank account movements across all configured bank ledgers.',
    icon: Landmark,
  },
  ledger: {
    title: 'General Ledger',
    description: 'Ledger-wise transaction history and running balance for any account.',
    icon: FileSpreadsheet,
  },
  'financial-years': {
    title: 'Financial Years',
    description: 'Manage April–March financial years and activate the current books period.',
    icon: BarChart3,
  },
  settings: {
    title: 'GL Integration Settings',
    description: 'Map fees, payroll, and payment modes to ledger accounts for auto-journals.',
    icon: Settings2,
  },
  vendors: {
    title: 'Vendors',
    description: 'Supplier master for bills, expenses, and payment tracking.',
    icon: Building2,
  },
  expenses: {
    title: 'Expenses',
    description: 'Capture bills, approve expenses, and post payment vouchers.',
    icon: Receipt,
  },
  budgets: {
    title: 'Budgets',
    description: 'Department and ledger budgets with utilization tracking.',
    icon: BarChart3,
  },
  'fixed-assets': {
    title: 'Fixed Assets',
    description: 'Asset register, depreciation schedules, and monthly depreciation runs.',
    icon: Building2,
  },
  'bank-reconciliation': {
    title: 'Bank Reconciliation',
    description: 'Import bank statements, auto-match entries, and finalize reconciliation.',
    icon: Scale,
  },
  reports: {
    title: 'Financial Reports',
    description: 'Trial balance, profit & loss, and balance sheet for statutory review.',
    icon: FileSpreadsheet,
  },
  'audit-logs': {
    title: 'Audit Trail',
    description: 'Immutable log of accounting configuration and posting actions.',
    icon: ShieldCheck,
  },
};

export function AccountsPageIntro({ page, action }: { page: string; action?: ReactNode }) {
  const meta = ACCOUNTS_PAGE_META[page];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-blue-500/5 p-5 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Icon className="h-3.5 w-3.5" />
            Finance & Accounts
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">{meta.title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
            {meta.description}
          </p>
        </div>
        {action}
      </div>
    </section>
  );
}

export function AccountsPanel({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 font-medium">
          {Icon ? <Icon className="h-4 w-4 text-primary" /> : null}
          {title}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function AccountsHero({
  dashboard,
  insights,
  loading,
}: {
  dashboard?: AccountingDashboard;
  insights?: AccountingInsights;
  loading: boolean;
}) {
  const cards = [
    {
      label: 'Cash in Hand',
      value: dashboard ? formatInr(dashboard.cashInHand) : '—',
      tone: 'text-emerald-600',
      icon: Wallet,
    },
    {
      label: 'Bank Balance',
      value: dashboard ? formatInr(dashboard.bankBalance) : '—',
      tone: 'text-blue-600',
      icon: Landmark,
    },
    {
      label: "Today's Income",
      value: dashboard ? formatInr(dashboard.todayIncome) : '—',
      tone: 'text-emerald-600',
      icon: BarChart3,
    },
    {
      label: "Today's Expenses",
      value: dashboard ? formatInr(dashboard.todayExpense) : '—',
      tone: 'text-rose-600',
      icon: Receipt,
    },
  ];

  return (
    <section className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-emerald-500/5 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Institutional General Ledger
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Accounts Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Double-entry books for the college — cash & bank position, income & expense trends,
            budget control, payables, and auto-journals from fees and payroll.
          </p>
          {dashboard && (
            <p className="mt-2 text-sm text-muted-foreground">
              Active FY{' '}
              <span className="font-medium text-foreground">{dashboard.financialYear.label}</span>
              {insights ? (
                <>
                  {' '}
                  · YTD {insights.resultLabel}{' '}
                  <span className="font-medium text-foreground">
                    {formatInr(insights.netProfitYtd)}
                  </span>
                </>
              ) : null}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/admin/accounts/vouchers/new">New Voucher</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/accounts/reports">Reports</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/fees/fee-collection">Fee Collection</Link>
          </Button>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm"
            >
              <Icon className={cn('mb-3 h-5 w-5', card.tone)} />
              <p className="text-xl font-semibold">{loading ? '…' : card.value}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                {card.label}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function AccountsQuickActions() {
  const links = [
    { href: '/admin/accounts/vouchers/new', label: 'Post Voucher' },
    { href: '/admin/accounts/expenses', label: 'Record Expense' },
    { href: '/admin/accounts/bank-reconciliation', label: 'Bank Reconciliation' },
    { href: '/admin/accounts/reports', label: 'Trial Balance' },
    { href: '/admin/accounts/chart-of-accounts', label: 'Chart of Accounts' },
    { href: '/admin/accounts/settings', label: 'GL Mappings' },
  ];
  return (
    <AccountsPanel title="Quick Actions" icon={ArrowRight}>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <Button key={link.href} asChild size="sm" variant="outline">
            <Link href={link.href}>{link.label}</Link>
          </Button>
        ))}
      </div>
    </AccountsPanel>
  );
}

export function AccountsInsightGrid({ dashboard }: { dashboard: AccountingDashboard }) {
  const items = [
    { label: 'Monthly Income', value: formatInr(dashboard.monthIncome), tone: 'text-emerald-600' },
    { label: 'Monthly Expenses', value: formatInr(dashboard.monthExpense), tone: 'text-rose-600' },
    { label: 'Fund Balance', value: formatInr(dashboard.fundBalance), tone: 'text-primary' },
    { label: 'Total Payables', value: formatInr(dashboard.totalPayables), tone: 'text-amber-600' },
    {
      label: 'Total Receivables',
      value: formatInr(dashboard.totalReceivables),
      tone: 'text-blue-600',
    },
    {
      label: 'Budget Utilization',
      value: `${dashboard.budgetUtilization}%`,
      tone: 'text-indigo-600',
    },
    { label: 'Budgets Exceeded', value: String(dashboard.budgetsExceeded), tone: 'text-rose-600' },
    { label: 'Pending Drafts', value: String(dashboard.pendingApprovals), tone: 'text-amber-600' },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-border/60 bg-muted/20 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <p className={cn('mt-2 text-lg font-semibold', item.tone)}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function AccountsAlerts({ alerts }: { alerts: AccountingInsights['alerts'] }) {
  if (!alerts.length) return null;
  return (
    <AccountsPanel title="Attention Required" icon={AlertTriangle}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {alerts.map((alert) => (
          <div
            key={alert.message}
            className={cn(
              'rounded-xl border px-4 py-3 text-sm',
              alert.level === 'error' && 'border-rose-500/30 bg-rose-500/10',
              alert.level === 'warning' && 'border-amber-500/30 bg-amber-500/10',
              alert.level === 'info' && 'border-sky-500/30 bg-sky-500/10',
            )}
          >
            <p className="font-medium">{alert.message}</p>
            <p className="text-muted-foreground">{alert.count} item(s)</p>
          </div>
        ))}
      </div>
    </AccountsPanel>
  );
}

export function AccountsTrendCharts({ insights }: { insights: AccountingInsights }) {
  const trendData = insights.monthTrend.map((point) => ({
    label: point.label,
    value: point.income,
    income: point.income,
    expense: point.expense,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <AccountsPanel title="Income vs Expense Trend" icon={BarChart3}>
        <LineChartWidget
          data={trendData}
          height={240}
          lines={[
            { key: 'income', name: 'Income', color: '#059669' },
            { key: 'expense', name: 'Expense', color: '#e11d48' },
          ]}
        />
      </AccountsPanel>
      <div className="grid gap-4">
        <AccountsPanel title="Top Income (This Month)" icon={BarChart3}>
          <BarChartMini rows={insights.topIncome} color="#059669" />
        </AccountsPanel>
        <AccountsPanel title="Top Expenses (This Month)" icon={Receipt}>
          <BarChartMini rows={insights.topExpense} color="#e11d48" />
        </AccountsPanel>
      </div>
    </div>
  );
}

function BarChartMini({
  rows,
  color,
}: {
  rows: Array<{ name: string; amount: number }>;
  color: string;
}) {
  const max = Math.max(...rows.map((row) => row.amount), 1);
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No postings this month yet.</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.name}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="truncate pr-2">{row.name}</span>
            <span className="font-medium">{formatInr(row.amount)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(8, (row.amount / max) * 100)}%`, background: color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AccountsRecentTransactions({
  transactions,
}: {
  transactions: AccountingDashboard['recentTransactions'];
}) {
  return (
    <AccountsPanel title="Recent Transactions" icon={Receipt}>
      <div className="divide-y rounded-xl border border-border/60">
        {transactions.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No vouchers posted yet. Start with a receipt voucher from fee collection or a manual
            journal entry.
          </p>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{tx.voucherNo}</p>
                <p className="text-muted-foreground">
                  {tx.ledgerName} · {tx.voucherType}
                </p>
              </div>
              <div className="text-right">
                {tx.debit > 0 ? (
                  <p className="font-semibold text-orange-600">Dr {formatInr(tx.debit)}</p>
                ) : (
                  <p className="font-semibold text-emerald-600">Cr {formatInr(tx.credit)}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(tx.time).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </AccountsPanel>
  );
}

export function AccountsStatusBanner({ message, error }: { message: string; error: string }) {
  if (!message && !error) return null;
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 text-sm',
        error
          ? 'border-rose-500/30 bg-rose-500/10 text-rose-700'
          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
      )}
    >
      {error || message}
    </div>
  );
}

export function AccountsEmptyState({
  error,
  variant = 'error',
}: {
  error?: unknown;
  variant?: 'error' | 'setup';
}) {
  const message =
    variant === 'setup'
      ? 'Accounting books are not initialized for this institution yet.'
      : apiErrorMessage(
          error,
          'Unable to load accounts dashboard. Check API access and permissions.',
        );

  return (
    <section className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">
        {variant === 'setup' ? 'Set up Finance & Accounts' : 'Dashboard unavailable'}
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{message}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline">
          <Link href="/admin/accounts/financial-years">Financial Years</Link>
        </Button>
        <Button asChild>
          <Link href="/admin/accounts/chart-of-accounts">Open Chart of Accounts</Link>
        </Button>
      </div>
    </section>
  );
}

export function AccountsLoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-6 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
