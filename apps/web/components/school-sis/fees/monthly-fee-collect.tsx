'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import {
  collectMonthlyFee,
  downloadMonthlyFeeReceiptPdf,
  fetchMonthlyFeeLedger,
  fetchSchoolSisStudents,
  printMonthlyFeeReceipt,
  sendMonthlyFeeReceipt,
  type MonthlyFeeLedgerRow,
} from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { MonthlyFeeReceiptCard } from './monthly-fee-receipt-card';
import { FeeStatusBadge, MonthlyFeeSubnav, currentFeeMonth, rs } from './monthly-fee-ui';

const JUNIOR = new Set(['NURSERY', 'LKG', 'UKG', 'I', 'II', 'III', 'IV']);
const METHOD_LABEL: Record<string, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK: 'Bank Transfer',
  CHEQUE: 'Cheque',
  ONLINE: 'Online Payment',
  OTHER: 'Other',
};

export function MonthlyFeeCollect() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
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

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const students = useQuery({
    queryKey: ['school-sis-students', debounced],
    queryFn: () => fetchSchoolSisStudents({ q: debounced || undefined, status: 'ACTIVE' }),
    enabled,
  });
  const junior = useMemo(
    () =>
      (students.data ?? []).filter((s) => JUNIOR.has(s.enrollments[0]?.section.grade.code ?? '')),
    [students.data],
  );
  const ledger = useQuery({
    queryKey: ['monthly-fee-ledger', studentId],
    queryFn: () => fetchMonthlyFeeLedger(studentId),
    enabled: Boolean(studentId),
  });

  const dueRows = ledger.data?.rows.filter((r) => r.selectable) ?? [];
  const selectedRows = (ledger.data?.rows ?? []).filter((r) => selected.includes(r.feeMonth));
  const gross = selectedRows.reduce((s, r) => s + r.totalDue, 0);
  const tuition = selectedRows.reduce((s, r) => s + r.tuitionAmount, 0);
  const other = selectedRows.reduce((s, r) => s + r.otherAmount, 0);
  const late = selectedRows.reduce((s, r) => s + r.lateFeeAmount, 0);
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
  const canCollect =
    canManage &&
    selected.length > 0 &&
    paying > 0 &&
    concessionReady &&
    (selected.length === 1 || paying === net);

  useEffect(() => {
    setAmountPaying((prev) => {
      if (prev === '') return prev;
      const n = Math.round(Number(prev) || 0);
      if (n > net) return net ? String(net) : '';
      return prev;
    });
  }, [net]);

  function toggle(month: string) {
    setSelected((cur) =>
      cur.includes(month) ? cur.filter((m) => m !== month) : [...cur, month].sort(),
    );
    setSuccess(null);
  }

  const book = ledger.data;

  return (
    <div className="space-y-5">
      <MonthlyFeeSubnav />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Monthly fee collection</h1>
        <p className="text-sm text-slate-500">
          Select a student, tick the months they owe, then collect one receipt.
        </p>
      </div>
      {error ? (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Search student
          <input
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, admission no., class, section or parent mobile"
          />
        </label>
        <div className="mt-3 max-h-52 overflow-auto rounded-xl border border-slate-100">
          {students.isLoading ? <p className="p-3 text-sm text-slate-500">Searching…</p> : null}
          {!students.isLoading && !junior.length ? (
            <p className="p-3 text-sm text-slate-500">No Nursery–IV students match that search.</p>
          ) : null}
          {junior.slice(0, 30).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setStudentId(s.id);
                setSelected([]);
                setSuccess(null);
                setAmountPaying('');
                setError(null);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${studentId === s.id ? 'bg-sky-50' : ''}`}
            >
              <span>
                <span className="font-medium">{s.fullName}</span>
                <span className="ml-2 text-xs text-slate-400">
                  {s.guardians[0]?.guardian.phone || s.phone || ''}
                </span>
              </span>
              <span className="text-xs text-slate-500">
                {s.admissionNumber} · {s.enrollments[0]?.section.grade.name}{' '}
                {s.enrollments[0]?.section.name}
              </span>
            </button>
          ))}
        </div>
      </section>

      {book ? (
        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <p className="text-lg font-semibold text-[#1a365d]">{book.student.fullName}</p>
            <p className="text-sm text-slate-500">
              {book.student.admissionNumber} · {book.className} {book.sectionName} ·{' '}
              {book.academicYear.name}
            </p>
          </div>
          <Stat label="Total outstanding" value={rs(book.totalOutstanding)} />
          <Stat label="Unpaid months" value={String(book.unpaidMonths)} />
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Current month</p>
            <FeeStatusBadge status={book.currentMonthStatus} />
            <p className="mt-1 text-xs text-slate-500">
              Last receipt {book.lastReceiptNumber ?? '—'}
              {book.lastPaymentDate
                ? ` · ${new Date(book.lastPaymentDate).toLocaleDateString('en-IN')}`
                : ''}
            </p>
          </div>
        </section>
      ) : (
        <p className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-slate-500">
          Select a Nursery–IV student to open the month-wise ledger.
        </p>
      )}

      {ledger.isLoading ? <p className="text-sm text-slate-500">Loading fee ledger…</p> : null}

      {book ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <h2 className="text-sm font-semibold">Fee due summary</h2>
              <div className="flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1"
                  onClick={() => setSelected(dueRows.map((r) => r.feeMonth))}
                >
                  Pay all due
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1"
                  onClick={() => {
                    const row = book.rows.find((r) => r.feeMonth === current && r.selectable);
                    setSelected(row ? [row.feeMonth] : []);
                  }}
                >
                  Pay current month
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1"
                  onClick={() =>
                    setSelected(dueRows.filter((r) => r.feeMonth <= current).map((r) => r.feeMonth))
                  }
                >
                  Select up to current
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={
                          dueRows.length > 0 && dueRows.every((r) => selected.includes(r.feeMonth))
                        }
                        onChange={(e) =>
                          setSelected(e.target.checked ? dueRows.map((r) => r.feeMonth) : [])
                        }
                      />
                    </th>
                    <th className="px-3 py-2">Month</th>
                    <th className="px-3 py-2">Tuition</th>
                    <th className="px-3 py-2">Other</th>
                    <th className="px-3 py-2">Late fee</th>
                    <th className="px-3 py-2">Total due</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {book.rows.map((row) => (
                    <MonthRow
                      key={row.feeMonth}
                      row={row}
                      checked={selected.includes(row.feeMonth)}
                      onToggle={() => toggle(row.feeMonth)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-20 h-fit">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold">Payment summary</h2>
              <p className="mt-1 text-xs text-slate-500">
                {selectedRows.length
                  ? selectedRows.map((r) => r.monthLabel).join(' + ')
                  : 'No months selected'}
              </p>
              <dl className="mt-3 space-y-1 text-sm">
                <Line label="Tuition fees" value={rs(tuition)} />
                <Line label="Other fees" value={rs(other)} />
                <Line label="Late fees" value={rs(late)} />
                <Line label="Concession" value={`− ${rs(discount)}`} />
              </dl>
              <p className="mt-3 text-3xl font-semibold tabular-nums text-[var(--school-erp-primary)]">
                {rs(net)}
              </p>
              <p className="text-xs text-slate-400">Gross {rs(gross)} → Net payable</p>
              {selectedRows
                .filter((r) => r.lateApplies)
                .map((r) => (
                  <p key={r.feeMonth} className="mt-2 text-xs text-rose-700">
                    {r.lateReason}
                  </p>
                ))}
            </section>

            <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <label className="block text-sm">
                Payment method
                <select
                  className="mt-1 h-11 w-full rounded-xl border px-3"
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
              </label>
              {mode === 'UPI' || mode === 'ONLINE' ? (
                <input
                  className="h-11 w-full rounded-xl border px-3 text-sm"
                  placeholder="Transaction ID"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              ) : null}
              {mode === 'BANK' ? (
                <input
                  className="h-11 w-full rounded-xl border px-3 text-sm"
                  placeholder="Bank reference number"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              ) : null}
              {mode === 'CHEQUE' ? (
                <>
                  <input
                    className="h-11 w-full rounded-xl border px-3 text-sm"
                    placeholder="Cheque number"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                  />
                  <input
                    className="h-11 w-full rounded-xl border px-3 text-sm"
                    placeholder="Bank"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                  />
                </>
              ) : null}
              {mode === 'OTHER' ? (
                <input
                  className="h-11 w-full rounded-xl border px-3 text-sm"
                  placeholder="Reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              ) : null}

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Concession</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    className="h-10 rounded-lg border px-2 text-sm"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'AMOUNT' | 'PERCENT')}
                  >
                    <option value="AMOUNT">Fixed ₹</option>
                    <option value="PERCENT">Percent %</option>
                  </select>
                  <input
                    className="h-10 rounded-lg border px-2 text-sm"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                  />
                </div>
                {discount > 0 ? (
                  <>
                    <input
                      className="mt-2 h-10 w-full rounded-lg border px-2 text-sm"
                      placeholder="Concession reason"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                    />
                    <input
                      className="mt-2 h-10 w-full rounded-lg border px-2 text-sm"
                      placeholder="Approved by"
                      value={approvedBy}
                      onChange={(e) => setApprovedBy(e.target.value)}
                    />
                    {!concessionReady ? (
                      <p className="mt-2 text-xs text-rose-700">
                        Reason and approver are required for a concession.
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">
                        {rs(discount)} will reduce the billed months; cash collected stays{' '}
                        {rs(paying)}.
                      </p>
                    )}
                  </>
                ) : null}
              </div>

              {selectedRows.some((r) => r.lateFeeAmount > 0) ? (
                <label className="block text-sm">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={waiveLate}
                    onChange={(e) => setWaiveLate(e.target.checked)}
                  />
                  Override late fee
                  {waiveLate ? (
                    <input
                      className="mt-2 h-10 w-full rounded-lg border px-2"
                      placeholder="Mandatory reason"
                      value={lateReason}
                      onChange={(e) => setLateReason(e.target.value)}
                    />
                  ) : null}
                </label>
              ) : null}

              <label className="block text-sm">
                Amount paying
                <input
                  className="mt-1 h-11 w-full rounded-xl border px-3 text-lg font-semibold tabular-nums"
                  value={amountPaying}
                  placeholder={String(net)}
                  onChange={(e) => setAmountPaying(e.target.value)}
                />
              </label>
              {selected.length === 1 && paying < net ? (
                <p className="text-xs text-amber-700">
                  Partial payment. Remaining on {selectedRows[0]?.monthLabel}: {rs(remaining)}
                </p>
              ) : selected.length > 1 && paying !== net ? (
                <p className="text-xs text-rose-700">
                  Multi-month receipts must be paid in full so each month stays unambiguous.
                </p>
              ) : null}

              {canManage ? (
                <button
                  type="button"
                  disabled={!canCollect}
                  className="h-11 w-full rounded-xl bg-[var(--school-erp-primary)] text-sm font-medium text-white disabled:opacity-40"
                  onClick={() => setConfirmOpen(true)}
                >
                  Review & collect {rs(paying)}
                </button>
              ) : null}
            </section>
          </aside>
        </div>
      ) : null}

      {book?.history.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Payment history</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase text-slate-400">
                  <th className="px-2 py-1">Date</th>
                  <th className="px-2 py-1">Receipt</th>
                  <th className="px-2 py-1">Months</th>
                  <th className="px-2 py-1">Amount</th>
                  <th className="px-2 py-1">Mode</th>
                  <th className="px-2 py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {book.history.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-2 py-2">{new Date(row.paidAt).toLocaleString('en-IN')}</td>
                    <td className="px-2 py-2">
                      <Link
                        className="text-[var(--school-erp-primary)]"
                        href={`/admin/school-sis/fees/receipts/${row.id}`}
                      >
                        {row.receiptNumber}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{row.months.join(', ')}</td>
                    <td className="px-2 py-2 tabular-nums">{rs(row.amount)}</td>
                    <td className="px-2 py-2">{row.paymentMode}</td>
                    <td className="px-2 py-2">
                      <FeeStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {success && book ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-semibold text-emerald-800">
            Payment successful · Receipt {success.receiptNumber}
          </p>
          <p className="text-sm text-emerald-700">Fee months paid: {success.months.join(', ')}</p>
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
              onClick={() => void downloadMonthlyFeeReceiptPdf(success.id, success.receiptNumber)}
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

      {confirmOpen && book ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Confirm fee payment</h3>
            <p className="mt-2 text-sm">{book.student.fullName}</p>
            <p className="text-sm text-slate-500">
              {book.className} {book.sectionName} · {book.academicYear.name}
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
            <p className="mt-1 text-2xl font-semibold tabular-nums">{rs(paying)}</p>
            <p className="text-xs text-slate-500">Cash collected · Net payable {rs(net)}</p>
            <p className="text-sm text-slate-500">Payment mode: {METHOD_LABEL[mode] ?? mode}</p>
            <div className="mt-4 flex justify-end gap-2">
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
                className="rounded-xl bg-[var(--school-erp-primary)] px-4 py-2 text-sm text-white disabled:opacity-40"
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[#1a365d]">{value}</p>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function MonthRow({
  row,
  checked,
  onToggle,
}: {
  row: MonthlyFeeLedgerRow;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-3 py-2">
        <input type="checkbox" disabled={!row.selectable} checked={checked} onChange={onToggle} />
      </td>
      <td className="px-3 py-2 font-medium">{row.monthLabel}</td>
      <td className="px-3 py-2 tabular-nums">{rs(row.tuitionAmount)}</td>
      <td className="px-3 py-2 tabular-nums">{rs(row.otherAmount)}</td>
      <td className="px-3 py-2 tabular-nums">{rs(row.lateFeeAmount)}</td>
      <td className="px-3 py-2 font-semibold tabular-nums">{rs(row.totalDue)}</td>
      <td className="px-3 py-2">
        <FeeStatusBadge status={row.status} />
      </td>
    </tr>
  );
}
