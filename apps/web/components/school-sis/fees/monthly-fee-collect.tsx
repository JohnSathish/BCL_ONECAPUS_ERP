'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';
import { collectMonthlyFee, fetchSchoolSisStudents, quoteMonthlyFee } from '@/services/school-sis';
import { apiErrorMessage } from '@/utils/api-error';
import { MonthlyFeeReceiptCard } from './monthly-fee-receipt-card';
import { MonthlyFeeSubnav, currentFeeMonth, rs } from './monthly-fee-ui';

const JUNIOR = new Set(['NURSERY', 'LKG', 'UKG', 'I', 'II', 'III', 'IV']);

export function MonthlyFeeCollect() {
  const enabled = useAuthQueryEnabled();
  const canManage = canManageSchoolSis(useAuthStore((s) => s.session?.user)?.permissions);
  const [q, setQ] = useState('');
  const [month, setMonth] = useState(currentFeeMonth());
  const [studentId, setStudentId] = useState('');
  const [mode, setMode] = useState('CASH');
  const [discount, setDiscount] = useState('0');
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ id: string; receiptNumber: string } | null>(null);
  const students = useQuery({
    queryKey: ['school-sis-students', q],
    queryFn: () => fetchSchoolSisStudents({ q: q || undefined, status: 'ACTIVE' }),
    enabled,
  });
  const junior = useMemo(
    () =>
      (students.data ?? []).filter((s) => JUNIOR.has(s.enrollments[0]?.section.grade.code ?? '')),
    [students.data],
  );
  const quote = useQuery({
    queryKey: ['monthly-fee-quote', studentId, month],
    queryFn: () => quoteMonthlyFee(studentId, month),
    enabled: Boolean(studentId && month),
  });

  return (
    <div className="space-y-5">
      <MonthlyFeeSubnav />
      <h1 className="text-2xl font-semibold">Collect monthly fee</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="space-y-3 rounded-2xl border bg-white p-4">
          <label className="block text-sm">
            Search student
            <input
              className="mt-1 h-11 w-full rounded-xl border px-3"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, admission no., class"
            />
          </label>
          <label className="block text-sm">
            Fee month
            <input
              type="month"
              className="mt-1 h-11 w-full rounded-xl border px-3"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
          <div className="max-h-64 overflow-auto rounded-xl border">
            {!junior.length && !students.isLoading ? (
              <p className="p-4 text-sm text-slate-500">
                No Nursery–IV students match that search.
              </p>
            ) : null}
            {junior.slice(0, 40).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setStudentId(s.id);
                  setReceipt(null);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${studentId === s.id ? 'bg-sky-50' : ''}`}
              >
                <span className="font-medium">{s.fullName}</span>
                <span className="text-xs text-slate-500">
                  {s.admissionNumber} · {s.enrollments[0]?.section.grade.name}{' '}
                  {s.enrollments[0]?.section.name}
                </span>
              </button>
            ))}
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-4">
          {!quote.data ? (
            <p className="text-sm text-slate-500">Select a Nursery–IV student to load fees.</p>
          ) : null}
          {quote.data ? (
            <div className="space-y-3">
              <p className="text-lg font-semibold">{quote.data.student.fullName}</p>
              <p className="text-sm text-slate-500">
                {quote.data.student.admissionNumber} · {quote.data.className}{' '}
                {quote.data.sectionName} · {quote.data.monthLabel}
              </p>
              {quote.data.paid ? (
                <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  Already paid · receipt {quote.data.payment?.receiptNumber}
                </p>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      Tuition <b className="float-right">{rs(quote.data.tuitionAmount)}</b>
                    </div>
                    <div>
                      Late fee <b className="float-right">{rs(quote.data.lateFeeAmount)}</b>
                    </div>
                    <div>
                      Other <b className="float-right">{rs(quote.data.otherAmount)}</b>
                    </div>
                    <div>
                      Arrears <b className="float-right">{rs(quote.data.previousBalance)}</b>
                    </div>
                  </dl>
                  <p className="text-3xl font-semibold tabular-nums text-[var(--school-erp-primary)]">
                    {rs(Math.max(0, quote.data.totalAmount - Number(discount || 0)))}
                  </p>
                  <select
                    className="h-11 w-full rounded-xl border px-3"
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    {(quote.data.settings.paymentMethods ?? ['CASH']).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    className="h-11 w-full rounded-xl border px-3"
                    placeholder="UPI / cheque / bank ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                  <input
                    className="h-11 w-full rounded-xl border px-3"
                    placeholder="Concession ₹"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                  {canManage ? (
                    <button
                      type="button"
                      className="h-11 w-full rounded-xl bg-[var(--school-erp-primary)] text-sm font-medium text-white"
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Record ${rs(Math.max(0, quote.data.totalAmount - Number(discount || 0)))} for ${quote.data.student.fullName}?`,
                          )
                        )
                          return;
                        void collectMonthlyFee({
                          studentId,
                          feeMonth: month,
                          paymentMode: mode,
                          reference: reference || undefined,
                          discountAmount: Number(discount || 0) || undefined,
                        })
                          .then((res) => {
                            setError(null);
                            setReceipt({ id: res.payment.id, receiptNumber: res.receiptNumber });
                            void quote.refetch();
                          })
                          .catch((err) => setError(apiErrorMessage(err)));
                      }}
                    >
                      Confirm payment
                    </button>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </section>
      </div>
      {receipt && quote.data ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-emerald-700">
            Payment saved. Receipt {quote.data.payment?.receiptNumber ?? receipt.receiptNumber}
          </p>
          <div className="grid gap-3 lg:grid-cols-2 print:grid-cols-2">
            {(["Parent's copy", 'School copy'] as const).map((copy) => (
              <MonthlyFeeReceiptCard
                key={copy}
                copy={copy}
                schoolName={quote.data.settings.schoolName || "St. Luke's Secondary School"}
                schoolAddress={quote.data.settings.schoolAddress || 'Walbakgre, New Tura'}
                monthLabel={quote.data.monthLabel}
                studentName={quote.data.student.fullName}
                admissionNumber={quote.data.student.admissionNumber}
                className={`${quote.data.className} ${quote.data.sectionName}`}
                receiptNumber={quote.data.payment?.receiptNumber ?? receipt.receiptNumber}
                academicYear={quote.data.academicYear?.name ?? ''}
                paidAt={new Date().toLocaleString('en-IN')}
                paymentMode={mode}
                tuition={quote.data.tuitionAmount}
                late={quote.data.lateFeeAmount}
                other={quote.data.otherAmount}
                discount={Number(discount || 0)}
                previous={quote.data.previousBalance}
                total={Math.max(0, quote.data.totalAmount - Number(discount || 0))}
                signatory={quote.data.settings.signatoryName}
                instructions={
                  quote.data.settings.instructionsJson?.length
                    ? quote.data.settings.instructionsJson
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
          <div className="flex gap-2">
            <a
              className="rounded-xl border bg-white px-3 py-2 text-sm"
              href={`/admin/school-sis/fees/receipts/${receipt.id}`}
            >
              Open receipt
            </a>
            <button
              type="button"
              className="rounded-xl border bg-white px-3 py-2 text-sm"
              onClick={() => window.print()}
            >
              Print
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
