'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  GraduationCap,
  MoreHorizontal,
  RotateCcw,
  Search,
  Send,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { studentInitials } from '@/lib/school-sis/student-profile';
import { cn } from '@/utils/cn';
import { fetchMonthlyFeePending } from '@/services/school-sis';
import { CollectFeeDialog, type CollectFeeStudent } from './collect-fee-dialog';
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

const PAGE_SIZES = [15, 25, 50];

type FeeType = 'all' | 'monthly' | 'arrears' | 'late';
type StatusFilter = 'all' | 'pending' | 'overdue';
type SortKey = 'name' | 'admission' | 'class' | 'due';

export function MonthlyFeePending() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const [month, setMonth] = useState(currentFeeMonth());
  const [headerGrade, setHeaderGrade] = useState('all');
  const [q, setQ] = useState('');
  const [draftQ, setDraftQ] = useState('');
  const [gradeId, setGradeId] = useState('all');
  const [sectionId, setSectionId] = useState('all');
  const [feeType, setFeeType] = useState<FeeType>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [selected, setSelected] = useState<string[]>([]);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [collecting, setCollecting] = useState<CollectFeeStudent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['monthly-fee-pending', month],
    queryFn: () => fetchMonthlyFeePending(month),
    enabled,
  });

  const data = query.data;
  const grades = data?.grades ?? [];
  const sections = (data?.sections ?? []).filter((s) => gradeId === 'all' || s.gradeId === gradeId);

  const statsGrade = headerGrade === 'all' ? null : grades.find((g) => g.gradeId === headerGrade);
  const enrolled = statsGrade?.enrolled ?? data?.summary.enrolled ?? 0;
  const pendingCount = statsGrade?.pending ?? data?.summary.pending ?? 0;
  const paidCount = statsGrade?.paid ?? data?.summary.paid ?? 0;
  const pendingAmount = statsGrade?.pendingAmount ?? data?.summary.pendingAmount ?? 0;
  const pendingPct = enrolled ? Math.round((pendingCount / enrolled) * 100) : 0;
  const paidPct = enrolled ? Math.round((paidCount / enrolled) * 100) : 0;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = (data?.rows ?? []).filter((row) => {
      if (headerGrade !== 'all' && row.gradeId !== headerGrade) return false;
      if (gradeId !== 'all' && row.gradeId !== gradeId) return false;
      if (sectionId !== 'all' && row.sectionId !== sectionId) return false;
      if (feeType === 'monthly' && (row.previousBalance ?? 0) > 0) return false;
      if (feeType === 'arrears' && !(row.previousBalance ?? 0)) return false;
      if (feeType === 'late' && !(row.lateFeeAmount ?? 0)) return false;
      if (status === 'overdue' && !row.overdue) return false;
      if (status === 'pending' && row.overdue) return false;
      if (!needle) return true;
      const hay = [
        row.fullName,
        row.admissionNumber,
        row.rollNumber,
        row.className,
        row.sectionName,
        row.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (sortKey === 'admission') return dir * a.admissionNumber.localeCompare(b.admissionNumber);
      if (sortKey === 'class')
        return (
          dir * `${a.className} ${a.sectionName}`.localeCompare(`${b.className} ${b.sectionName}`)
        );
      if (sortKey === 'due') return dir * (a.totalDue - b.totalDue);
      return dir * a.fullName.localeCompare(b.fullName, 'en', { sensitivity: 'base' });
    });
    return rows;
  }, [data?.rows, feeType, gradeId, headerGrade, q, sectionId, sortDir, sortKey, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const allVisibleSelected =
    paged.length > 0 && paged.every((row) => selected.includes(row.studentId));
  const selectedRows = filtered.filter((row) => selected.includes(row.studentId));

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function applySearch() {
    setQ(draftQ);
    setPage(1);
  }

  function resetFilters() {
    setDraftQ('');
    setQ('');
    setGradeId('all');
    setSectionId('all');
    setFeeType('all');
    setStatus('all');
    setPage(1);
    setSelected([]);
  }

  function openCollect(row: CollectFeeStudent) {
    setError(null);
    setCollecting(row);
  }

  function collectSelected() {
    if (selectedRows.length === 1) {
      openCollect(selectedRows[0]);
      return;
    }
    setError('Collect each student individually so the payment method can be recorded.');
  }

  function sendReminders() {
    const targets = selectedRows.length ? selectedRows : [];
    if (!targets.length) {
      setError('Select at least one student to send a reminder.');
      return;
    }
    const withPhone = targets.filter((r) => (r.phone || '').replace(/\D/g, '').length >= 10);
    if (!withPhone.length) {
      setError('None of the selected students have a parent mobile number on file.');
      return;
    }
    const first = withPhone[0];
    const phone = (first.phone || '').replace(/\D/g, '').slice(-10);
    const text = encodeURIComponent(
      `Reminder: ${first.fullName} (${first.admissionNumber}) has pending school fees for ${data?.monthLabel}. Amount due: ${rs(first.totalDue)}. Please pay at the school office.`,
    );
    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
    if (withPhone.length > 1) {
      window.alert(
        `Opened WhatsApp for ${first.fullName}. ${withPhone.length - 1} more selected student(s) also have a mobile number.`,
      );
    }
  }

  function exportCsv() {
    const header = [
      '#',
      'Student',
      'Admission No.',
      'Class',
      'Month',
      'Outstanding',
      'Arrears',
      'Late fee',
      'Total due',
      'Status',
    ];
    const lines = [
      header.join(','),
      ...filtered.map((row, i) =>
        [
          i + 1,
          `"${row.fullName.replaceAll('"', '""')}"`,
          row.admissionNumber,
          `"${row.className} ${row.sectionName}"`,
          data?.monthLabel ?? month,
          row.tuitionAmount,
          row.previousBalance ?? 0,
          row.lateFeeAmount,
          row.totalDue,
          row.overdue ? 'Overdue' : 'Pending',
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pending-fees-${month}.csv`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  const monthOptions = useMemo(() => {
    const now = new Date();
    const out: Array<{ value: string; label: string }> = [];
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      out.push({
        value,
        label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      });
    }
    return out;
  }, []);

  return (
    <div className="-mx-1 space-y-4 rounded-[28px] bg-[#f4f7fb] p-3 sm:p-4">
      <MonthlyFeeSubnav />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
            <ClipboardList className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Pending Monthly Fees
            </h1>
            <p className="text-sm text-slate-500">
              Students with unpaid fees for the selected month and class.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200">
            <CalendarDays className="h-4 w-4 text-[#2563eb]" />
            <select
              className="bg-transparent font-semibold text-slate-800 outline-none"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setPage(1);
                setSelected([]);
              }}
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200">
            <GraduationCap className="h-4 w-4 text-[#2563eb]" />
            <select
              className="bg-transparent font-semibold text-slate-800 outline-none"
              value={headerGrade}
              onChange={(e) => {
                setHeaderGrade(e.target.value);
                setGradeId(e.target.value);
                setSectionId('all');
                setPage(1);
              }}
            >
              <option value="all">All classes</option>
              {grades.map((g) => (
                <option key={g.gradeId} value={g.gradeId}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            onClick={exportCsv}
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Users}
          label="Total Students"
          hint={statsGrade ? `in ${statsGrade.name}` : 'Nursery–X'}
          value={String(enrolled)}
          tone="blue"
        />
        <SummaryCard
          icon={AlertCircle}
          label="Pending"
          hint={`${pendingPct}%`}
          value={String(pendingCount)}
          tone="rose"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Paid"
          hint={`${paidPct}%`}
          value={String(paidCount)}
          tone="green"
        />
        <SummaryCard
          icon={Wallet}
          label="Total Pending Amount"
          hint={data?.monthLabel ?? ''}
          value={rs(pendingAmount)}
          tone="amber"
        />
      </div>

      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[16rem] flex-1 text-xs font-medium text-slate-500">
            Search
            <span className="relative mt-1 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-[#2563eb]"
                value={draftQ}
                onChange={(e) => setDraftQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                placeholder="Search by name, admission no. or roll no..."
              />
            </span>
          </label>
          <FilterSelect
            label="Class"
            value={gradeId}
            onChange={(v) => {
              setGradeId(v);
              setSectionId('all');
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All' },
              ...grades.map((g) => ({ value: g.gradeId, label: g.name })),
            ]}
          />
          <FilterSelect
            label="Section"
            value={sectionId}
            onChange={(v) => {
              setSectionId(v);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All Sections' },
              ...sections.map((s) => ({
                value: s.id,
                label: `${s.className} ${s.name}`,
              })),
            ]}
          />
          <FilterSelect
            label="Fee Type"
            value={feeType}
            onChange={(v) => {
              setFeeType(v as FeeType);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'monthly', label: 'This month only' },
              { value: 'arrears', label: 'With arrears' },
              { value: 'late', label: 'With late fee' },
            ]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(v) => {
              setStatus(v as StatusFilter);
              setPage(1);
            }}
            options={[
              { value: 'all', label: 'All' },
              { value: 'pending', label: 'Pending' },
              { value: 'overdue', label: 'Overdue' },
            ]}
          />
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
              Pending Fees ({data?.monthLabel ?? '—'})
            </h2>
            <p className="text-xs text-slate-500">
              Showing {filtered.length ? (safePage - 1) * pageSize + 1 : 0}–
              {Math.min(safePage * pageSize, filtered.length)} of {filtered.length} students
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-[#2563eb] ring-1 ring-slate-200"
              onClick={sendReminders}
            >
              <Send className="h-4 w-4" />
              Send Reminder
            </button>
            {canManage ? (
              <button
                type="button"
                disabled={!selectedRows.length}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[#e11d48] px-4 text-sm font-semibold text-white disabled:opacity-40"
                onClick={collectSelected}
              >
                <Wallet className="h-4 w-4" />
                Collect Selected
              </button>
            ) : null}
          </div>
        </div>

        {query.isLoading ? (
          <p className="p-6 text-sm text-slate-500">Loading pending list…</p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      const ids = paged.map((r) => r.studentId);
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
                <th className="px-2 py-3">
                  <SortBtn
                    active={sortKey === 'admission'}
                    dir={sortDir}
                    onClick={() => toggleSort('admission')}
                  >
                    Admission no.
                  </SortBtn>
                </th>
                <th className="px-2 py-3">
                  <SortBtn
                    active={sortKey === 'class'}
                    dir={sortDir}
                    onClick={() => toggleSort('class')}
                  >
                    Class
                  </SortBtn>
                </th>
                <th className="px-2 py-3">Month</th>
                <th className="px-2 py-3 text-right">Outstanding</th>
                <th className="px-2 py-3 text-right">Arrears</th>
                <th className="px-2 py-3 text-right">Late fee</th>
                <th className="px-2 py-3 text-right">
                  <SortBtn
                    active={sortKey === 'due'}
                    dir={sortDir}
                    onClick={() => toggleSort('due')}
                  >
                    Total due
                  </SortBtn>
                </th>
                <th className="px-2 py-3">Status</th>
                <th className="px-2 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((row, index) => {
                const n = (safePage - 1) * pageSize + index + 1;
                return (
                  <tr key={row.studentId} className="border-t border-slate-50 hover:bg-slate-50/80">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(row.studentId)}
                        onChange={(e) =>
                          setSelected((cur) =>
                            e.target.checked
                              ? [...cur, row.studentId]
                              : cur.filter((id) => id !== row.studentId),
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
                            avatarTone(row.fullName),
                          )}
                        >
                          {studentInitials(row.fullName)}
                        </span>
                        <span>
                          <span className="block font-semibold text-slate-800">{row.fullName}</span>
                          {row.rollNumber ? (
                            <span className="text-xs text-slate-400">Roll {row.rollNumber}</span>
                          ) : null}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-3 text-slate-500">{row.admissionNumber}</td>
                    <td className="px-2 py-3 text-slate-600">
                      {row.className} {row.sectionName}
                    </td>
                    <td className="px-2 py-3 text-slate-600">{data?.monthLabel}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{rs(row.tuitionAmount)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">
                      {rs(row.previousBalance ?? 0)}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{rs(row.lateFeeAmount)}</td>
                    <td className="px-2 py-3 text-right font-bold tabular-nums text-slate-900">
                      {rs(row.totalDue)}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                          row.overdue
                            ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
                            : 'bg-rose-50 text-rose-600 ring-1 ring-rose-100',
                        )}
                      >
                        {row.status === 'PARTIAL'
                          ? 'Partially paid'
                          : row.overdue
                            ? 'Overdue'
                            : 'Pending'}
                      </span>
                    </td>
                    <td className="relative px-2 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canManage ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg bg-[#1e3a8a] px-3 py-1.5 text-xs font-semibold text-white"
                            onClick={() => openCollect(row)}
                          >
                            <Wallet className="h-3.5 w-3.5" />
                            Collect
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          onClick={() =>
                            setMenuFor((cur) => (cur === row.studentId ? null : row.studentId))
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                      {menuFor === row.studentId ? (
                        <div className="absolute right-2 z-20 mt-1 w-40 rounded-xl bg-white py-1 text-sm shadow-lg ring-1 ring-slate-200">
                          <Link
                            className="block px-3 py-2 hover:bg-slate-50"
                            href="/admin/school-sis/fees/collect"
                            onClick={() => setMenuFor(null)}
                          >
                            Open in Collect
                          </Link>
                          <Link
                            className="block px-3 py-2 hover:bg-slate-50"
                            href={`/admin/school-sis/students/${row.studentId}`}
                            onClick={() => setMenuFor(null)}
                          >
                            Student profile
                          </Link>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!query.isLoading && !filtered.length ? (
          <p className="p-8 text-center text-sm text-slate-500">
            No pending monthly fees for this month and filter.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
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
              Showing {filtered.length ? (safePage - 1) * pageSize + 1 : 0}-
              {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
            </span>
          </div>
        </div>
      </section>
      <CollectFeeDialog
        open={Boolean(collecting)}
        onOpenChange={(next) => {
          if (!next) setCollecting(null);
        }}
        student={collecting}
        feeMonth={month}
        monthLabel={data?.monthLabel ?? month}
        academicYear={data?.academicYear?.name}
      />
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
  tone: 'blue' | 'rose' | 'green' | 'amber';
}) {
  const tones = {
    blue: 'bg-[#eef4ff] text-[#2563eb]',
    rose: 'bg-rose-50 text-rose-600',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-700',
  };
  const wrap = {
    blue: 'bg-white',
    rose: 'bg-rose-50/70',
    green: 'bg-emerald-50/70',
    amber: 'bg-amber-50/80',
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
        <p
          className={cn(
            'text-2xl font-bold tabular-nums',
            tone === 'rose' ? 'text-rose-600' : 'text-slate-900',
          )}
        >
          {value}
        </p>
        <p className="text-sm text-slate-600">{label}</p>
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
