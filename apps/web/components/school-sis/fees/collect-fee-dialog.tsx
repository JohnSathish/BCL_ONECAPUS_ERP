'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  CheckCircle2,
  FileText,
  Globe,
  Landmark,
  Loader2,
  Smartphone,
  Wallet,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/utils/cn';
import { apiErrorMessage } from '@/utils/api-error';
import {
  collectMonthlyFee,
  downloadMonthlyFeeReceiptPdf,
  fetchMonthlyFeeConfig,
  printMonthlyFeeReceipt,
  startSchoolOnlineCheckout,
  verifySchoolOnlinePayment,
} from '@/services/school-sis';
import { rs } from './monthly-fee-ui';

export type CollectFeeStudent = {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  className: string;
  sectionName: string;
  tuitionAmount: number;
  otherAmount?: number;
  previousBalance?: number;
  lateFeeAmount: number;
  totalDue: number;
  feeMonth?: string;
  monthLabel?: string;
};

const METHOD_META: Record<string, { label: string; hint: string; icon: typeof Wallet }> = {
  CASH: { label: 'Cash', hint: 'Pay at counter', icon: Banknote },
  UPI: { label: 'UPI', hint: 'Manual UPI', icon: Smartphone },
  BANK: { label: 'Bank', hint: 'Bank transfer', icon: Landmark },
  CHEQUE: { label: 'Cheque', hint: 'Cheque payment', icon: FileText },
  OTHER: { label: 'Other', hint: 'Other reference', icon: Wallet },
  ONLINE: { label: 'Online', hint: 'Pay online', icon: Globe },
};

function friendlyCollectError(err: unknown) {
  const raw = apiErrorMessage(err);
  if (/already paid|already recorded/i.test(raw)) return 'Payment already recorded.';
  if (/exceed/i.test(raw)) return 'Payment amount exceeds the outstanding amount.';
  if (/insufficient cash/i.test(raw)) return 'Insufficient cash received.';
  if (/UPI reference/i.test(raw)) return 'UPI reference number is required.';
  if (/Cheque number/i.test(raw)) return 'Cheque number is required.';
  if (/not enabled/i.test(raw)) return 'That payment method is not enabled.';
  if (/unavailable|no active default/i.test(raw)) {
    return 'Online payment is currently unavailable.';
  }
  if (/prisma|internal|ECONN|500/i.test(raw)) {
    return 'Unable to record payment. Please try again.';
  }
  return raw || 'Unable to record payment. Please try again.';
}

function rupeesInput(value: string) {
  const n = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function CollectFeeDialog({
  open,
  onOpenChange,
  student,
  feeMonth,
  monthLabel,
  academicYear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: CollectFeeStudent | null;
  feeMonth: string;
  monthLabel: string;
  academicYear?: string;
}) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.session?.user);
  const collector = user?.displayName || user?.email || 'Office';
  const config = useQuery({
    queryKey: ['monthly-fee-config'],
    queryFn: fetchMonthlyFeeConfig,
    enabled: open,
  });
  const methods = (
    config.data?.settings.paymentMethods?.length
      ? config.data.settings.paymentMethods
      : ['CASH', 'UPI', 'BANK', 'CHEQUE', 'OTHER']
  ).filter((m) => METHOD_META[m]);
  const due = student?.totalDue ?? 0;
  const [mode, setMode] = useState('CASH');
  const [amount, setAmount] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [reference, setReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [instrumentDate, setInstrumentDate] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerMobile, setPayerMobile] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{
    id: string;
    receiptNumber: string;
  } | null>(null);

  useEffect(() => {
    if (!open || !student) return;
    setMode(methods.includes('CASH') ? 'CASH' : methods[0] || 'CASH');
    setAmount(String(student.totalDue));
    setCashReceived(String(student.totalDue));
    setReference('');
    setBankName('');
    setChequeNumber('');
    setInstrumentDate('');
    setPayerName('');
    setPayerMobile('');
    setNotes('');
    setError(null);
    setBusy(false);
    setSuccess(null);
  }, [open, student?.studentId, student?.totalDue]);

  useEffect(() => {
    if (!open || !methods.length) return;
    if (!methods.includes(mode)) setMode(methods[0]);
  }, [open, methods, mode]);

  const paying = rupeesInput(amount) || due;
  const remaining = Math.max(0, due - paying);
  const received = rupeesInput(cashReceived);
  const change = Math.max(0, received - paying);
  const onlineOk = Boolean(config.data?.onlinePayments?.available);

  const canSubmit = useMemo(() => {
    if (!student || busy) return false;
    if (paying <= 0) return false;
    if (paying > due) return false;
    if (mode === 'CASH' && received < paying) return false;
    if (mode === 'UPI' && !reference.trim()) return false;
    if (mode === 'BANK' && !reference.trim()) return false;
    if (mode === 'CHEQUE' && !chequeNumber.trim()) return false;
    if (mode === 'OTHER' && !reference.trim()) return false;
    if (mode === 'ONLINE' && !onlineOk) return false;
    return true;
  }, [student, busy, paying, due, mode, received, reference, chequeNumber, onlineOk]);

  const confirmLabel =
    mode === 'UPI'
      ? 'Confirm UPI Payment'
      : mode === 'CHEQUE'
        ? 'Record Cheque Payment'
        : mode === 'ONLINE'
          ? 'Proceed to Payment'
          : mode === 'BANK'
            ? 'Confirm Bank Transfer'
            : `Confirm & Collect ${rs(paying)}`;

  async function submit() {
    if (!student || !canSubmit) {
      if (paying > due) setError('Payment amount cannot exceed the outstanding amount.');
      else if (mode === 'CASH' && received < paying) setError('Insufficient cash received.');
      else if (mode === 'UPI' && !reference.trim()) setError('UPI reference number is required.');
      else if (mode === 'CASH' && !cashReceived.trim())
        setError('Please enter the amount received.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'ONLINE') {
        const session = await startSchoolOnlineCheckout({
          studentId: student.studentId,
          months: [student.feeMonth || feeMonth],
          amountPaying: paying,
        });
        const checkout = session.checkout as {
          mode?: string;
          keyId?: string;
          amount?: number;
        };
        if (checkout.mode === 'RAZORPAY') {
          await new Promise<void>((resolve, reject) => {
            const go = () => {
              const Razorpay = (
                window as unknown as {
                  Razorpay: new (opts: object) => { open: () => void };
                }
              ).Razorpay;
              const rzp = new Razorpay({
                key: checkout.keyId,
                amount: checkout.amount,
                currency: session.currency,
                order_id: session.orderId,
                name: session.gatewayName,
                handler: (resp: {
                  razorpay_order_id: string;
                  razorpay_payment_id: string;
                  razorpay_signature: string;
                }) => {
                  void verifySchoolOnlinePayment({
                    orderId: resp.razorpay_order_id,
                    paymentId: resp.razorpay_payment_id,
                    signature: resp.razorpay_signature,
                  })
                    .then((res: { payment?: { id: string }; receiptNumber?: string }) => {
                      setSuccess({
                        id: String(res.payment?.id ?? ''),
                        receiptNumber: String(res.receiptNumber ?? ''),
                      });
                      resolve();
                    })
                    .catch(reject);
                },
              });
              rzp.open();
            };
            if ((window as unknown as { Razorpay?: unknown }).Razorpay) {
              go();
              return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => go();
            script.onerror = () => reject(new Error('Could not load Razorpay'));
            document.body.appendChild(script);
          });
        } else {
          throw new Error('Online payment is currently unavailable.');
        }
      } else {
        const res = await collectMonthlyFee({
          studentId: student.studentId,
          feeMonth: student.feeMonth || feeMonth,
          paymentMode: mode,
          amountPaying: paying,
          reference: reference.trim() || undefined,
          chequeNumber: chequeNumber.trim() || undefined,
          bankName: bankName.trim() || undefined,
          cashReceived: mode === 'CASH' ? received : undefined,
          payerName: payerName.trim() || undefined,
          payerMobile: payerMobile.trim() || undefined,
          instrumentDate: instrumentDate || undefined,
          notes: notes.trim() || undefined,
          channel: 'OFFICE',
        });
        setSuccess({
          id: res.payment.id,
          receiptNumber: res.receiptNumber,
        });
      }
      await qc.invalidateQueries({ queryKey: ['monthly-fee-pending'] });
      await qc.invalidateQueries({ queryKey: ['monthly-fee-register'] });
      await qc.invalidateQueries({ queryKey: ['user-wise-collection'] });
    } catch (err) {
      setError(friendlyCollectError(err));
    } finally {
      setBusy(false);
    }
  }

  const tuition = student?.tuitionAmount ?? 0;
  const other = student?.otherAmount ?? 0;
  const arrears = student?.previousBalance ?? 0;
  const late = student?.lateFeeAmount ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="mb-0 border-b border-slate-100 px-6 py-4">
          <DialogTitle className="text-[#1e3a8a]">Collect Fee</DialogTitle>
          <DialogDescription>Record a payment for this student.</DialogDescription>
        </DialogHeader>

        {!student ? null : success ? (
          <div className="space-y-4 overflow-y-auto px-6 py-6">
            <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-center ring-1 ring-emerald-100">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="mt-2 text-lg font-semibold text-emerald-800">Payment Successful</p>
              <p className="text-sm text-emerald-700">Receipt {success.receiptNumber}</p>
            </div>
            <dl className="grid gap-2 text-sm">
              <Row label="Student" value={student.fullName} />
              <Row label="Admission No." value={student.admissionNumber} />
              <Row label="Fee" value={student.monthLabel || monthLabel} />
              <Row label="Amount" value={rs(paying)} />
              <Row label="Payment Mode" value={mode} />
              <Row label="Collected By" value={collector} />
            </dl>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/school-sis/fees/receipts/${success.id}`}
                className="inline-flex h-10 items-center rounded-xl bg-[#1e3a8a] px-4 text-sm font-semibold text-white"
              >
                View Receipt
              </Link>
              <button
                type="button"
                className="h-10 rounded-xl px-4 text-sm font-semibold ring-1 ring-slate-200"
                onClick={() => void printMonthlyFeeReceipt(success.id)}
              >
                Print Receipt
              </button>
              <button
                type="button"
                className="h-10 rounded-xl px-4 text-sm font-semibold ring-1 ring-slate-200"
                onClick={() => void downloadMonthlyFeeReceiptPdf(success.id, success.receiptNumber)}
              >
                Download PDF
              </button>
              <button
                type="button"
                className="h-10 rounded-xl px-4 text-sm text-slate-600"
                onClick={() => onOpenChange(false)}
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
              <section className="rounded-2xl bg-[#f8fafc] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Student information
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{student.fullName}</p>
                <p className="text-sm text-slate-500">
                  {student.admissionNumber} · {student.className} {student.sectionName}
                  {academicYear ? ` · ${academicYear}` : ''}
                </p>
              </section>

              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Fee summary
                </p>
                <dl className="mt-2 space-y-1 text-sm">
                  <Row
                    label={`Tuition (${student.monthLabel || monthLabel})`}
                    value={rs(tuition)}
                  />
                  {other ? <Row label="Computer / other" value={rs(other)} /> : null}
                  <Row label="Arrears" value={rs(arrears)} />
                  <Row label="Late fee" value={rs(late)} />
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-[#1e3a8a]">
                    <span>Total due</span>
                    <span>{rs(due)}</span>
                  </div>
                </dl>
              </section>

              <section>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Payment method
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {methods.map((m) => {
                    const meta = METHOD_META[m];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={cn(
                          'rounded-2xl px-3 py-3 text-left ring-1 transition',
                          mode === m
                            ? 'bg-[#eff6ff] ring-[#2563eb] shadow-sm'
                            : 'bg-white ring-slate-200 hover:bg-slate-50',
                        )}
                      >
                        <Icon className="h-4 w-4 text-[#2563eb]" />
                        <p className="mt-1 text-sm font-semibold">{meta.label}</p>
                        <p className="text-[11px] text-slate-500">{meta.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Payment details
                </p>
                <label className="block text-sm font-medium">
                  Amount to collect
                  <input
                    className="mt-1 h-11 w-full rounded-xl border px-3 font-semibold tabular-nums"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                {paying > due ? (
                  <p className="text-sm text-rose-600">
                    Payment amount cannot exceed the outstanding amount.
                  </p>
                ) : remaining > 0 ? (
                  <p className="text-sm text-amber-700">Remaining balance: {rs(remaining)}</p>
                ) : null}

                {mode === 'CASH' ? (
                  <>
                    <label className="block text-sm font-medium">
                      Cash received
                      <input
                        className="mt-1 h-11 w-full rounded-xl border px-3 font-semibold tabular-nums"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                      />
                    </label>
                    {received < paying ? (
                      <p className="text-sm text-rose-600">Insufficient cash received.</p>
                    ) : (
                      <p className="text-sm text-slate-600">
                        Change to return: <b>{rs(change)}</b>
                      </p>
                    )}
                  </>
                ) : null}

                {mode === 'UPI' ? (
                  <>
                    <label className="block text-sm font-medium">
                      UPI transaction / reference number
                      <input
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Payer name (optional)
                      <input
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Payer mobile (optional)
                      <input
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={payerMobile}
                        onChange={(e) => setPayerMobile(e.target.value)}
                      />
                    </label>
                  </>
                ) : null}

                {mode === 'BANK' ? (
                  <>
                    <label className="block text-sm font-medium">
                      Bank transaction reference
                      <input
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Transaction date
                      <input
                        type="date"
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={instrumentDate}
                        onChange={(e) => setInstrumentDate(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Bank name
                      <input
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Remarks
                      <input
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </label>
                  </>
                ) : null}

                {mode === 'CHEQUE' ? (
                  <>
                    <label className="block text-sm font-medium">
                      Cheque number
                      <input
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={chequeNumber}
                        onChange={(e) => setChequeNumber(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Bank name
                      <input
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Cheque date
                      <input
                        type="date"
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={instrumentDate}
                        onChange={(e) => setInstrumentDate(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Payer name
                      <input
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={payerName}
                        onChange={(e) => setPayerName(e.target.value)}
                      />
                    </label>
                    <p className="text-xs text-slate-500">
                      Cheques are recorded as paid when collected, matching existing office
                      practice.
                    </p>
                  </>
                ) : null}

                {mode === 'OTHER' ? (
                  <>
                    <label className="block text-sm font-medium">
                      Payment reference
                      <input
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      Remarks
                      <input
                        className="mt-1 h-11 w-full rounded-xl border px-3"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </label>
                  </>
                ) : null}

                {mode === 'ONLINE' ? (
                  onlineOk ? (
                    <p className="rounded-xl bg-[#eff6ff] px-3 py-2 text-sm text-slate-600">
                      Payment will open {config.data?.onlinePayments?.gatewayName}. The fee is
                      marked paid only after the gateway is verified on the server.
                    </p>
                  ) : (
                    <div className="rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-900 ring-1 ring-amber-100">
                      <p className="font-semibold">Online Payment Unavailable</p>
                      <p>
                        No active default payment gateway has been configured. Please contact the
                        administrator.
                      </p>
                    </div>
                  )
                ) : null}

                {error ? <p className="text-sm text-rose-600">{error}</p> : null}

                <section className="rounded-2xl bg-slate-50 p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Payment summary
                  </p>
                  <dl className="mt-2 space-y-1">
                    <Row label="Amount to pay" value={rs(paying)} />
                    <Row label="Payment method" value={mode} />
                    {mode === 'CASH' ? <Row label="Cash received" value={rs(received)} /> : null}
                    {mode === 'CASH' ? <Row label="Change" value={rs(change)} /> : null}
                    <Row label="Collected by" value={collector} />
                    <Row
                      label="Date"
                      value={new Date().toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    />
                  </dl>
                </section>
              </section>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-6 py-3">
              <button
                type="button"
                className="h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200"
                onClick={() => onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1e3a8a] px-5 text-sm font-semibold text-white disabled:opacity-40"
                onClick={() => void submit()}
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {mode === 'ONLINE'
                      ? 'Creating secure payment session...'
                      : 'Processing payment...'}
                  </>
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
