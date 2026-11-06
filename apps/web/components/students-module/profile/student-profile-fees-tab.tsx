'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Coins,
  Download,
  FileText,
  Hourglass,
  Plus,
  Printer,
  Wallet,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { StudentFeeSummary, StudentProfile } from '@/types/students';
import { cn } from '@/utils/cn';

type LedgerTab = 'ledger' | 'payments' | 'structure' | 'demands';

const TABS: { id: LedgerTab; label: string }[] = [
  { id: 'ledger', label: 'Fee Ledger' },
  { id: 'payments', label: 'Payment History' },
  { id: 'structure', label: 'Fee Structure' },
  { id: 'demands', label: 'Demands' },
];

const STATUS_LABEL: Record<string, string> = {
  CLEAR: 'Clear',
  DUE: 'Due',
  OVERDUE: 'Overdue',
  PARTIAL: 'Partial',
  PUBLISHED: 'Published',
  LOCKED: 'Locked',
  PARTIALLY_PAID: 'Partial',
};

const FEE_TYPE_LABEL: Record<string, string> = {
  GENERAL: 'Fee Demand',
  ADMISSION_SESSION: 'Admission Fee',
  MONTHLY: 'Monthly Fee',
  EXAM_FEE: 'Examination Fee',
  MISCELLANEOUS: 'Miscellaneous Fee',
  SHORT_TERM_COURSE: 'Short-term Course',
};

function inr(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDue(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function feeTypeLabel(value?: string | null) {
  if (!value) return 'Fee Demand';
  return (
    FEE_TYPE_LABEL[value] ?? value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function statusLabel(value?: string | null) {
  if (!value) return '—';
  return STATUS_LABEL[value] ?? value.replace(/_/g, ' ');
}

export function StudentProfileFeesTab({ profile }: { profile: StudentProfile }) {
  const summary = profile.feeSummary;
  const [tab, setTab] = useState<LedgerTab>('ledger');

  if (!summary) {
    return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <FeeHeader />
        <p className="px-5 py-8 text-sm text-slate-500">No fee data available for this student.</p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <FeeHeader />
      <FeeSummaryStrip summary={summary} />
      <div className="flex gap-2 overflow-x-auto border-b border-slate-100 px-4 py-3">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium',
              tab === item.id ? 'bg-[#2563eb] text-white' : 'text-slate-600 hover:bg-slate-50',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="p-4">
        {tab === 'payments' ? (
          <PaymentHistory summary={summary} />
        ) : tab === 'structure' ? (
          <FeeStructure summary={summary} />
        ) : (
          <FeeLedger summary={summary} title={tab === 'demands' ? 'Demands' : 'Fee Ledger'} />
        )}
      </div>
    </section>
  );
}

function FeeHeader() {
  return (
    <div className="flex items-start gap-3 bg-gradient-to-r from-blue-700 to-sky-500 px-5 py-4 text-white">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20">
        <Coins className="h-5 w-5" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">Fees</h2>
        <p className="text-sm text-white/85">
          Outstanding demands, payments, and fee ledger details.
        </p>
      </div>
    </div>
  );
}

function FeeSummaryStrip({ summary }: { summary: StudentFeeSummary }) {
  const totals = useMemo(() => {
    const total = summary.demands.reduce((sum, row) => sum + row.totalAmount, 0);
    const paid = summary.demands.reduce((sum, row) => sum + row.paidAmount, 0);
    const dueDates = summary.demands
      .filter((row) => row.balanceAmount > 0 && row.dueDate)
      .map((row) => row.dueDate as string)
      .sort();
    return { total, paid, nextDue: dueDates[0] ?? null };
  }, [summary.demands]);
  const overdue = summary.feeStatus === 'OVERDUE';

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard
        icon={FileText}
        iconClass="bg-slate-100 text-slate-600"
        label="Total Fee"
        value={inr(totals.total)}
      />
      <StatCard
        icon={CheckCircle2}
        iconClass="bg-emerald-100 text-emerald-600"
        label="Paid Amount"
        value={inr(totals.paid)}
        valueClass="text-emerald-700"
        cardClass="bg-emerald-50/70"
      />
      <StatCard
        icon={Hourglass}
        iconClass="bg-orange-100 text-orange-600"
        label="Balance Due"
        value={inr(summary.feeDueAmount)}
        valueClass="text-orange-700"
        cardClass="bg-orange-50/70"
      />
      <StatCard
        icon={AlertTriangle}
        iconClass={overdue ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}
        label="Status"
        value={STATUS_LABEL[summary.feeStatus] ?? summary.feeStatus}
        valueClass={overdue ? 'text-rose-600' : 'text-slate-800'}
        cardClass={overdue ? 'bg-rose-50/80' : undefined}
      />
      <StatCard
        icon={CalendarDays}
        iconClass="bg-sky-100 text-sky-600"
        label="Next Due Date"
        value={formatDue(totals.nextDue)}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  iconClass,
  label,
  value,
  valueClass,
  cardClass,
}: {
  icon: typeof FileText;
  iconClass: string;
  label: string;
  value: string;
  valueClass?: string;
  cardClass?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-slate-200 bg-white px-4 py-3', cardClass)}>
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', iconClass)}>
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </div>
      <p className={cn('mt-2 text-xl font-semibold text-slate-900', valueClass)}>{value}</p>
    </div>
  );
}

function FeeLedger({ summary, title }: { summary: StudentFeeSummary; title: string }) {
  const total = summary.demands.reduce((sum, row) => sum + row.totalAmount, 0);

  const download = () => {
    const lines = [
      ['Demand', 'Fee Type', 'Semester', 'Status', 'Due Date', 'Amount'],
      ...summary.demands.map((row) => [
        row.demandNo,
        feeTypeLabel(row.demandType),
        row.semesterNumber ?? '',
        statusLabel(row.status),
        formatDue(row.dueDate),
        String(row.totalAmount),
      ]),
    ];
    const csv = lines
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'fee-ledger.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-slate-800">
          {title} ({summary.demands.length} {summary.demands.length === 1 ? 'Demand' : 'Demands'})
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/fees/demands">
              <Plus className="mr-1 h-3.5 w-3.5" /> New Demand
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1 h-3.5 w-3.5" /> Print Ledger
          </Button>
          <Button size="sm" variant="outline" onClick={download} disabled={!summary.demands.length}>
            <Download className="mr-1 h-3.5 w-3.5" /> Download
          </Button>
        </div>
      </div>
      {summary.demands.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
          No active fee demands.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Demand / Invoice No.</th>
                <th className="px-3 py-2 font-medium">Fee Type</th>
                <th className="px-3 py-2 font-medium">Semester</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Due Date</th>
                <th className="px-3 py-2 text-right font-medium">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {summary.demands.map((demand, index) => (
                <tr key={demand.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                  <td className="px-3 py-3 font-medium text-blue-700">{demand.demandNo}</td>
                  <td className="px-3 py-3 text-slate-700">{feeTypeLabel(demand.demandType)}</td>
                  <td className="px-3 py-3">{demand.semesterNumber ?? '—'}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      {statusLabel(demand.status)}
                    </span>
                  </td>
                  <td className="px-3 py-3">{formatDue(demand.dueDate)}</td>
                  <td className="px-3 py-3 text-right font-medium">{inr(demand.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-sky-50 font-semibold text-slate-800">
                <td className="px-3 py-3" colSpan={6}>
                  Total Amount
                </td>
                <td className="px-3 py-3 text-right">{inr(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function PaymentHistory({ summary }: { summary: StudentFeeSummary }) {
  const rows = summary.demands.filter((row) => row.paidAmount > 0);
  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No payments recorded on these demands.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
            <th className="px-3 py-2 font-medium">Demand</th>
            <th className="px-3 py-2 font-medium">Fee Type</th>
            <th className="px-3 py-2 text-right font-medium">Paid</th>
            <th className="px-3 py-2 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-slate-100 last:border-0">
              <td className="px-3 py-3 font-medium text-blue-700">{row.demandNo}</td>
              <td className="px-3 py-3">{feeTypeLabel(row.demandType)}</td>
              <td className="px-3 py-3 text-right text-emerald-700">{inr(row.paidAmount)}</td>
              <td className="px-3 py-3 text-right">{inr(row.balanceAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FeeStructure({ summary }: { summary: StudentFeeSummary }) {
  const groups = new Map<string, number>();
  for (const row of summary.demands) {
    const label = feeTypeLabel(row.demandType);
    groups.set(label, (groups.get(label) ?? 0) + row.totalAmount);
  }
  const entries = [...groups.entries()];
  if (!entries.length) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        No fee structure is published for this student yet.
      </p>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([label, amount]) => (
        <div
          key={label}
          className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <Wallet className="h-4 w-4 text-blue-600" /> {label}
          </span>
          <span className="font-semibold text-slate-900">{inr(amount)}</span>
        </div>
      ))}
    </div>
  );
}
