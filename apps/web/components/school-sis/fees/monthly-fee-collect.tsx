'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Filter,
  Home,
  Info,
  Mail,
  Phone,
  Printer,
  Receipt,
  Search,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  isMonthlyFeeGrade,
  monthlyOtherLabel,
  MONTHLY_FEE_CODES,
} from '@/lib/school-sis/monthly-fee-bands';
import { formatSchoolAddress, studentInitials } from '@/lib/school-sis/student-profile';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/utils/api-error';
import {
  collectMonthlyFee,
  downloadMonthlyFeeReceiptPdf,
  fetchMonthlyFeeConfig,
  fetchMonthlyFeeLedger,
  fetchSchoolSisStudents,
  printMonthlyFeeReceipt,
  sendMonthlyFeeReceipt,
  type MonthlyFeeLedgerRow,
  type SchoolSisStudent,
} from '@/services/school-sis';
import { MonthlyFeeReceiptCard } from './monthly-fee-receipt-card';
import { MonthlyFeeSubnav, currentFeeMonth, rs, rupeesInWords, shortMonth } from './monthly-fee-ui';

const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK: 'Bank Transfer',
  CHEQUE: 'Cheque',
  ONLINE: 'Online Payment',
  OTHER: 'Other',
};

const AVATAR = [
  'bg-fuchsia-100 text-fuchsia-700',
  'bg-sky-100 text-sky-700',
  'bg-amber-100 text-amber-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-800',
  'bg-orange-100 text-orange-800',
];

function avatarTone(name: string) {
  let n = 0;
  for (const ch of name) n += ch.charCodeAt(0);
  return AVATAR[n % AVATAR.length];
}

function classLabel(student: SchoolSisStudent) {
  const enr = student.enrollments[0];
  if (!enr) return '—';
  return `${enr.section.grade.name} ${enr.section.name}`.trim();
}

function sectionKey(student: SchoolSisStudent) {
  return student.enrollments[0]?.section.id ?? '';
}

export function MonthlyFeeCollect() {
  const enabled = useAuthQueryEnabled();
  const sessionUser = useAuthStore((s) => s.session?.user);
  const canManage = canManageSchoolSis(sessionUser?.permissions);
  const [q, setQ] = useState('');
  const [sectionId, setSectionId] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'admission'>('name');
  const [showMoreClasses, setShowMoreClasses] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState('CASH');
  const [reference, setReference] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [discountType, setDiscountType] = useState<'AMOUNT' | 'PERCENT'>('AMOUNT');
  const [discountValue, setDiscountValue] = useState('0');
  const [discountReason, setDiscountReason] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [waiveLate, setWaiveLate] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [amountPaying, setAmountPaying] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    id: string;
    receiptNumber: string;
    months: string[];
    tuition: number;
    late: number;
    other: number;
    discount: number;
    total: number;
    paidAt: string;
  } | null>(null);

  const config = useQuery({
    queryKey: ['monthly-fee-config'],
    queryFn: fetchMonthlyFeeConfig,
    enabled,
  });
  const students = useQuery({
    queryKey: ['school-sis-students', 'monthly-collect'],
    queryFn: () => fetchSchoolSisStudents({ status: 'ACTIVE' }),
    enabled,
  });
  const ledger = useQuery({
    queryKey: ['monthly-fee-ledger', studentId],
    queryFn: () => fetchMonthlyFeeLedger(studentId),
    enabled: Boolean(studentId),
  });

  const eligible = useMemo(
    () =>
      (students.data ?? []).filter((s) =>
        isMonthlyFeeGrade(s.enrollments[0]?.section.grade.code ?? ''),
      ),
    [students.data],
  );

  const classChips = useMemo(() => {
    const map = new Map<string, { id: string; label: string; count: number; sort: number }>();
    for (const s of eligible) {
      const enr = s.enrollments[0];
      if (!enr) continue;
      const id = enr.section.id;
      const cur = map.get(id);
      if (cur) cur.count += 1;
      else {
        map.set(id, {
          id,
          label: `${enr.section.grade.name} ${enr.section.name}`.trim(),
          count: 1,
          sort: (MONTHLY_FEE_CODES as readonly string[]).indexOf(enr.section.grade.code),
        });
      }
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  }, [eligible]);

  const pinnedChips = classChips.slice(0, 4);
  const extraChips = classChips.slice(4);

  const listed = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = eligible.filter((s) => {
      if (sectionId !== 'all' && sectionKey(s) !== sectionId) return false;
      if (!needle) return true;
      const hay = [
        s.fullName,
        s.admissionNumber,
        s.phone,
        s.email,
        classLabel(s),
        s.guardians[0]?.guardian.fullName,
        s.guardians[0]?.guardian.phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
    rows.sort((a, b) =>
      sortBy === 'admission'
        ? a.admissionNumber.localeCompare(b.admissionNumber, 'en')
        : a.fullName.localeCompare(b.fullName, 'en', { sensitivity: 'base' }),
    );
    return rows;
  }, [eligible, q, sectionId, sortBy]);

  const selectedStudent = eligible.find((s) => s.id === studentId) ?? null;
  const book = ledger.data;
  const dueRows = book?.rows.filter((r) => r.selectable) ?? [];
  const selectedRows = (book?.rows ?? []).filter((r) => selected.includes(r.feeMonth));
  const paidMonths = book?.rows.filter((r) => r.status === 'PAID').length ?? 0;
  const billedGross = selectedRows.reduce((s, r) => s + r.totalDue, 0);
  const tuition = selectedRows.reduce((s, r) => s + r.tuitionAmount, 0);
  const other = selectedRows.reduce((s, r) => s + r.otherAmount, 0);
  const late = selectedRows.reduce((s, r) => s + r.lateFeeAmount, 0);
  const lateCharged = waiveLate ? 0 : late;
  const gross = Math.max(0, billedGross - (waiveLate ? late : 0));
  const discRaw = Number(discountValue || 0);
  const discount = Math.min(
    gross,
    discountType === 'PERCENT' ? Math.round((gross * discRaw) / 100) : Math.round(discRaw) || 0,
  );
  const net = Math.max(0, gross - discount);
  const typedPaying = amountPaying === '' ? net : Math.round(Number(amountPaying) || 0);
  const paying = Math.min(net, typedPaying);
  const remaining = Math.max(0, net - paying);
  const current = currentFeeMonth();
  const concessionReady =
    discount <= 0 || (Boolean(discountReason.trim()) && Boolean(approvedBy.trim()));
  const lateWaiverReady = !waiveLate || Boolean(lateReason.trim());
  const canCollect =
    canManage &&
    selected.length > 0 &&
    paying > 0 &&
    concessionReady &&
    lateWaiverReady &&
    (selected.length === 1 || paying === net);
  const lateFeesOn = book?.settings.lateFeeEnabled ?? config.data?.settings.lateFeeEnabled ?? true;
  const otherLabel = book?.otherLabel || monthlyOtherLabel(book?.gradeCode ?? '');
  const planTuition = book?.rows[0]?.tuitionAmount ?? 0;
  const planOther = book?.rows[0]?.otherAmount ?? 0;
  const planLate =
    book?.rows.find((r) => r.lateFeeAmount)?.lateFeeAmount ??
    config.data?.settings.lateFeeAmount ??
    20;
  const receiptId = success?.id || book?.history.find((h) => h.status === 'PAID')?.id;
  const yearName = book?.academicYear.name || config.data?.academicYear.name || '—';

  useEffect(() => {
    setAmountPaying((prev) => {
      if (prev === '') return prev;
      const n = Math.round(Number(prev) || 0);
      if (n > net) return net ? String(net) : '';
      return prev;
    });
  }, [net]);

  useEffect(() => {
    const name = sessionUser?.displayName?.trim();
    if (name && !approvedBy) setApprovedBy(name);
  }, [sessionUser?.displayName, approvedBy]);

  function pickStudent(id: string) {
    setStudentId(id);
    setSelected([]);
    setSuccess(null);
    setAmountPaying('');
    setError(null);
    setWaiveLate(false);
    setDiscountValue('0');
  }

  function toggle(month: string) {
    setSelected((cur) =>
      cur.includes(month) ? cur.filter((m) => m !== month) : [...cur, month].sort(),
    );
    setSuccess(null);
  }

  return (
    <div className="-mx-1 space-y-4 rounded-[28px] bg-[#f4f7fb] p-3 sm:p-4">
      <MonthlyFeeSubnav />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563eb] text-white shadow-sm">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Monthly Fee Collection
            </h1>
            <p className="text-sm text-slate-500">
              Select a student, choose the months, and collect the payment.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-slate-600 ring-1 ring-slate-200">
            <CalendarDays className="h-4 w-4 text-[#2563eb]" />
            Academic Year
            <b className="font-semibold text-slate-800">{yearName}</b>
          </span>
          {book ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {book.className} {book.sectionName}
              <span className="text-xs font-normal text-emerald-700">Current Class</span>
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl bg-rose-50 px-4 py-2 text-sm text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
        <aside className="flex min-h-[36rem] flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-100">
          <div className="border-b border-slate-100 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Search className="h-4 w-4 text-slate-400" />
              Search Student
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none ring-[#2563eb] placeholder:text-slate-400 focus:bg-white focus:ring-2"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, admission no., class or mobile..."
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip active={sectionId === 'all'} onClick={() => setSectionId('all')}>
                All
              </Chip>
              {pinnedChips.map((chip) => (
                <Chip
                  key={chip.id}
                  active={sectionId === chip.id}
                  onClick={() => setSectionId(chip.id)}
                >
                  {chip.label}
                </Chip>
              ))}
              {extraChips.length ? (
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-full bg-slate-50 px-2.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                  onClick={() => setShowMoreClasses((v) => !v)}
                >
                  <Filter className="mr-1 h-3.5 w-3.5" />
                  {showMoreClasses ? 'Less' : 'More'}
                </button>
              ) : null}
            </div>
            {showMoreClasses && extraChips.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {extraChips.map((chip) => (
                  <Chip
                    key={chip.id}
                    active={sectionId === chip.id}
                    onClick={() => setSectionId(chip.id)}
                  >
                    {chip.label}
                  </Chip>
                ))}
              </div>
            ) : null}
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>
                <b className="font-semibold text-slate-700">{listed.length}</b> Students
              </span>
              <label className="inline-flex items-center gap-1">
                Sort:
                <select
                  className="rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-xs"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'name' | 'admission')}
                >
                  <option value="name">Name</option>
                  <option value="admission">Admission no.</option>
                </select>
              </label>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            {students.isLoading ? (
              <p className="p-4 text-sm text-slate-500">Loading students…</p>
            ) : null}
            {!students.isLoading && !listed.length ? (
              <p className="p-4 text-sm text-slate-500">No Nursery–X students match that search.</p>
            ) : null}
            {listed.map((s) => {
              const active = s.id === studentId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickStudent(s.id)}
                  className={cn(
                    'flex w-full items-center gap-3 border-b border-slate-50 px-4 py-3 text-left transition',
                    active ? 'bg-[#eef4ff]' : 'hover:bg-slate-50',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                      avatarTone(s.fullName),
                    )}
                  >
                    {studentInitials(s.fullName)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">
                      {s.fullName}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {s.admissionNumber} · {classLabel(s)}
                    </span>
                  </span>
                  <ChevronRight
                    className={cn('h-4 w-4', active ? 'text-[#2563eb]' : 'text-slate-300')}
                  />
                </button>
              );
            })}
          </div>
        </aside>

        <div className="space-y-4">
          {!studentId ? (
            <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-100">
              <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#2563eb]">
                <UserRound className="h-7 w-7" />
              </span>
              <p className="text-lg font-semibold text-slate-800">Select a student</p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Choose a Nursery–X student from the list to open the month-wise fee book.
              </p>
            </div>
          ) : null}

          {ledger.isLoading ? (
            <p className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">
              Loading fee ledger…
            </p>
          ) : null}

          {book && selectedStudent ? (
            <>
              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-fuchsia-100 text-lg font-bold text-fuchsia-700">
                      {studentInitials(book.student.fullName)}
                    </span>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{book.student.fullName}</h2>
                      <p className="text-sm text-slate-500">
                        {book.student.admissionNumber} · {book.className} {book.sectionName} ·{' '}
                        {yearName}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Active Student
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Meta
                    icon={UserRound}
                    label="Parent"
                    value={selectedStudent.guardians[0]?.guardian.fullName || '—'}
                  />
                  <Meta
                    icon={Phone}
                    label="Mobile"
                    value={
                      selectedStudent.guardians[0]?.guardian.phone ||
                      selectedStudent.phone ||
                      book.student.phone ||
                      '—'
                    }
                  />
                  <Meta icon={Mail} label="Email" value={selectedStudent.email || '—'} />
                  <Meta
                    icon={Home}
                    label="Address"
                    value={
                      formatSchoolAddress(
                        selectedStudent.currentAddress,
                        selectedStudent.address,
                      ) || '—'
                    }
                  />
                </div>
              </section>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  icon={Wallet}
                  label="Total Outstanding"
                  value={rs(book.totalOutstanding)}
                  tone="blue"
                />
                <StatCard
                  icon={Clock3}
                  label="Unpaid Months"
                  value={String(book.unpaidMonths)}
                  tone="rose"
                />
                <StatCard
                  icon={CheckCircle2}
                  label="Paid Months"
                  value={String(paidMonths)}
                  tone="green"
                />
                <StatCard
                  icon={CalendarDays}
                  label="Current Month"
                  value={shortMonth(book.currentMonth)}
                  tone="violet"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <CalendarDays className="h-4 w-4 text-[#2563eb]" />
                      Select Months to Collect
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <GhostBtn onClick={() => setSelected(dueRows.map((r) => r.feeMonth))}>
                        Select All Due
                      </GhostBtn>
                      <GhostBtn
                        onClick={() => {
                          const row = book.rows.find((r) => r.feeMonth === current && r.selectable);
                          setSelected(row ? [row.feeMonth] : []);
                        }}
                      >
                        Pay Current Month
                      </GhostBtn>
                      <GhostBtn onClick={() => setSelected([])}>Clear Selection</GhostBtn>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {book.rows.map((row) => (
                      <MonthCard
                        key={row.feeMonth}
                        row={row}
                        checked={selected.includes(row.feeMonth)}
                        onToggle={() => row.selectable && toggle(row.feeMonth)}
                      />
                    ))}
                  </div>
                </section>

                <aside className="space-y-4">
                  <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                    <h3 className="text-sm font-semibold text-slate-800">Payment Summary</h3>
                    <dl className="mt-3 space-y-2 text-sm">
                      <Line
                        label="Selected Months"
                        value={selectedRows.length ? String(selectedRows.length) : '0'}
                      />
                      <Line label="Tuition Fees" value={rs(tuition)} />
                      <Line label={otherLabel} value={rs(other)} />
                      <Line
                        label="Late Fees"
                        value={waiveLate && late ? `${rs(0)} (waived)` : rs(lateCharged)}
                      />
                    </dl>

                    <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Concession
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <select
                          className="h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm"
                          value={discountType}
                          onChange={(e) => setDiscountType(e.target.value as 'AMOUNT' | 'PERCENT')}
                        >
                          <option value="AMOUNT">Amount (₹)</option>
                          <option value="PERCENT">Percent (%)</option>
                        </select>
                        <input
                          className="h-10 rounded-xl border border-slate-200 bg-white px-2 text-sm tabular-nums"
                          inputMode="decimal"
                          placeholder="0"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                        />
                      </div>
                      <div className="mt-2 flex justify-between text-sm">
                        <span className="text-slate-500">Concession applied</span>
                        <span className="font-semibold tabular-nums text-rose-600">
                          − {rs(discount)}
                        </span>
                      </div>
                      {discount > 0 ? (
                        <div className="mt-2 space-y-2">
                          <input
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            placeholder="Reason (required)"
                            value={discountReason}
                            onChange={(e) => setDiscountReason(e.target.value)}
                          />
                          <input
                            className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                            placeholder="Approved by (required)"
                            value={approvedBy}
                            onChange={(e) => setApprovedBy(e.target.value)}
                          />
                          {!concessionReady ? (
                            <p className="text-xs text-amber-700">
                              Enter a reason and who approved the concession before collecting.
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-400">
                          Enter an amount or percent to reduce this receipt. Reason and approver are
                          required when a concession is given.
                        </p>
                      )}
                    </div>

                    {late > 0 && lateFeesOn ? (
                      <div className="mt-3 rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-100">
                        <label className="flex items-start gap-2 text-sm text-rose-900">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={waiveLate}
                            onChange={(e) => setWaiveLate(e.target.checked)}
                          />
                          <span>
                            Do not collect late fee on this receipt
                            <span className="block text-xs font-normal text-rose-700">
                              Removes {rs(late)} from the total for the selected overdue months.
                            </span>
                          </span>
                        </label>
                        {waiveLate ? (
                          <input
                            className="mt-2 h-10 w-full rounded-xl border border-rose-200 bg-white px-3 text-sm"
                            placeholder="Waiver reason (required)"
                            value={lateReason}
                            onChange={(e) => setLateReason(e.target.value)}
                          />
                        ) : null}
                      </div>
                    ) : !lateFeesOn ? (
                      <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                        School-wide late fees are switched off in Configuration. Overdue months will
                        not add a late charge.
                      </p>
                    ) : null}

                    <div className="mt-4 rounded-2xl bg-[#2563eb] px-4 py-3 text-white">
                      <p className="text-xs font-medium text-blue-100">Total Amount</p>
                      <p className="text-3xl font-bold tabular-nums">{rs(net)}</p>
                      <p className="mt-1 text-[11px] text-blue-100">{rupeesInWords(net)}</p>
                    </div>
                    {selectedRows
                      .filter((r) => r.lateApplies && !waiveLate)
                      .map((r) => (
                        <p key={r.feeMonth} className="mt-2 text-xs text-rose-700">
                          {r.lateReason}
                        </p>
                      ))}
                    <button
                      type="button"
                      className="mt-3 text-xs font-medium text-[#2563eb]"
                      onClick={() => setDetailsOpen((v) => !v)}
                    >
                      {detailsOpen ? 'Hide payment method' : 'Payment method & amount paying'}
                    </button>
                    {detailsOpen ? (
                      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        <select
                          className="h-10 w-full rounded-xl border px-3 text-sm"
                          value={mode}
                          onChange={(e) => setMode(e.target.value)}
                        >
                          {(book.settings.paymentMethods?.length
                            ? book.settings.paymentMethods
                            : Object.keys(METHOD_LABEL)
                          ).map((m) => (
                            <option key={m} value={m}>
                              {METHOD_LABEL[m] ?? m}
                            </option>
                          ))}
                        </select>
                        {mode === 'UPI' ||
                        mode === 'ONLINE' ||
                        mode === 'BANK' ||
                        mode === 'OTHER' ? (
                          <input
                            className="h-10 w-full rounded-xl border px-3 text-sm"
                            placeholder={
                              mode === 'BANK' ? 'Bank reference' : 'Transaction / reference'
                            }
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                          />
                        ) : null}
                        {mode === 'CHEQUE' ? (
                          <>
                            <input
                              className="h-10 w-full rounded-xl border px-3 text-sm"
                              placeholder="Cheque number"
                              value={chequeNumber}
                              onChange={(e) => setChequeNumber(e.target.value)}
                            />
                            <input
                              className="h-10 w-full rounded-xl border px-3 text-sm"
                              placeholder="Bank"
                              value={bankName}
                              onChange={(e) => setBankName(e.target.value)}
                            />
                          </>
                        ) : null}
                        <label className="block text-xs text-slate-500">
                          Amount paying
                          <input
                            className="mt-1 h-10 w-full rounded-xl border px-3 text-sm font-semibold tabular-nums"
                            value={amountPaying}
                            placeholder={String(net)}
                            onChange={(e) => setAmountPaying(e.target.value)}
                          />
                        </label>
                        {selected.length === 1 && paying < net ? (
                          <p className="text-xs text-amber-700">
                            Partial payment. Remaining on {selectedRows[0]?.monthLabel}:{' '}
                            {rs(remaining)}
                          </p>
                        ) : selected.length > 1 && paying !== net ? (
                          <p className="text-xs text-rose-700">
                            Multi-month receipts must be paid in full.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {canManage ? (
                      <button
                        type="button"
                        disabled={!canCollect}
                        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#2563eb] text-sm font-semibold text-white shadow-sm disabled:opacity-40"
                        onClick={() => setConfirmOpen(true)}
                      >
                        <Wallet className="h-4 w-4" />
                        Collect Payment
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={!receiptId}
                      className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 disabled:opacity-40"
                      onClick={() => {
                        if (!receiptId) return;
                        void printMonthlyFeeReceipt(receiptId).catch((err) =>
                          setError(apiErrorMessage(err)),
                        );
                      }}
                    >
                      <Printer className="h-4 w-4" />
                      Generate Receipt
                    </button>
                  </section>
                </aside>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                  <h3 className="mb-3 text-sm font-semibold text-slate-800">
                    Fee Structure ({book.className} {book.sectionName})
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="pb-2">Fee head</th>
                        <th className="pb-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-slate-100">
                        <td className="py-2">Tuition Fee</td>
                        <td className="py-2 text-right tabular-nums">{rs(planTuition)}</td>
                      </tr>
                      <tr className="border-t border-slate-100">
                        <td className="py-2">{otherLabel}</td>
                        <td className="py-2 text-right tabular-nums">{rs(planOther)}</td>
                      </tr>
                      <tr className="border-t border-slate-100">
                        <td className="py-2">Late Fee (per month)</td>
                        <td className="py-2 text-right tabular-nums">{rs(planLate)}</td>
                      </tr>
                    </tbody>
                  </table>
                </section>
                <section className="rounded-3xl bg-[#eef6ff] p-5 ring-1 ring-sky-100">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Info className="h-4 w-4 text-[#2563eb]" />
                    Important Information
                  </h3>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li>
                      Late fee is added after the {book.settings.dueDay}
                      {book.settings.dueDay === 1
                        ? 'st'
                        : book.settings.dueDay === 2
                          ? 'nd'
                          : book.settings.dueDay === 3
                            ? 'rd'
                            : 'th'}{' '}
                      of each month.
                    </li>
                    <li>You can select multiple months to pay at once.</li>
                    <li>A receipt will be generated after successful payment.</li>
                    <li>Please verify the details before collecting the payment.</li>
                  </ul>
                </section>
              </div>
            </>
          ) : null}

          {book?.history.length ? (
            <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Receipt className="h-4 w-4 text-[#2563eb]" />
                Payment history
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="px-2 py-1">Date</th>
                      <th className="px-2 py-1">Receipt</th>
                      <th className="px-2 py-1">Months</th>
                      <th className="px-2 py-1">Amount</th>
                      <th className="px-2 py-1">Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {book.history.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-2 py-2">
                          {new Date(row.paidAt).toLocaleString('en-IN')}
                        </td>
                        <td className="px-2 py-2">
                          <Link
                            className="font-medium text-[#2563eb]"
                            href={`/admin/school-sis/fees/receipts/${row.id}`}
                          >
                            {row.receiptNumber}
                          </Link>
                        </td>
                        <td className="px-2 py-2">{row.months.join(', ')}</td>
                        <td className="px-2 py-2 tabular-nums">{rs(row.amount)}</td>
                        <td className="px-2 py-2">{row.paymentMode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {success && book ? (
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="font-semibold text-emerald-800">
                Payment successful · Receipt {success.receiptNumber}
              </p>
              <p className="text-sm text-emerald-700">
                Fee months paid: {success.months.join(', ')}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                  href={`/admin/school-sis/fees/receipts/${success.id}`}
                >
                  View receipt
                </Link>
                <button
                  type="button"
                  className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                  onClick={() =>
                    void printMonthlyFeeReceipt(success.id).catch((err) =>
                      setError(apiErrorMessage(err)),
                    )
                  }
                >
                  Print
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                  onClick={() =>
                    void downloadMonthlyFeeReceiptPdf(success.id, success.receiptNumber)
                  }
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200"
                  onClick={() => {
                    void sendMonthlyFeeReceipt(success.id)
                      .then((res) => {
                        const phone = (res.studentPhone || '').replace(/\D/g, '');
                        const text = encodeURIComponent(
                          `Fee receipt ${res.receiptNumber} for ${book.student.fullName}`,
                        );
                        if (phone)
                          window.open(`https://wa.me/91${phone.slice(-10)}?text=${text}`, '_blank');
                        else window.alert('Receipt marked as sent. No parent mobile is on file.');
                      })
                      .catch((err) => setError(apiErrorMessage(err)));
                  }}
                >
                  Send to parent
                </button>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-2 print:grid-cols-2">
                {(["Parent's copy", 'School copy'] as const).map((copy) => (
                  <MonthlyFeeReceiptCard
                    key={copy}
                    copy={copy}
                    schoolName={book.settings.schoolName || "St. Luke's Secondary School, Tura"}
                    schoolAddress={
                      book.settings.schoolAddress ||
                      'Walbakgre, Tura - 794101, West Garo Hills, Meghalaya'
                    }
                    logoUrl="/school-sis/st-lukes-logo.png"
                    motto="Knowledge · Service · Light"
                    monthLabel={success.months.join(', ')}
                    studentName={book.student.fullName}
                    admissionNumber={book.student.admissionNumber}
                    className={`${book.className} ${book.sectionName}`}
                    receiptNumber={success.receiptNumber}
                    academicYear={book.academicYear.name}
                    paidAt={success.paidAt}
                    paymentMode={mode}
                    tuition={success.tuition}
                    late={success.late}
                    other={success.other}
                    otherLabel={otherLabel}
                    discount={success.discount}
                    previous={0}
                    total={success.total}
                    signatory={book.settings.signatoryName}
                    monthsCovered={success.months}
                    instructions={
                      book.settings.instructionsJson?.length
                        ? book.settings.instructionsJson
                        : [
                            'Fees are to be paid before the 15th of every month.',
                            'Annual Fees and Jan. & Feb. Tuition Fees to be paid at the time of Admission.',
                            'Pupils with dues may be barred from sitting for the Examinations.',
                            'Fees once paid are not refundable.',
                          ]
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {confirmOpen && book ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Confirm fee payment</h3>
            <p className="mt-2 text-sm font-medium">{book.student.fullName}</p>
            <p className="text-sm text-slate-500">
              {book.className} {book.sectionName} · {yearName}
            </p>
            <p className="mt-3 text-sm">
              <b>Months:</b> {selectedRows.map((r) => r.monthLabel).join(', ')}
            </p>
            {discount > 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                Concession {rs(discount)}
                {discountReason.trim() ? ` · ${discountReason.trim()}` : ''}
                {approvedBy.trim() ? ` · Approved by ${approvedBy.trim()}` : ''}
              </p>
            ) : null}
            <p className="mt-2 text-3xl font-bold tabular-nums text-[#2563eb]">{rs(paying)}</p>
            <p className="text-xs text-slate-500">{rupeesInWords(paying)}</p>
            <p className="mt-1 text-sm text-slate-500">
              Payment mode: {METHOD_LABEL[mode] ?? mode}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border px-4 py-2 text-sm"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canCollect}
                className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() => {
                  void collectMonthlyFee({
                    studentId,
                    months: selected,
                    paymentMode: mode,
                    reference: reference || undefined,
                    chequeNumber: chequeNumber || undefined,
                    bankName: bankName || undefined,
                    discountType,
                    discountValue: discRaw || undefined,
                    discountReason: discount ? discountReason : undefined,
                    discountApprovedBy: discount ? approvedBy : undefined,
                    amountPaying: paying,
                    lateWaivers: waiveLate
                      ? selectedRows
                          .filter((r) => r.lateFeeAmount)
                          .map((r) => ({ month: r.feeMonth, reason: lateReason }))
                      : undefined,
                    waiveLateFee: waiveLate,
                    channel: 'OFFICE',
                  })
                    .then((res) => {
                      setError(null);
                      setConfirmOpen(false);
                      setSuccess({
                        id: res.payment.id,
                        receiptNumber: res.receiptNumber,
                        months: res.months ?? selectedRows.map((r) => r.monthLabel),
                        tuition: res.payment.tuitionAmount ?? tuition,
                        late: res.payment.lateFeeAmount ?? late,
                        other: res.payment.otherAmount ?? other,
                        discount: res.payment.discountAmount ?? discount,
                        total: res.payment.totalAmount ?? paying,
                        paidAt: new Date().toLocaleString('en-IN'),
                      });
                      setSelected([]);
                      void ledger.refetch();
                    })
                    .catch((err) => {
                      setConfirmOpen(false);
                      setError(apiErrorMessage(err));
                    });
                }}
              >
                Confirm payment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-8 rounded-full px-3 text-xs font-semibold ring-1',
        active
          ? 'bg-[#2563eb] text-white ring-[#2563eb]'
          : 'bg-slate-50 text-slate-600 ring-slate-200 hover:bg-white',
      )}
    >
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:bg-white"
    >
      {children}
    </button>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  tone: 'blue' | 'rose' | 'green' | 'violet';
}) {
  const tones = {
    blue: 'bg-[#eef4ff] text-[#2563eb]',
    rose: 'bg-rose-50 text-rose-600',
    green: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
      <span
        className={cn('inline-flex h-11 w-11 items-center justify-center rounded-2xl', tones[tone])}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-lg font-bold tabular-nums text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium tabular-nums text-slate-800">{value}</dd>
    </div>
  );
}

function MonthCard({
  row,
  checked,
  onToggle,
}: {
  row: MonthlyFeeLedgerRow;
  checked: boolean;
  onToggle: () => void;
}) {
  const paid = row.status === 'PAID';
  const overdue = row.status === 'OVERDUE' || (row.lateApplies && row.selectable);
  const upcoming = row.selectable && !overdue && row.status === 'DUE';
  return (
    <button
      type="button"
      disabled={!row.selectable}
      onClick={onToggle}
      className={cn(
        'rounded-2xl border p-3 text-left transition',
        paid && 'border-emerald-100 bg-emerald-50/70 opacity-80',
        overdue && !checked && 'border-rose-100 bg-rose-50',
        overdue && checked && 'border-rose-300 bg-rose-50 ring-2 ring-rose-200',
        upcoming && !checked && 'border-slate-200 bg-white',
        upcoming && checked && 'border-[#2563eb] bg-[#eef4ff] ring-2 ring-[#bfdbfe]',
        row.status === 'PARTIAL' && 'border-amber-200 bg-amber-50',
        !row.selectable && paid ? '' : !row.selectable ? 'cursor-not-allowed' : '',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border',
            checked ? 'border-[#2563eb] bg-[#2563eb] text-white' : 'border-slate-300 bg-white',
          )}
        >
          {checked ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            paid && 'bg-emerald-100 text-emerald-800',
            overdue && 'bg-rose-100 text-rose-700',
            upcoming && 'bg-slate-100 text-slate-500',
            row.status === 'PARTIAL' && 'bg-amber-100 text-amber-800',
          )}
        >
          {paid ? 'Paid' : overdue ? 'Overdue' : row.status === 'PARTIAL' ? 'Partial' : 'Upcoming'}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-800">{row.monthLabel}</p>
      <p className="text-lg font-bold tabular-nums text-slate-900">
        {rs(paid ? row.paidAmount || row.grossDue : row.totalDue)}
      </p>
    </button>
  );
}
