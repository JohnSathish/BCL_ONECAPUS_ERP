'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { GhostButton, PrimaryButton } from '../academic/academic-ui';
import { WaCard } from '../whatsapp/whatsapp-ui';
import {
  acctExportUrl,
  acctVoucherAction,
  closeAcctCash,
  createAcctVoucher,
  fetchAcctAssets,
  fetchAcctAudit,
  fetchAcctBanks,
  fetchAcctBootstrap,
  fetchAcctBva,
  fetchAcctCashier,
  fetchAcctChart,
  fetchAcctCostCentres,
  fetchAcctDashboard,
  fetchAcctLedger,
  fetchAcctPeriods,
  fetchAcctRules,
  fetchAcctStatements,
  fetchAcctTax,
  fetchAcctTrial,
  fetchAcctVendors,
  fetchAcctVouchers,
  lockAcctPeriod,
  runAcctDepreciation,
  runAcctYearEnd,
  saveAcctAccount,
  saveAcctAsset,
  saveAcctBank,
  saveAcctBudget,
  saveAcctRule,
  saveAcctTax,
  saveAcctVendor,
} from '@/services/school-accounts';

const LINKS = [
  ['Dashboard', '/admin/school-sis/accounts'],
  ['Receipt', '/admin/school-sis/accounts/receipt'],
  ['Payment', '/admin/school-sis/accounts/payment'],
  ['Contra', '/admin/school-sis/accounts/contra'],
  ['Journal', '/admin/school-sis/accounts/journal'],
  ['Chart of Accounts', '/admin/school-sis/accounts/chart'],
  ['General Ledger', '/admin/school-sis/accounts/ledger'],
  ['Trial Balance', '/admin/school-sis/accounts/trial-balance'],
  ['Day Book', '/admin/school-sis/accounts/day-book'],
  ['Cash Book', '/admin/school-sis/accounts/cash-book'],
  ['Banks', '/admin/school-sis/accounts/banks'],
  ['Vendors', '/admin/school-sis/accounts/vendors'],
  ['Budget', '/admin/school-sis/accounts/budget'],
  ['Assets', '/admin/school-sis/accounts/assets'],
  ['Tax', '/admin/school-sis/accounts/tax/gst'],
  ['Reports', '/admin/school-sis/accounts/reports/statements'],
  ['Cashier', '/admin/school-sis/accounts/cashier'],
  ['Periods', '/admin/school-sis/accounts/periods'],
  ['Audit', '/admin/school-sis/accounts/audit'],
] as const;

const TYPE_FROM_PATH: Record<string, string> = {
  receipt: 'RECEIPT',
  payment: 'PAYMENT',
  contra: 'CONTRA',
  journal: 'JOURNAL',
  'debit-note': 'DEBIT_NOTE',
  'credit-note': 'CREDIT_NOTE',
  'sales-invoice': 'SALES_INVOICE',
  'purchase-invoice': 'PURCHASE_INVOICE',
  expenses: 'PAYMENT',
};

function inr(v: unknown) {
  const n = Number(v ?? 0);
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AccountsDesk() {
  const path = usePathname() ?? '';
  const parts = path.split('/').filter(Boolean);
  const idx = parts.indexOf('accounts');
  const section = parts[idx + 1] ?? 'dashboard';
  const ready = useAuthQueryEnabled();
  const roles = useAuthStore((s) => s.session?.user.roles) ?? [];
  const view = /principal/.test(roles.join(' '))
    ? 'principal'
    : /management|trust/.test(roles.join(' '))
      ? 'management'
      : 'accountant';
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const dash = useQuery({
    queryKey: ['acct-dash', view],
    queryFn: () => fetchAcctDashboard(view),
    enabled: ready,
  });
  const chart = useQuery({ queryKey: ['acct-chart'], queryFn: fetchAcctChart, enabled: ready });
  const vouchers = useQuery({
    queryKey: ['acct-vouchers', section],
    queryFn: () =>
      fetchAcctVouchers({
        type: TYPE_FROM_PATH[section],
      }),
    enabled: ready,
  });
  const trial = useQuery({
    queryKey: ['acct-tb'],
    queryFn: fetchAcctTrial,
    enabled: ready && ['trial-balance', 'day-book', 'cash-book', 'bank-book'].includes(section),
  });
  const statements = useQuery({
    queryKey: ['acct-st'],
    queryFn: fetchAcctStatements,
    enabled: ready && path.includes('statements'),
  });
  const banks = useQuery({
    queryKey: ['acct-banks'],
    queryFn: fetchAcctBanks,
    enabled: ready && section.includes('bank'),
  });
  const vendors = useQuery({
    queryKey: ['acct-vendors'],
    queryFn: fetchAcctVendors,
    enabled: ready && (section.includes('vendor') || path.includes('vendor')),
  });
  const periods = useQuery({
    queryKey: ['acct-periods'],
    queryFn: fetchAcctPeriods,
    enabled: ready && (section.includes('period') || section.includes('year')),
  });
  const audit = useQuery({
    queryKey: ['acct-audit'],
    queryFn: fetchAcctAudit,
    enabled: ready && section === 'audit',
  });
  const cashier = useQuery({
    queryKey: ['acct-cashier'],
    queryFn: () => fetchAcctCashier(),
    enabled: ready && section === 'cashier',
  });
  const assets = useQuery({
    queryKey: ['acct-assets'],
    queryFn: fetchAcctAssets,
    enabled: ready && (section === 'assets' || section === 'depreciation'),
  });
  const tax = useQuery({
    queryKey: ['acct-tax'],
    queryFn: fetchAcctTax,
    enabled: ready && path.includes('tax'),
  });
  const bva = useQuery({
    queryKey: ['acct-bva'],
    queryFn: fetchAcctBva,
    enabled: ready && path.includes('budget'),
  });
  const rules = useQuery({
    queryKey: ['acct-rules'],
    queryFn: fetchAcctRules,
    enabled: ready && path.includes('approval'),
  });
  const bootstrap = useQuery({
    queryKey: ['acct-boot'],
    queryFn: fetchAcctBootstrap,
    enabled: ready,
  });
  const costCentres = useQuery({
    queryKey: ['acct-cc'],
    queryFn: fetchAcctCostCentres,
    enabled: ready,
  });
  const accounts = chart.data ?? [];
  const leaf = accounts.filter((a) => !a.isGroup);
  const [accountId, setAccountId] = useState('');
  const ledger = useQuery({
    queryKey: ['acct-led', accountId],
    queryFn: () => fetchAcctLedger(accountId),
    enabled: ready && !!accountId && section === 'ledger',
  });
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    narration: '',
    amount: '',
    debitId: '',
    creditId: '',
    paymentMode: 'CASH',
    payerName: '',
  });
  const summary = (dash.data?.summary ?? {}) as Record<string, string | number>;
  const monthly = (dash.data?.monthly ?? []) as Array<{
    month: string;
    income: number;
    expense: number;
  }>;
  const pieIncome = monthly.map((m) => ({ name: m.month, value: m.income }));
  const invalidate = () => qc.invalidateQueries({ queryKey: ['acct'] });
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setNotice(ok);
      await qc.invalidateQueries({ queryKey: ['acct-dash'] });
      await qc.invalidateQueries({ queryKey: ['acct-vouchers'] });
      await qc.invalidateQueries({ queryKey: ['acct-tb'] });
      await invalidate();
    } catch (e) {
      setNotice(apiErrorMessage(e));
    }
  };

  const postSimple = useMutation({
    mutationFn: () =>
      createAcctVoucher({
        voucherType: TYPE_FROM_PATH[section] ?? 'JOURNAL',
        date: form.date,
        narration: form.narration || `${section} voucher`,
        paymentMode: form.paymentMode,
        payerName: form.payerName,
        autoPost: false,
        lines: [
          {
            accountId: form.debitId,
            debit: form.amount,
            credit: '0',
          },
          {
            accountId: form.creditId,
            debit: '0',
            credit: form.amount,
          },
        ],
      }),
    onSuccess: () => run(async () => undefined, 'Voucher saved as draft — submit for approval'),
  });

  const typeLabel = useMemo(() => section.replace(/-/g, ' '), [section]);

  return (
    <div className="space-y-4 bg-[#f4f7fb] p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Accounts &amp; Finance</h1>
          <p className="text-sm text-slate-500">
            Double-entry school books · FY{' '}
            {(bootstrap.data as { financialYear?: { code?: string } })?.financialYear?.code ?? '—'}{' '}
            · {view} view
          </p>
        </div>
        <div className="flex gap-2">
          <a href={acctExportUrl('trial-balance', 'pdf')} className="text-sm text-blue-700">
            PDF
          </a>
          <a href={acctExportUrl('trial-balance', 'xlsx')} className="text-sm text-blue-700">
            Excel
          </a>
        </div>
      </div>
      <nav className="flex flex-wrap gap-2">
        {LINKS.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              path === href
                ? 'border-blue-600 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-white',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      {notice ? <p className="rounded-lg border bg-white px-3 py-2 text-sm">{notice}</p> : null}

      {section === 'dashboard' || !parts[idx + 1] ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <WaCard label="Total Income" value={inr(summary.income)} />
            <WaCard label="Total Expenses" value={inr(summary.expenses)} />
            <WaCard label="Net Surplus" value={inr(summary.surplus)} />
            <WaCard label="Cash + Bank" value={inr(summary.available)} />
            <WaCard label="Cash in Hand" value={inr(summary.cash)} />
            <WaCard label="Bank Balance" value={inr(summary.bank)} />
            <WaCard label="Fee Receivable" value={inr(summary.feeReceivable)} />
            <WaCard label="Vendor Payables" value={inr(summary.vendorPayable)} />
          </div>
          {view !== 'accountant' ? (
            <WaCard className="p-4">
              <h2 className="font-semibold">Financial alerts</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-800">
                {((dash.data?.alerts as string[]) ?? ['No alerts']).map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </WaCard>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <WaCard className="h-72 p-3">
              <p className="mb-2 text-sm font-medium">Income vs expense</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="income" fill="#1d4ed8" />
                  <Bar dataKey="expense" fill="#b45309" />
                </BarChart>
              </ResponsiveContainer>
            </WaCard>
            <WaCard className="h-72 p-3">
              <p className="mb-2 text-sm font-medium">Cash-flow trend</p>
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="income" stroke="#047857" />
                  <Line dataKey="expense" stroke="#be123c" />
                </LineChart>
              </ResponsiveContainer>
            </WaCard>
            <WaCard className="h-72 p-3">
              <p className="mb-2 text-sm font-medium">Income by month</p>
              <ResponsiveContainer width="100%" height="90%">
                <PieChart>
                  <Pie data={pieIncome} dataKey="value" nameKey="name" outerRadius={80}>
                    {pieIncome.map((_, i) => (
                      <Cell key={i} fill={['#1d4ed8', '#0f766e', '#a16207', '#9f1239'][i % 4]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </WaCard>
            <WaCard className="p-3">
              <p className="mb-2 text-sm font-medium">Recent vouchers</p>
              <ul className="space-y-1 text-sm">
                {((dash.data?.recent as Array<Record<string, string>>) ?? []).map((v) => (
                  <li key={v.id} className="flex justify-between gap-2">
                    <span>
                      {v.voucherNo} · {v.voucherType}
                    </span>
                    <span>{inr(v.totalDebit)}</span>
                  </li>
                ))}
              </ul>
            </WaCard>
          </div>
        </>
      ) : null}

      {TYPE_FROM_PATH[section] ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <WaCard className="p-4 lg:col-span-1">
            <h2 className="mb-3 font-semibold capitalize">{typeLabel}</h2>
            <div className="space-y-2 text-sm">
              <input
                className="h-9 w-full rounded border px-2"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
              <input
                className="h-9 w-full rounded border px-2"
                placeholder="Amount"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
              <select
                className="h-9 w-full rounded border px-2"
                value={form.debitId}
                onChange={(e) => setForm({ ...form, debitId: e.target.value })}
              >
                <option value="">Debit account</option>
                {leaf.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {String(a.code)} {String(a.name)}
                  </option>
                ))}
              </select>
              <select
                className="h-9 w-full rounded border px-2"
                value={form.creditId}
                onChange={(e) => setForm({ ...form, creditId: e.target.value })}
              >
                <option value="">Credit account</option>
                {leaf.map((a) => (
                  <option key={String(a.id)} value={String(a.id)}>
                    {String(a.code)} {String(a.name)}
                  </option>
                ))}
              </select>
              <select
                className="h-9 w-full rounded border px-2"
                value={form.paymentMode}
                onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
              >
                {['CASH', 'UPI', 'BANK_TRANSFER', 'NEFT', 'CHEQUE', 'PAYMENT_GATEWAY'].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <input
                className="h-9 w-full rounded border px-2"
                placeholder="Payer / payee"
                value={form.payerName}
                onChange={(e) => setForm({ ...form, payerName: e.target.value })}
              />
              <textarea
                className="w-full rounded border px-2 py-1"
                placeholder="Narration"
                value={form.narration}
                onChange={(e) => setForm({ ...form, narration: e.target.value })}
              />
              <PrimaryButton onClick={() => postSimple.mutate()} disabled={postSimple.isPending}>
                Save voucher (balanced Dr/Cr)
              </PrimaryButton>
            </div>
          </WaCard>
          <WaCard className="overflow-auto p-0 lg:col-span-2">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs">
                <tr>
                  <th className="p-2">Voucher</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Narration</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Status</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {(vouchers.data ?? []).map((v) => (
                  <tr key={String(v.id)} className="border-t">
                    <td className="p-2 font-medium">{String(v.voucherNo)}</td>
                    <td className="p-2">{String(v.voucherDate).slice(0, 10)}</td>
                    <td className="p-2">{String(v.narration)}</td>
                    <td className="p-2">{inr(v.totalDebit)}</td>
                    <td className="p-2">{String(v.status)}</td>
                    <td className="p-2 text-right">
                      <GhostButton
                        onClick={() =>
                          run(() => acctVoucherAction(String(v.id), 'submit'), 'Submitted')
                        }
                      >
                        Submit
                      </GhostButton>
                      <GhostButton
                        onClick={() =>
                          run(() => acctVoucherAction(String(v.id), 'approve'), 'Approved')
                        }
                      >
                        Approve
                      </GhostButton>
                      <GhostButton
                        onClick={() => run(() => acctVoucherAction(String(v.id), 'post'), 'Posted')}
                      >
                        Post
                      </GhostButton>
                      <GhostButton
                        onClick={() =>
                          run(() => acctVoucherAction(String(v.id), 'reverse'), 'Reversed')
                        }
                      >
                        Reverse
                      </GhostButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </WaCard>
        </div>
      ) : null}

      {section === 'chart' ? (
        <WaCard className="overflow-auto p-0">
          <div className="flex justify-end p-3">
            <GhostButton
              onClick={() =>
                run(
                  () =>
                    saveAcctAccount({
                      code: `9${Date.now().toString().slice(-4)}`,
                      name: 'New account',
                      type: 'EXPENSE',
                    }),
                  'Account created — edit the name/code in the grid after reload',
                )
              }
            >
              Add account
            </GhostButton>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs">
              <tr>
                <th className="p-2">Code</th>
                <th className="p-2">Name</th>
                <th className="p-2">Type</th>
                <th className="p-2">Module</th>
                <th className="p-2">System</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={String(a.id)} className="border-t">
                  <td className="p-2">{String(a.code)}</td>
                  <td className="p-2">{String(a.name)}</td>
                  <td className="p-2">{String(a.type)}</td>
                  <td className="p-2">{String(a.moduleKey ?? '—')}</td>
                  <td className="p-2">{a.isSystem ? 'Yes' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </WaCard>
      ) : null}

      {section === 'ledger' || section === 'sub-ledgers' ? (
        <WaCard className="p-4">
          <select
            className="mb-3 h-9 rounded border px-2 text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            <option value="">Select account</option>
            {leaf.map((a) => (
              <option key={String(a.id)} value={String(a.id)}>
                {String(a.code)} {String(a.name)}
              </option>
            ))}
          </select>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="p-2">Date</th>
                <th className="p-2">Voucher</th>
                <th className="p-2">Particulars</th>
                <th className="p-2">Debit</th>
                <th className="p-2">Credit</th>
                <th className="p-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {((ledger.data?.rows as Array<Record<string, unknown>>) ?? []).map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{String(r.date).slice(0, 10)}</td>
                  <td className="p-2">{String(r.voucherNo)}</td>
                  <td className="p-2">{String(r.particulars ?? '')}</td>
                  <td className="p-2">{inr(r.debit)}</td>
                  <td className="p-2">{inr(r.credit)}</td>
                  <td className="p-2">{inr(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </WaCard>
      ) : null}

      {section === 'trial-balance' ||
      section === 'day-book' ||
      section === 'cash-book' ||
      section === 'bank-book' ? (
        <WaCard className="overflow-auto p-0">
          <div className="flex gap-2 p-3 text-sm">
            <a className="text-blue-700" href={acctExportUrl('trial-balance', 'pdf')}>
              PDF
            </a>
            <a className="text-blue-700" href={acctExportUrl('day-book', 'xlsx')}>
              Excel
            </a>
            <a className="text-blue-700" href={acctExportUrl('day-book', 'csv')}>
              CSV
            </a>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs">
              <tr>
                <th className="p-2">Code</th>
                <th className="p-2">Account</th>
                <th className="p-2">Debit</th>
                <th className="p-2">Credit</th>
              </tr>
            </thead>
            <tbody>
              {(trial.data?.rows ?? []).map((r) => (
                <tr key={String(r.id)} className="border-t">
                  <td className="p-2">{String(r.code)}</td>
                  <td className="p-2">{String(r.name)}</td>
                  <td className="p-2">{inr(r.debit)}</td>
                  <td className="p-2">{inr(r.credit)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="p-2" colSpan={2}>
                  Total (must match)
                </td>
                <td className="p-2">{inr(trial.data?.totals.debit)}</td>
                <td className="p-2">{inr(trial.data?.totals.credit)}</td>
              </tr>
            </tfoot>
          </table>
        </WaCard>
      ) : null}

      {path.includes('statements') ? (
        <WaCard className="p-4 text-sm">
          <pre className="overflow-auto rounded bg-slate-50 p-3 text-xs">
            {JSON.stringify(statements.data, null, 2)}
          </pre>
        </WaCard>
      ) : null}

      {section === 'banks' || section === 'reconciliation' || section === 'cheques' ? (
        <WaCard className="p-4">
          <GhostButton
            onClick={() =>
              run(
                () =>
                  saveAcctBank({
                    name: 'SBI School Account',
                    bankName: 'SBI',
                    accountNumber: '0000000000',
                    ifsc: 'SBIN0000000',
                  }),
                'Bank added (number masked in list)',
              )
            }
          >
            Add bank
          </GhostButton>
          <ul className="mt-3 space-y-2 text-sm">
            {(banks.data ?? []).map((b) => (
              <li key={String(b.id)}>
                {String(b.name)} · {String(b.bankName)} · {String(b.accountNumber)}
              </li>
            ))}
          </ul>
        </WaCard>
      ) : null}

      {section === 'vendors' || path.includes('vendor-bills') ? (
        <WaCard className="p-4">
          <GhostButton
            onClick={() => run(() => saveAcctVendor({ name: 'New vendor' }), 'Vendor created')}
          >
            Add vendor
          </GhostButton>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-slate-500">
                <th className="p-2">Vendor</th>
                <th className="p-2">Purchases</th>
                <th className="p-2">Paid</th>
                <th className="p-2">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {(vendors.data ?? []).map((v) => {
                const t = (v.totals ?? {}) as Record<string, string>;
                return (
                  <tr key={String(v.id)} className="border-t">
                    <td className="p-2">{String(v.name)}</td>
                    <td className="p-2">{inr(t.purchases)}</td>
                    <td className="p-2">{inr(t.paid)}</td>
                    <td className="p-2">{inr(t.outstanding)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </WaCard>
      ) : null}

      {path.includes('budget') ? (
        <WaCard className="p-4">
          <GhostButton
            onClick={() =>
              run(
                () =>
                  saveAcctBudget({
                    name: 'Annual budget',
                    lines: leaf.slice(0, 3).map((a) => ({
                      accountId: String(a.id),
                      amount: '100000',
                    })),
                  }),
                'Budget saved',
              )
            }
          >
            Create budget
          </GhostButton>
          <ul className="mt-3 text-sm">
            {(bva.data ?? []).map((r, i) => (
              <li key={i} className={r.warning ? 'text-amber-800' : ''}>
                {String(r.budget)} utilised {String(r.utilised)}%
              </li>
            ))}
          </ul>
        </WaCard>
      ) : null}

      {section === 'assets' || section === 'depreciation' ? (
        <WaCard className="p-4">
          <div className="flex gap-2">
            <GhostButton
              onClick={() =>
                run(
                  () =>
                    saveAcctAsset({
                      name: 'Classroom furniture',
                      category: 'Furniture',
                      purchaseDate: new Date().toISOString().slice(0, 10),
                      purchaseValue: '25000',
                      usefulLifeMonths: 60,
                    }),
                  'Asset added',
                )
              }
            >
              Add asset
            </GhostButton>
            <GhostButton
              onClick={() =>
                run(
                  () => runAcctDepreciation(new Date().toISOString().slice(0, 7)),
                  'Depreciation posted',
                )
              }
            >
              Run depreciation
            </GhostButton>
          </div>
          <ul className="mt-3 text-sm">
            {(assets.data ?? []).map((a) => (
              <li key={String(a.id)}>
                {String(a.assetCode)} {String(a.name)} · {inr(a.currentValue)}
              </li>
            ))}
          </ul>
        </WaCard>
      ) : null}

      {path.includes('/tax') ? (
        <WaCard className="p-4">
          <p className="mb-2 text-sm text-slate-600">
            Tax rates, section references and effective dates are configurable. Nothing is
            hard-coded to a repealed Income-tax section.
          </p>
          <GhostButton
            onClick={() =>
              run(
                () =>
                  saveAcctTax({
                    taxKind: path.includes('gst') ? 'GST' : 'TDS',
                    name: path.includes('gst') ? 'GST (configure rate)' : 'TDS (configure rate)',
                    lawRef: 'Income Tax Act, 2025',
                    sectionRef: 'As notified',
                    rateBps: 0,
                    effectiveFrom: '2026-04-01',
                  }),
                'Tax configuration saved',
              )
            }
          >
            Add tax configuration
          </GhostButton>
          <ul className="mt-3 text-sm">
            {(tax.data ?? []).map((t) => (
              <li key={String(t.id)}>
                {String(t.taxKind)} {String(t.name)} · {String(t.sectionRef)} · from{' '}
                {String(t.effectiveFrom).slice(0, 10)}
              </li>
            ))}
          </ul>
        </WaCard>
      ) : null}

      {section === 'cashier' ? (
        <WaCard className="p-4">
          {(cashier.data ?? []).map((row) => (
            <div key={row.userId} className="mb-3 rounded border p-3 text-sm">
              <p className="font-medium">{row.userId}</p>
              {Object.entries(row.totals).map(([k, v]) => (
                <p key={k}>
                  {k}: {inr(v)}
                </p>
              ))}
            </div>
          ))}
          <GhostButton
            onClick={() =>
              run(
                () =>
                  closeAcctCash({
                    closeDate: new Date().toISOString().slice(0, 10),
                    actualCash: '0',
                  }),
                'Day-end cash recorded',
              )
            }
          >
            Record day-end cash
          </GhostButton>
        </WaCard>
      ) : null}

      {section === 'periods' ||
      section === 'period-lock' ||
      section === 'financial-year' ||
      section === 'year-end' ? (
        <WaCard className="p-4">
          <ul className="text-sm">
            {(periods.data ?? []).map((p) => (
              <li key={String(p.id)} className="flex items-center justify-between border-b py-2">
                <span>
                  {String(p.name)} {String(p.status) === 'CLOSED' ? '🔒 CLOSED' : 'OPEN'}
                </span>
                {p.status !== 'CLOSED' ? (
                  <GhostButton
                    onClick={() => run(() => lockAcctPeriod(String(p.id)), `${p.name} locked`)}
                  >
                    Lock
                  </GhostButton>
                ) : null}
              </li>
            ))}
          </ul>
          {section === 'year-end' ? (
            <PrimaryButton
              className="mt-3"
              onClick={() => run(() => runAcctYearEnd(), 'Financial year closed')}
            >
              Close financial year
            </PrimaryButton>
          ) : null}
        </WaCard>
      ) : null}

      {section === 'audit' || path.includes('approvals') ? (
        <WaCard className="overflow-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Action</th>
                <th className="p-2">Actor</th>
              </tr>
            </thead>
            <tbody>
              {(audit.data ?? []).map((a) => (
                <tr key={String(a.id)} className="border-t">
                  <td className="p-2">{String(a.createdAt)}</td>
                  <td className="p-2">{String(a.action)}</td>
                  <td className="p-2">{String(a.actorId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {path.includes('approval-rules') ? (
            <div className="p-3">
              <GhostButton
                onClick={() =>
                  run(
                    () =>
                      saveAcctRule({
                        minAmount: '0',
                        maxAmount: '5000',
                        approverRole: 'accountant',
                      }),
                    'Rule saved',
                  )
                }
              >
                Add approval rule
              </GhostButton>
              <ul className="mt-2 text-sm">
                {(rules.data ?? []).map((r) => (
                  <li key={String(r.id)}>
                    {String(r.minAmount)}–{String(r.maxAmount ?? '∞')} → {String(r.approverRole)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </WaCard>
      ) : null}

      {section === 'cost-centres' ? (
        <WaCard className="p-4">
          <ul className="text-sm">
            {(costCentres.data ?? []).map((c) => (
              <li key={String(c.id)}>
                {String(c.code)} · {String(c.name)}
              </li>
            ))}
          </ul>
        </WaCard>
      ) : null}

      {path.includes('income/') ? (
        <WaCard className="p-4 text-sm text-slate-600">
          Income ledgers are posted automatically from Fees, Transport, Stationery and donations.
          Use Receipt or Journal only for amounts that did not originate in another module.
        </WaCard>
      ) : null}
    </div>
  );
}
