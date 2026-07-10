'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Bot,
  Building2,
  FileSpreadsheet,
  Landmark,
  Loader2,
  Plus,
  Receipt,
  Scale,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { DonutChartWidget } from '@/components/analytics/charts/donut-chart-widget';
import { LineChartWidget } from '@/components/analytics/charts/line-chart-widget';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { chatWithAiAssistant } from '@/services/ai-assistant';
import type { AccountingDashboardOverview } from '@/types/accounting';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { formatInr } from '@/components/accounts-module/accounts-ui';

const AI_PROMPTS = [
  "What is today's income?",
  'Show unpaid vendors.',
  'Generate Trial Balance.',
  "Show this month's expenses.",
  'Generate Balance Sheet.',
];

type Props = {
  data?: AccountingDashboardOverview;
  loading?: boolean;
  error?: unknown;
};

export function AccountsDashboardView({ data, loading, error }: Props) {
  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-dashed bg-muted/20">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading financial overview…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-3xl border border-dashed border-rose-500/30 bg-rose-500/5 p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
        <h2 className="mt-3 text-lg font-semibold">Unable to load dashboard</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {apiErrorMessage(
            error,
            'Check API access, permissions (accounts:read), and that accounting is set up.',
          )}
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/accounts/financial-years">Financial Years</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/accounts/chart-of-accounts">Chart of Accounts</Link>
          </Button>
        </div>
      </section>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/10 via-card to-blue-500/5 p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Financial health · {summary.financialYearLabel}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              What is the financial health of the college today?
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Live view for Principal, Accountant, Bursar & Auditor
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/admin/accounts/vouchers/new">
                <Plus className="mr-1 h-4 w-4" /> Receipt Voucher
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/accounts/reports">Reports</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryKpi
              label="Today's Collection"
              value={formatInr(summary.todayCollection)}
              sub={
                summary.todayCollectionChangePct !== 0
                  ? `${summary.todayCollectionChangePct > 0 ? '+' : ''}${summary.todayCollectionChangePct}% vs yesterday`
                  : 'Fee & receipt collections'
              }
              tone="income"
              icon={TrendingUp}
            />
            <SummaryKpi
              label="Cash in Hand"
              value={formatInr(summary.cashInHand)}
              tone="asset"
              icon={Wallet}
            />
            <SummaryKpi
              label="Bank Balance"
              value={formatInr(summary.bankBalance)}
              tone="asset"
              icon={Landmark}
            />
            <SummaryKpi
              label="Today's Expenses"
              value={formatInr(summary.todayExpenses)}
              tone="expense"
              icon={ArrowUpRight}
            />
            <SummaryKpi
              label="Outstanding Receivables"
              value={formatInr(summary.outstandingReceivables)}
              tone="asset"
              icon={ArrowDownLeft}
            />
            <SummaryKpi
              label="Outstanding Payables"
              value={formatInr(summary.outstandingPayables)}
              tone="expense"
              icon={Receipt}
            />
            <SummaryKpi
              label="Budget Utilization"
              value={`${summary.budgetUtilization}%`}
              tone="budget"
              icon={BarChart3}
            />
            <SummaryKpi
              label="Financial Year"
              value={summary.financialYearLabel}
              tone="default"
              icon={FileSpreadsheet}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <DashPanel title="Income vs Expense" icon={BarChart3} className="lg:col-span-2">
              <LineChartWidget
                data={data.charts.incomeVsExpense.map((p) => ({
                  label: p.label,
                  value: p.income,
                  income: p.income,
                  expense: p.expense,
                }))}
                height={220}
                lines={[
                  { key: 'income', name: 'Income', color: '#059669' },
                  { key: 'expense', name: 'Expense', color: '#ea580c' },
                ]}
              />
            </DashPanel>
            <DashPanel title="Expense Distribution" icon={Receipt}>
              <DonutChartWidget
                data={data.charts.expenseDistribution.map((s) => ({
                  label: s.label,
                  value: s.value,
                }))}
                height={220}
              />
              <div className="mt-3 space-y-1">
                {data.charts.expenseDistribution.map((s) => (
                  <div key={s.label} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{s.label}</span>
                    <span className="font-medium text-orange-600">{s.pct}%</span>
                  </div>
                ))}
              </div>
            </DashPanel>
          </div>

          <DashPanel title="Fee Collection Trend" icon={Banknote}>
            <LineChartWidget
              data={data.charts.feeCollectionTrend.map((p) => ({
                label: p.label,
                value: p.amount,
              }))}
              height={180}
              lines={[{ key: 'value', name: 'Collected', color: '#2563eb' }]}
            />
          </DashPanel>

          <div className="grid gap-4 md:grid-cols-2">
            <CashBankCard title="Cash Book" tone="asset" data={data.cashPosition.cash} />
            <CashBankCard title="Bank Book" tone="asset" data={data.cashPosition.bank} />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat
              label="Fee Collected Today"
              value={formatInr(data.feeCollection.totalCollectedToday)}
              icon={Banknote}
              tone="income"
            />
            <MiniStat
              label="Students Paid Today"
              value={String(data.feeCollection.studentsPaidToday)}
              icon={Users}
              tone="asset"
            />
            <MiniStat
              label="Pending Fee"
              value={formatInr(data.feeCollection.pendingFee)}
              icon={AlertTriangle}
              tone="expense"
            />
            <MiniStat
              label="Defaulters"
              value={String(data.feeCollection.defaulters)}
              icon={Users}
              tone="alert"
              href="/admin/fees/defaulters"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DashPanel title="Today's Expenses" icon={Receipt}>
              <div className="space-y-2">
                {data.todayExpenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No expenses posted today.</p>
                ) : (
                  data.todayExpenses.map((row) => (
                    <div key={row.name} className="flex justify-between text-sm">
                      <span>{row.name}</span>
                      <span className="font-medium text-orange-600">{formatInr(row.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </DashPanel>
            <DashPanel title="Department Budget" icon={Building2}>
              <div className="space-y-3">
                {data.departmentBudgets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No budgets configured.</p>
                ) : (
                  data.departmentBudgets.map((row) => (
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
                  ))
                )}
              </div>
            </DashPanel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DashPanel title="Bank Reconciliation" icon={Scale}>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-muted/40 p-3">
                  <p className="text-2xl font-semibold">
                    {data.bankReconciliation.pendingSessions}
                  </p>
                  <p className="text-xs text-muted-foreground">Open sessions</p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-3">
                  <p className="text-2xl font-semibold text-emerald-600">
                    {data.bankReconciliation.matched}
                  </p>
                  <p className="text-xs text-muted-foreground">Matched</p>
                </div>
                <div className="rounded-xl bg-rose-500/10 p-3">
                  <p className="text-2xl font-semibold text-rose-600">
                    {data.bankReconciliation.unmatched}
                  </p>
                  <p className="text-xs text-muted-foreground">Unmatched</p>
                </div>
              </div>
            </DashPanel>
            <DashPanel title="Pending Approvals" icon={AlertTriangle}>
              <div className="grid grid-cols-2 gap-2">
                <ApprovalChip
                  label="Expense Approval"
                  count={data.approvalQueue.expenseApproval}
                  href="/admin/accounts/expenses"
                />
                <ApprovalChip
                  label="Voucher Approval"
                  count={data.approvalQueue.voucherApproval}
                  href="/admin/accounts/vouchers"
                />
                <ApprovalChip
                  label="Vendor Bills"
                  count={data.approvalQueue.vendorBills}
                  href="/admin/accounts/expenses"
                />
                <ApprovalChip
                  label="Journal Approval"
                  count={data.approvalQueue.journalApproval}
                  href="/admin/accounts/vouchers"
                />
              </div>
            </DashPanel>
          </div>

          <DashPanel title="Recent Transactions" icon={Receipt}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">Voucher</th>
                    <th className="px-3 py-2">Ledger</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentTransactions.map((row) => (
                    <tr key={row.id} className="border-b border-border/50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(row.time).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-2 font-medium">{row.voucherNo}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.ledgerName}</td>
                      <td className="px-3 py-2 text-right text-orange-600">
                        {row.debit > 0 ? formatInr(row.debit) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-600">
                        {row.credit > 0 ? formatInr(row.credit) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashPanel>

          <DashPanel title="Quick Actions" icon={Plus}>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.label}
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
          </DashPanel>

          {data.alerts.length > 0 && (
            <DashPanel title="Financial Alerts" icon={AlertTriangle}>
              <div className="grid gap-3 md:grid-cols-2">
                {data.alerts.map((alert) => (
                  <div
                    key={alert.title}
                    className={cn(
                      'rounded-xl border px-4 py-3',
                      alert.level === 'error' && 'border-rose-500/30 bg-rose-500/10',
                      alert.level === 'warning' && 'border-amber-500/30 bg-amber-500/10',
                      alert.level === 'info' && 'border-sky-500/30 bg-sky-500/10',
                    )}
                  >
                    <p className="font-medium">{alert.title}</p>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                ))}
              </div>
            </DashPanel>
          )}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-4 xl:self-start">
          <FinanceAiPanel />
        </aside>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { label: 'Receipt Voucher', href: '/admin/accounts/vouchers/new?type=RECEIPT', icon: Receipt },
  { label: 'Payment Voucher', href: '/admin/accounts/vouchers/new?type=PAYMENT', icon: Wallet },
  {
    label: 'Journal Entry',
    href: '/admin/accounts/vouchers/new?type=JOURNAL',
    icon: FileSpreadsheet,
  },
  { label: 'Add Expense', href: '/admin/accounts/expenses', icon: Plus },
  { label: 'Add Vendor', href: '/admin/accounts/vendors', icon: Building2 },
  { label: 'Cash Deposit', href: '/admin/accounts/vouchers/new?type=CONTRA', icon: Banknote },
  { label: 'Generate Reports', href: '/admin/accounts/reports', icon: BarChart3 },
  { label: 'Bank Reconciliation', href: '/admin/accounts/bank-reconciliation', icon: Scale },
];

function SummaryKpi({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: 'income' | 'asset' | 'expense' | 'budget' | 'default';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const iconTone = {
    income: 'text-emerald-600',
    asset: 'text-blue-600',
    expense: 'text-orange-600',
    budget: 'text-violet-600',
    default: 'text-primary',
  }[tone];

  const cardTone = {
    income: 'border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-card',
    asset: 'border-blue-500/20 bg-gradient-to-br from-blue-500/10 to-card',
    expense: 'border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-card',
    budget: 'border-violet-500/20 bg-gradient-to-br from-violet-500/10 to-card',
    default: 'border-border/60 bg-gradient-to-br from-primary/10 to-card',
  }[tone];

  return (
    <div className={cn('rounded-2xl border p-4 shadow-sm', cardTone)}>
      <Icon className={cn('mb-2 h-5 w-5', iconTone)} />
      <p className="text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function DashPanel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-border/70 bg-card shadow-sm', className)}>
      <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 font-medium">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function CashBankCard({
  title,
  data,
  tone,
}: {
  title: string;
  data: { openingBalance: number; receipts: number; payments: number; closingBalance: number };
  tone: 'asset';
}) {
  const rows = [
    ['Opening Balance', data.openingBalance],
    ["Today's Receipts / Deposits", data.receipts],
    ["Today's Payments / Withdrawals", data.payments],
    ['Closing / Current Balance', data.closingBalance],
  ] as const;

  return (
    <DashPanel title={title} icon={Landmark}>
      <div className="space-y-2">
        {rows.map(([label, amount]) => (
          <div key={label} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className={cn('font-semibold', tone === 'asset' && 'text-blue-600')}>
              {formatInr(amount)}
            </span>
          </div>
        ))}
      </div>
    </DashPanel>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'income' | 'asset' | 'expense' | 'alert';
  href?: string;
}) {
  const content = (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <Icon
        className={cn(
          'mb-2 h-5 w-5',
          tone === 'income' && 'text-emerald-600',
          tone === 'asset' && 'text-blue-600',
          tone === 'expense' && 'text-orange-600',
          tone === 'alert' && 'text-rose-600',
        )}
      />
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function ApprovalChip({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-sm transition hover:bg-muted/40"
    >
      <span>{label}</span>
      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
        {count}
      </span>
    </Link>
  );
}

function FinanceAiPanel() {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const chatM = useMutation({
    mutationFn: (q: string) => chatWithAiAssistant(q),
    onSuccess: (res) => setAnswer(res.answer),
  });

  return (
    <DashPanel title="Ask Finance AI" icon={Bot}>
      <p className="mb-3 text-sm text-muted-foreground">
        Natural language queries for income, expenses, reports, and balances.
      </p>
      <div className="flex gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask Finance AI…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && question.trim()) chatM.mutate(question.trim());
          }}
        />
        <Button
          size="sm"
          disabled={!question.trim() || chatM.isPending}
          onClick={() => chatM.mutate(question.trim())}
        >
          {chatM.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {AI_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-xs hover:bg-muted/60"
            onClick={() => {
              setQuestion(prompt);
              chatM.mutate(prompt);
            }}
          >
            {prompt}
          </button>
        ))}
      </div>
      {answer ? (
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3 text-sm leading-relaxed">
          {answer}
        </div>
      ) : null}
    </DashPanel>
  );
}
