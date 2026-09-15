'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileSpreadsheet,
  IndianRupee,
  Info,
  Printer,
  RotateCcw,
  Search,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { studentInitials } from '@/lib/school-sis/student-profile';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/utils/api-error';
import {
  downloadMonthlyFeeRegisterXlsx,
  fetchMonthlyFeeConfig,
  fetchMonthlyFeeRegister,
  voidMonthlyFee,
} from '@/services/school-sis';
import { MonthlyFeeSubnav, currentFeeMonth, rs } from './monthly-fee-ui';

const AVATAR = [
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
];

function avatarTone(name: string) {
  let n = 0;
  for (const ch of name) n += ch.charCodeAt(0);
  return AVATAR[n % AVATAR.length];
}

const PAGE_SIZES = [10, 15, 25, 50];
const MODES = ['CASH', 'UPI', 'BANK', 'CHEQUE', 'ONLINE', 'OTHER'];

const MODE_TONE: Record<string, string> = {
  CASH: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  UPI: 'bg-sky-50 text-sky-700 ring-sky-100',
  BANK: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  CHEQUE: 'bg-amber-50 text-amber-800 ring-amber-100',
  ONLINE: 'bg-violet-50 text-violet-700 ring-violet-100',
  OTHER: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function MonthlyFeeRegister() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const qc = useQueryClient();
  const [month, setMonth] = useState(currentFeeMonth());
  const [status, setStatus] = useState('');
  const [mode, setMode] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [draftQ, setDraftQ] = useState('');
  const [tableQ, setTableQ] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'paidAt' | 'total'>('paidAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const generatedAt = useMemo(
    () =>
      new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [],
  );

  const config = useQuery({
    queryKey: ['monthly-fee-config'],
    queryFn: fetchMonthlyFeeConfig,
    enabled,
  });
  const params = {
    month: month || undefined,
    status: status || undefined,
    paymentMode: mode || undefined,
    gradeId: gradeId || undefined,
    from: from || undefined,
    to: to || undefined,
    q: q || undefined,
  };
  const query = useQuery({
    queryKey: ['monthly-fee-register', params],
    queryFn: () => fetchMonthlyFeeRegister(params),
    enabled,
  });

  const monthOptions = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 18 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return {
        value,
        label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      };
    });
  }, []);

  const rows = useMemo(() => {
    const needle = tableQ.trim().toLowerCase();
    let list = query.data?.rows ?? [];
    if (needle) {
      list = list.filter((row) =>
        [row.student.fullName, row.student.admissionNumber, row.receiptNumber, row.className]
          .join(' ')
          .toLowerCase()
          .includes(needle),
      );
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'name') return dir * a.student.fullName.localeCompare(b.student.fullName);
      if (sortKey === 'total') return dir * (a.totalAmount - b.totalAmount);
      return dir * (new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());
    });
  }, [query.data?.rows, sortDir, sortKey, tableQ]);

  const paidRows = rows.filter((r) => r.status === 'PAID');
  const totalAmount = paidRows.reduce((s, r) => s + r.totalAmount, 0);
  const totalLate = paidRows.reduce((s, r) => s + r.lateFeeAmount, 0);
  const modeCounts = paidRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.paymentMode] = (acc[r.paymentMode] ?? 0) + 1;
    return acc;
  }, {});
  const modeKeys = Object.keys(modeCounts);
  const cashCount = modeCounts.CASH ?? 0;

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pages);
  const paged = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allVisibleSelected = paged.length > 0 && paged.every((row) => selected.includes(row.id));
  const monthLabel =
    monthOptions.find((m) => m.value === month)?.label ?? month ?? 'selected period';

  function applySearch() {
    setQ(draftQ);
    setPage(1);
  }

  function resetFilters() {
    setMonth(currentFeeMonth());
    setStatus('');
    setMode('');
    setGradeId('');
    setFrom('');
    setTo('');
    setDraftQ('');
    setQ('');
    setTableQ('');
    setPage(1);
    setSelected([]);
  }

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'paidAt' ? 'desc' : 'asc');
    }
  }

  return (
    <div className="-mx-1 space-y-4 rounded-[28px] bg-[#f4f7fb] p-3 sm:p-4">
      <MonthlyFeeSubnav />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#2563eb]">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Monthly Collection Register
            </h1>
            <p className="text-sm text-slate-500">
              View and manage all fee collection records for the selected period.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100 hover:bg-emerald-100"
            onClick={() =>
              downloadMonthlyFeeRegisterXlsx(params).catch((err) => setError(apiErrorMessage(err)))
            }
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export Excel
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Users}
          label="Total Collections"
          value={String(paidRows.length)}
          hint="Total receipts in this period"
          tone="blue"
        />
        <SummaryCard
          icon={IndianRupee}
          label="Total Amount Collected"
          value={rs(totalAmount)}
          hint={monthLabel}
          tone="green"
        />
        <SummaryCard
          icon={ClipboardList}
          label="Total Late Fee"
          value={rs(totalLate)}
          hint="Charged in this period"
          tone="rose"
        />
        <SummaryCard
          icon={Wallet}
          label="Payment Modes"
          value={String(modeKeys.length)}
          hint={modeKeys.length ? `(Cash: ${cashCount})` : 'No receipts yet'}
          tone="violet"
        />
      </div>

      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 print:hidden">
        <div className="flex flex-wrap items-end gap-2">
          <FilterSelect
            label="Academic Year"
            value="current"
            onChange={() => undefined}
            options={[
              {
                value: 'current',
                label: query.data?.academicYear.name || config.data?.academicYear.name || '—',
              },
            ]}
          />
          <label className="min-w-[10rem] text-xs font-medium text-slate-500">
            Month
            <span className="relative mt-1 block">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All months</option>
                {monthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <FilterSelect
            label="Class"
            value={gradeId || 'all'}
            onChange={(v) => {
              setGradeId(v === 'all' ? '' : v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All classes' },
              ...(config.data?.plans ?? []).map((p) => ({
                value: p.gradeId,
                label: p.grade.name,
              })),
            ]}
          />
          <FilterSelect
            label="Status"
            value={status || 'all'}
            onChange={(v) => {
              setStatus(v === 'all' ? '' : v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All status' },
              { value: 'PAID', label: 'Paid' },
              { value: 'VOIDED', label: 'Voided' },
            ]}
          />
          <FilterSelect
            label="Mode of Payment"
            value={mode || 'all'}
            onChange={(v) => {
              setMode(v === 'all' ? '' : v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All modes' },
              ...MODES.map((m) => ({ value: m, label: m })),
            ]}
          />
          <label className="min-w-[9rem] text-xs font-medium text-slate-500">
            From Date
            <input
              type="date"
              className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="min-w-[9rem] text-xs font-medium text-slate-500">
            To Date
            <input
              type="date"
              className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-3 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className="min-w-[14rem] flex-1 text-xs font-medium text-slate-500">
            Search
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#2563eb]"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                placeholder="Student, admission or receipt no..."
              />
            </span>
          </label>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#2563eb] px-4 text-sm font-semibold text-white"
            onClick={applySearch}
          >
            <Search className="h-4 w-4" />
            Search
          </button>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
            onClick={resetFilters}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              Collection Records ({month ? monthLabel : 'All months'})
            </h2>
            <p className="text-xs text-slate-500">
              Showing {rows.length ? (safePage - 1) * pageSize + 1 : 0}–
              {Math.min(safePage * pageSize, rows.length)} of {rows.length} records
            </p>
          </div>
          <label className="relative print:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-72 max-w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-[#2563eb]"
              value={tableQ}
              onChange={(e) => {
                setTableQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, admission no., receipt no..."
            />
          </label>
        </div>

        {query.isLoading ? <p className="p-6 text-sm text-slate-500">Loading register…</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-3 print:hidden">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      const ids = paged.map((r) => r.id);
                      setSelected((cur) =>
                        e.target.checked
                          ? [...new Set([...cur, ...ids])]
                          : cur.filter((id) => !ids.includes(id)),
                      );
                    }}
                  />
                </th>
                <th className="px-2 py-3">#</th>
                <th className="px-2 py-3">
                  <SortBtn
                    active={sortKey === 'name'}
                    dir={sortDir}
                    onClick={() => toggleSort('name')}
                  >
                    Student name
                  </SortBtn>
                </th>
                <th className="px-2 py-3">Class</th>
                <th className="px-2 py-3">Month</th>
                <th className="px-2 py-3 text-right">Amount</th>
                <th className="px-2 py-3 text-right">Late fee</th>
                <th className="px-2 py-3 text-right">
                  <SortBtn
                    active={sortKey === 'total'}
                    dir={sortDir}
                    onClick={() => toggleSort('total')}
                  >
                    Total
                  </SortBtn>
                </th>
                <th className="px-2 py-3">Mode</th>
                <th className="px-2 py-3">Receipt no.</th>
                <th className="px-2 py-3">
                  <SortBtn
                    active={sortKey === 'paidAt'}
                    dir={sortDir}
                    onClick={() => toggleSort('paidAt')}
                  >
                    Date & time
                  </SortBtn>
                </th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3 text-right print:hidden">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((row, index) => {
                const n = (safePage - 1) * pageSize + index + 1;
                return (
                  <tr key={row.id} className="border-t border-slate-50 hover:bg-slate-50/80">
                    <td className="px-3 py-3 print:hidden">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.id)}
                        onChange={(e) =>
                          setSelected((cur) =>
                            e.target.checked ? [...cur, row.id] : cur.filter((id) => id !== row.id),
                          )
                        }
                      />
                    </td>
                    <td className="px-2 py-3 text-slate-400">{n}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            avatarTone(row.student.fullName),
                          )}
                        >
                          {studentInitials(row.student.fullName)}
                        </span>
                        <span>
                          <span className="block font-semibold text-slate-800">
                            {row.student.fullName}
                          </span>
                          <span className="text-xs text-slate-400">
                            {row.student.admissionNumber}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-slate-600">
                      {row.className} {row.sectionName}
                    </td>
                    <td className="px-2 py-3 text-slate-600">{row.monthLabel}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{rs(row.tuitionAmount)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{rs(row.lateFeeAmount)}</td>
                    <td className="px-2 py-3 text-right font-bold tabular-nums text-slate-900">
                      {rs(row.totalAmount)}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
                          MODE_TONE[row.paymentMode] ?? MODE_TONE.OTHER,
                        )}
                      >
                        {row.paymentMode}
                      </span>
                    </td>
                    <td className="px-2 py-3 font-mono text-xs text-slate-600">
                      {row.receiptNumber}
                    </td>
                    <td className="px-2 py-3 text-slate-600">
                      {new Date(row.paidAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                          row.status === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                            : 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-2 py-3 print:hidden">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          className="inline-flex items-center gap-1 text-sm font-semibold text-[#2563eb]"
                          href={`/admin/school-sis/fees/receipts/${row.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                        {canManage && row.status === 'PAID' ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600"
                            onClick={() => {
                              const reason = window.prompt('Void reason (audit trail required)');
                              if (!reason) return;
                              void voidMonthlyFee(row.id, reason)
                                .then(() => {
                                  setError(null);
                                  void qc.invalidateQueries({ queryKey: ['monthly-fee-register'] });
                                })
                                .catch((err) => setError(apiErrorMessage(err)));
                            }}
                          >
                            Void
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!query.isLoading && !rows.length ? (
          <p className="p-8 text-center text-sm text-slate-500">No payments match these filters.</p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 print:hidden">
          <label className="inline-flex items-center gap-2">
            Show
            <select
              className="h-8 rounded-lg border border-slate-200 px-2"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            entries
          </label>
          <div className="flex items-center gap-1">
            <PageBtn disabled={safePage <= 1} onClick={() => setPage(1)}>
              «
            </PageBtn>
            <PageBtn disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </PageBtn>
            {pageWindow(safePage, pages).map((n) => (
              <PageBtn key={n} active={n === safePage} onClick={() => setPage(n)}>
                {n}
              </PageBtn>
            ))}
            <PageBtn
              disabled={safePage >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </PageBtn>
            <PageBtn disabled={safePage >= pages} onClick={() => setPage(pages)}>
              »
            </PageBtn>
            <span className="ml-2 text-xs">
              Showing {rows.length ? (safePage - 1) * pageSize + 1 : 0}-
              {Math.min(safePage * pageSize, rows.length)} of {rows.length}
            </span>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#eef6ff] px-4 py-3 text-sm text-slate-600 ring-1 ring-sky-100">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" />
          This report shows all fee collections for the selected period. You can filter by class,
          status, payment mode or date range.
        </p>
        <p className="text-xs text-slate-400">Generated on {generatedAt}</p>
      </div>
    </div>
  );
}

function pageWindow(current: number, pages: number) {
  const start = Math.max(1, current - 2);
  const end = Math.min(pages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
  tone: 'blue' | 'green' | 'rose' | 'violet';
}) {
  const tones = {
    blue: 'bg-[#eef4ff] text-[#2563eb]',
    green: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  const wrap = {
    blue: 'bg-[#eef4ff]/80',
    green: 'bg-emerald-50/80',
    rose: 'bg-rose-50/80',
    violet: 'bg-violet-50/80',
  };
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-3xl p-4 shadow-sm ring-1 ring-slate-100',
        wrap[tone],
      )}
    >
      <span
        className={cn(
          'inline-flex h-12 w-12 items-center justify-center rounded-full',
          tones[tone],
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        <p className="text-xs text-slate-400">{hint}</p>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="min-w-[9rem] text-xs font-medium text-slate-500">
      {label}
      <select
        className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-800"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortBtn({
  active,
  dir,
  onClick,
  children,
}: {
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" className="inline-flex items-center gap-1 uppercase" onClick={onClick}>
      {children}
      <span className={cn('text-[10px]', active ? 'text-slate-700' : 'text-slate-300')}>
        {active && dir === 'desc' ? '↓' : '↑'}
      </span>
    </button>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm',
        active ? 'bg-[#2563eb] font-semibold text-white' : 'text-slate-600 hover:bg-slate-100',
        disabled && 'opacity-40',
      )}
    >
      {children}
    </button>
  );
}
