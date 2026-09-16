'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  CalendarDays,
  CreditCard,
  Eye,
  FileBarChart2,
  FileSpreadsheet,
  IndianRupee,
  Info,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/utils/api-error';
import {
  closeSchoolFeeCashCounter,
  fetchUserWiseCollection,
  fetchUserWiseReceipts,
  reopenSchoolFeeCashCounter,
} from '@/services/school-sis';
import { downloadUserWiseReport, kindToSchoolReportExport } from '@/services/school-reports';
import { ReportExportButtons } from '../reports/export-buttons';
import { MonthlyFeeSubnav, rs } from './monthly-fee-ui';

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function todayIst() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function prettyDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const ROLE_TONE: Record<string, string> = {
  Admin: 'bg-blue-50 text-blue-700 ring-blue-100',
  Accountant: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  Cashier: 'bg-violet-50 text-violet-700 ring-violet-100',
};

type SortKey =
  | 'userName'
  | 'cashCollection'
  | 'totalCollection'
  | 'receiptCount'
  | 'firstCollectionTime'
  | 'lastCollectionTime';

export function MonthlyFeeUserReport() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIst);
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [userId, setUserId] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('totalCollection');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [applied, setApplied] = useState({
    date: todayIst(),
    academicYearId: '',
    classId: '',
    sectionId: '',
    paymentMode: '',
    userId: '',
  });
  const [detailUser, setDetailUser] = useState<{ id: string; name: string; role: string } | null>(
    null,
  );
  const [closeUser, setCloseUser] = useState<{
    id: string;
    name: string;
    cash: number;
  } | null>(null);
  const [openingCash, setOpeningCash] = useState('0');
  const [actualCash, setActualCash] = useState('');
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      date: applied.date,
      academicYearId: applied.academicYearId || undefined,
      classId: applied.classId || undefined,
      sectionId: applied.sectionId || undefined,
      paymentMode: applied.paymentMode || undefined,
      userId: applied.userId || undefined,
      search: search.trim() || undefined,
      sortBy,
      sortOrder,
      page: 1,
      limit: 100,
    }),
    [applied, search, sortBy, sortOrder],
  );

  const report = useQuery({
    queryKey: ['school-sis', 'user-wise-collection', params],
    queryFn: () => fetchUserWiseCollection(params),
    enabled,
  });

  const details = useQuery({
    queryKey: ['school-sis', 'user-wise-receipts', detailUser?.id, applied],
    queryFn: () =>
      fetchUserWiseReceipts(detailUser!.id, {
        date: applied.date,
        academicYearId: applied.academicYearId || undefined,
        classId: applied.classId || undefined,
        sectionId: applied.sectionId || undefined,
        paymentMode: applied.paymentMode || undefined,
        page: 1,
        limit: 100,
      }),
    enabled: enabled && Boolean(detailUser),
  });

  const closeMut = useMutation({
    mutationFn: closeSchoolFeeCashCounter,
    onSuccess: () => {
      setCloseUser(null);
      setActualCash('');
      void qc.invalidateQueries({ queryKey: ['school-sis', 'user-wise-collection'] });
    },
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const reopenMut = useMutation({
    mutationFn: (id: string) => reopenSchoolFeeCashCounter(id, applied.date),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['school-sis', 'user-wise-collection'] }),
    onError: (err) => setError(apiErrorMessage(err)),
  });

  const data = report.data;
  const filters = data?.filters;
  const sections = (filters?.sections ?? []).filter((s) => !classId || s.gradeId === classId);
  const generated = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  function generate() {
    setApplied({
      date,
      academicYearId,
      classId,
      sectionId,
      paymentMode,
      userId,
    });
  }

  function reset() {
    const today = todayIst();
    setDate(today);
    setAcademicYearId('');
    setClassId('');
    setSectionId('');
    setPaymentMode('');
    setUserId('');
    setSearch('');
    setApplied({
      date: today,
      academicYearId: '',
      classId: '',
      sectionId: '',
      paymentMode: '',
      userId: '',
    });
  }

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortOrder((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortOrder(key === 'userName' || key === 'firstCollectionTime' ? 'asc' : 'desc');
    }
  }

  const expectedClose = closeUser
    ? Math.round((Number(openingCash || 0) + closeUser.cash) * 100) / 100
    : 0;
  const actualNum = Number(actualCash || 0);
  const difference = Math.round((actualNum - expectedClose) * 100) / 100;
  const recon = difference === 0 ? 'BALANCED' : difference < 0 ? 'SHORT' : 'EXCESS';

  return (
    <div className="-mx-1 space-y-4 rounded-[28px] bg-[#f4f7fb] p-3 sm:p-4">
      <MonthlyFeeSubnav />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#2563eb]">
            <FileBarChart2 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              User Wise Collection Report
            </h1>
            <p className="text-sm text-slate-500">
              View collection summary for each user and reconcile daily cash collections.
            </p>
            <p className="mt-1 text-xs text-slate-400 print:block">
              Reports <span className="text-slate-300">›</span> User Wise Collection
            </p>
          </div>
        </div>
        <ReportExportButtons
          onExport={async (kind) => {
            await downloadUserWiseReport(
              {
                date: applied.date,
                academicYearId: applied.academicYearId || undefined,
                classId: applied.classId || undefined,
                sectionId: applied.sectionId || undefined,
                paymentMode: applied.paymentMode || undefined,
                userId: applied.userId || undefined,
                search: search.trim() || undefined,
                sortBy,
                sortOrder,
              },
              kindToSchoolReportExport(kind).format,
              kindToSchoolReportExport(kind).orientation,
            );
          }}
        />
      </div>

      <section className="hidden print:block rounded-2xl bg-white p-4 text-sm">
        <p className="font-semibold">{filters?.schoolName || 'School ERP'}</p>
        <p>User Wise Collection Report — {prettyDate(applied.date)}</p>
        <p>
          Academic Year: {filters?.academicYear.name}
          {applied.paymentMode ? ` · Mode: ${applied.paymentMode}` : ''}
        </p>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100 print:hidden">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[10rem] text-xs font-medium text-slate-500">
            Date
            <span className="relative mt-1 block">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-800"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </span>
          </label>
          <FilterSelect
            label="Academic Year"
            value={academicYearId}
            onChange={setAcademicYearId}
            options={[
              { value: '', label: filters?.academicYear.name || 'Current year' },
              ...(filters?.years ?? [])
                .filter((y) => y.id !== filters?.academicYear.id)
                .map((y) => ({ value: y.id, label: y.name })),
            ]}
          />
          <FilterSelect
            label="Class"
            value={classId}
            onChange={(v) => {
              setClassId(v);
              setSectionId('');
            }}
            options={[
              { value: '', label: 'All classes' },
              ...(filters?.grades ?? []).map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
          <FilterSelect
            label="Section"
            value={sectionId}
            onChange={setSectionId}
            options={[
              { value: '', label: 'All sections' },
              ...sections.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <FilterSelect
            label="Payment Mode"
            value={paymentMode}
            onChange={setPaymentMode}
            options={[
              { value: '', label: 'All modes' },
              ...(filters?.paymentModes ?? ['CASH', 'UPI', 'BANK', 'ONLINE']).map((m) => ({
                value: m,
                label: m === 'CASH' ? 'Cash' : m.replace('_', ' '),
              })),
            ]}
          />
          <FilterSelect
            label="User"
            value={userId}
            onChange={setUserId}
            options={[
              { value: '', label: data?.canViewAll ? 'All users' : 'My collections' },
              ...(filters?.collectors ?? []).map((u) => ({
                value: u.userId,
                label: u.userName,
              })),
            ]}
          />
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[#1e3a8a] px-4 text-sm font-semibold text-white hover:bg-[#172b66]"
            onClick={generate}
          >
            <Search className="h-4 w-4" />
            Generate Report
          </button>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={reset}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={IndianRupee}
          label="Total Collection"
          value={rs(data?.summary.totalCollection ?? 0)}
          hint={`All users (${prettyDate(applied.date)})`}
          tone="blue"
        />
        <SummaryCard
          icon={Wallet}
          label="Total Cash Collected"
          value={rs(data?.summary.totalCash ?? 0)}
          hint={`(${data?.summary.cashPercent ?? 0}% of total)`}
          tone="green"
        />
        <SummaryCard
          icon={CreditCard}
          label="Total Online Collected"
          value={rs(data?.summary.totalOnline ?? 0)}
          hint={`(${data?.summary.onlinePercent ?? 0}% of total)`}
          tone="sky"
        />
        <SummaryCard
          icon={Users}
          label="Total Transactions"
          value={String(data?.summary.totalTransactions ?? 0)}
          hint={`By ${data?.summary.userCount ?? 0} users`}
          tone="violet"
        />
      </div>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">User Wise Collection Details</h2>
            <p className="text-sm text-slate-500">
              Collection report for {prettyDate(applied.date)}
            </p>
          </div>
          <label className="relative print:hidden">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-10 w-64 rounded-full border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm"
              placeholder="Search by user name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {report.isLoading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-500">Loading collections…</p>
        ) : !data?.users.length ? (
          <div className="px-6 py-16 text-center">
            <Receipt className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-lg font-semibold text-slate-800">No collections found</p>
            <p className="mt-1 text-sm text-slate-500">
              No fee payments were recorded for the selected date and filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">
                    <SortBtn
                      active={sortBy === 'userName'}
                      dir={sortOrder}
                      onClick={() => toggleSort('userName')}
                    >
                      User Name
                    </SortBtn>
                  </th>
                  <th className="px-3 py-3">Role</th>
                  <th className="px-3 py-3 text-right text-emerald-700">
                    <SortBtn
                      active={sortBy === 'cashCollection'}
                      dir={sortOrder}
                      onClick={() => toggleSort('cashCollection')}
                    >
                      Cash Collection
                    </SortBtn>
                  </th>
                  <th className="px-3 py-3 text-right">Online Collection</th>
                  <th className="px-3 py-3 text-right">
                    <SortBtn
                      active={sortBy === 'totalCollection'}
                      dir={sortOrder}
                      onClick={() => toggleSort('totalCollection')}
                    >
                      Total Collection
                    </SortBtn>
                  </th>
                  <th className="px-3 py-3 text-right">
                    <SortBtn
                      active={sortBy === 'receiptCount'}
                      dir={sortOrder}
                      onClick={() => toggleSort('receiptCount')}
                    >
                      No. of Receipts
                    </SortBtn>
                  </th>
                  <th className="px-3 py-3">
                    <SortBtn
                      active={sortBy === 'firstCollectionTime'}
                      dir={sortOrder}
                      onClick={() => toggleSort('firstCollectionTime')}
                    >
                      First
                    </SortBtn>
                  </th>
                  <th className="px-3 py-3">
                    <SortBtn
                      active={sortBy === 'lastCollectionTime'}
                      dir={sortOrder}
                      onClick={() => toggleSort('lastCollectionTime')}
                    >
                      Last Collection Time
                    </SortBtn>
                  </th>
                  <th className="px-2 py-3 text-right print:hidden">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((row, i) => (
                  <tr key={row.userId ?? `u-${i}`} className="border-t border-slate-100">
                    <td className="px-3 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
                            avatarTone(row.userName),
                          )}
                        >
                          {initials(row.userName)}
                        </span>
                        <span className="font-medium text-slate-900">{row.userName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium ring-1',
                          ROLE_TONE[row.role] ?? 'bg-slate-100 text-slate-600 ring-slate-200',
                        )}
                      >
                        {row.role}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-emerald-700">
                      {rs(row.cashCollection)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-slate-700">
                      {rs(row.onlineCollection)}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {rs(row.totalCollection)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.receiptCount}</td>
                    <td className="px-3 py-3 text-slate-600">{row.firstCollectionTime ?? '—'}</td>
                    <td className="px-3 py-3 text-slate-600">{row.lastCollectionTime ?? '—'}</td>
                    <td className="px-2 py-3 text-right print:hidden">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-[#2563eb] hover:bg-blue-50"
                          onClick={() =>
                            setDetailUser({
                              id: row.userId ?? 'unassigned',
                              name: row.userName,
                              role: row.role,
                            })
                          }
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Details
                        </button>
                        {data.canClose && row.userId ? (
                          row.cashClose?.status === 'CLOSED' ? (
                            <button
                              type="button"
                              className="rounded-full px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50"
                              onClick={() => reopenMut.mutate(row.userId!)}
                            >
                              Reopen
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="rounded-full px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              onClick={() => {
                                setCloseUser({
                                  id: row.userId!,
                                  name: row.userName,
                                  cash: row.cashCollection,
                                });
                                setOpeningCash('0');
                                setActualCash(String(row.cashCollection));
                              }}
                            >
                              Close counter
                            </button>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-[#eef4ff] font-semibold">
                  <td className="px-3 py-3" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-emerald-700">
                    {rs(data.summary.totalCash)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {rs(data.summary.totalOnline)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {rs(data.summary.totalCollection)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {data.summary.totalTransactions}
                  </td>
                  <td className="px-3 py-3 text-slate-400" colSpan={3}>
                    —
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm">
          <p className="inline-flex items-center gap-2 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Info className="h-4 w-4 shrink-0" />
            This report shows collections made by each user for the selected date and filters. Use
            this report for daily cash reconciliation.
          </p>
          <p className="text-xs text-slate-400">Generated on {generated}</p>
        </div>
      </section>

      {detailUser ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 print:hidden">
          <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">{detailUser.name}</p>
                <p className="text-sm text-slate-500">{detailUser.role}</p>
                <p className="mt-1 text-xs text-slate-400">{prettyDate(applied.date)}</p>
              </div>
              <button
                type="button"
                onClick={() => setDetailUser(null)}
                className="rounded-full p-2 hover:bg-slate-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {details.data ? (
              <div className="grid grid-cols-2 gap-2 px-5 py-4 sm:grid-cols-4">
                <MiniStat label="Cash Collected" value={rs(details.data.summary.cashCollected)} />
                <MiniStat
                  label="Online Collected"
                  value={rs(details.data.summary.onlineCollected)}
                />
                <MiniStat label="Total" value={rs(details.data.summary.total)} />
                <MiniStat label="Receipts" value={String(details.data.summary.receipts)} />
              </div>
            ) : null}
            <div className="flex-1 overflow-auto px-5 pb-6">
              {details.isLoading ? (
                <p className="py-8 text-sm text-slate-500">Loading receipts…</p>
              ) : !details.data?.receipts.length ? (
                <p className="py-8 text-sm text-slate-500">No receipts for this user.</p>
              ) : (
                <table className="min-w-full text-left text-xs">
                  <thead className="text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="py-2">Receipt No.</th>
                      <th className="py-2">Student</th>
                      <th className="py-2">Class</th>
                      <th className="py-2">Fee Month</th>
                      <th className="py-2 text-right">Amount</th>
                      <th className="py-2">Mode</th>
                      <th className="py-2">Time</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.data.receipts.map((r) => (
                      <tr key={r.id} className="border-t border-slate-100">
                        <td className="py-2">
                          <Link
                            className="font-medium text-[#2563eb]"
                            href={`/admin/school-sis/fees/receipts/${r.id}`}
                          >
                            {r.receiptNumber}
                          </Link>
                        </td>
                        <td className="py-2">
                          <p className="font-medium text-slate-800">{r.studentName}</p>
                          <p className="text-slate-400">{r.admissionNo}</p>
                        </td>
                        <td className="py-2">{r.className}</td>
                        <td className="py-2">{r.feeMonth}</td>
                        <td className="py-2 text-right font-semibold text-emerald-700">
                          {rs(r.amount)}
                        </td>
                        <td className="py-2">{r.paymentMode}</td>
                        <td className="py-2">{r.collectionTime}</td>
                        <td className="py-2 text-emerald-700">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {closeUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 print:hidden">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Daily Cashier Closing</h3>
              <button type="button" onClick={() => setCloseUser(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Cashier / User" value={closeUser.name} />
              <Row label="Business Date" value={prettyDate(applied.date)} />
              <label className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Opening Cash</span>
                <input
                  className="h-9 w-36 rounded-xl border border-slate-200 px-2 text-right text-sm"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                />
              </label>
              <Row label="Cash Collected" value={rs(closeUser.cash)} />
              <Row label="Cash Refunds" value={rs(0)} />
              <Row label="Expected Closing Cash" value={rs(expectedClose)} />
              <label className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Actual Cash Count</span>
                <input
                  className="h-9 w-36 rounded-xl border border-slate-200 px-2 text-right text-sm"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                />
              </label>
              <Row
                label="Difference"
                value={rs(difference)}
                tone={difference === 0 ? 'ok' : 'bad'}
              />
              <Row label="Status" value={recon} tone={recon === 'BALANCED' ? 'ok' : 'bad'} />
            </dl>
            <button
              type="button"
              disabled={closeMut.isPending || !actualCash}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1e3a8a] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() =>
                closeMut.mutate({
                  userId: closeUser.id,
                  date: applied.date,
                  academicYearId: applied.academicYearId || undefined,
                  openingCash: Number(openingCash || 0),
                  actualCashCount: Number(actualCash || 0),
                })
              }
            >
              <Banknote className="h-4 w-4" />
              Confirm cash closing
            </button>
            <p className="mt-2 text-xs text-slate-400">
              After closing, cashiers cannot collect or void receipts for this date unless an
              administrator reopens the counter.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof IndianRupee;
  label: string;
  value: string;
  hint: string;
  tone: 'blue' | 'green' | 'sky' | 'violet';
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <span
        className={cn('inline-flex h-11 w-11 items-center justify-center rounded-2xl', tones[tone])}
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
          <option key={`${label}-${opt.value}`} value={opt.value}>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] uppercase text-slate-400">{label}</p>
      <p className="font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span
        className={cn(
          'font-semibold',
          tone === 'ok' && 'text-emerald-700',
          tone === 'bad' && 'text-rose-700',
        )}
      >
        {value}
      </span>
    </div>
  );
}
