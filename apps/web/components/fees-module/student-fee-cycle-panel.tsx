'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarRange,
  CheckCircle2,
  CreditCard,
  Download,
  IndianRupee,
  Loader2,
} from 'lucide-react';
import {
  fetchFeeSettings,
  fetchMyFeeAccount,
  initiateMyFeePayment,
  openFeeReceiptPdf,
  simulateFeePayment,
  verifyFeePayment,
} from '@/services/fee-cycle';
import type { PayableFeeItem } from '@/types/fee-cycle';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { apiErrorMessage } from '@/utils/api-error';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (
        event: string,
        handler: (response: { error?: { description?: string } }) => void,
      ) => void;
    };
  }
}

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function loadRazorpayScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${CHECKOUT_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')));
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
}

export function StudentFeeCyclePanel() {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [payMsg, setPayMsg] = useState('');
  const [paySuccess, setPaySuccess] = useState(false);

  const accountQ = useQuery({
    queryKey: ['my-fee-account'],
    queryFn: fetchMyFeeAccount,
  });
  const settingsQ = useQuery({
    queryKey: ['fee-settings'],
    queryFn: fetchFeeSettings,
  });

  const account = accountQ.data;
  const payables = account?.payableItems ?? [];

  useEffect(() => {
    if (!payables.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(payables.map((p) => p.id)));
  }, [account?.studentId, payables.map((p) => p.id).join(',')]);

  const selectedTotal = useMemo(
    () => payables.filter((p) => selectedIds.has(p.id)).reduce((s, p) => s + p.amount, 0),
    [payables, selectedIds],
  );

  const verifyMut = useMutation({
    mutationFn: verifyFeePayment,
    onSuccess: () => {
      setPaySuccess(true);
      setPayMsg('Payment received. Receipt will be sent by SMS and email.');
      void qc.invalidateQueries({ queryKey: ['my-fee-account'] });
    },
    onError: (e) => setPayMsg(apiErrorMessage(e, 'Payment verification failed')),
  });

  const openCheckout = useCallback(
    async (checkout: {
      keyId?: string;
      orderId: string;
      amount: number;
      currency: string;
      mode: string;
      paymentId?: string;
    }) => {
      if (checkout.mode === 'SAFE_MOCK' && checkout.paymentId) {
        const res = await simulateFeePayment(checkout.paymentId);
        setPaySuccess(true);
        setPayMsg(`Payment successful — receipt ${res.receipt?.receiptNo ?? 'issued'}.`);
        void accountQ.refetch();
        return;
      }

      if (!checkout.keyId) throw new Error('Online payment is not configured.');
      await loadRazorpayScript();
      if (!window.Razorpay) throw new Error('Razorpay checkout unavailable');

      return new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: checkout.keyId,
          amount: Math.round(checkout.amount * 100),
          currency: checkout.currency,
          name: 'College Fees',
          description: 'Outstanding fee payment',
          order_id: checkout.orderId,
          theme: { color: '#1a2b4b' },
          handler: (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            verifyMut.mutate(response, {
              onSuccess: () => resolve(),
              onError: (err) => reject(err),
            });
          },
          modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
        });
        rzp.on('payment.failed', (response) => {
          reject(new Error(response.error?.description ?? 'Payment failed'));
        });
        rzp.open();
      });
    },
    [accountQ, verifyMut],
  );

  const payMut = useMutation({
    mutationFn: () => {
      const demandIds = [
        ...new Set(payables.filter((p) => selectedIds.has(p.id)).map((p) => p.demandId)),
      ];
      if (!demandIds.length) throw new Error('Select at least one fee item.');
      return initiateMyFeePayment({
        amount: selectedTotal,
        provider: 'RAZORPAY',
        demandIds,
      });
    },
    onMutate: () => {
      setPayMsg('');
      setPaySuccess(false);
    },
    onSuccess: async (res) => {
      try {
        await openCheckout(res.checkout);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Payment failed';
        if (message !== 'Payment cancelled') setPayMsg(message);
      }
    },
    onError: (e) => setPayMsg(apiErrorMessage(e, 'Could not start payment')),
  });

  const onlineEnabled =
    settingsQ.data?.collectionModes?.gateway ?? settingsQ.data?.onlinePaymentEnabled;

  if (accountQ.isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Loading fee account…
      </div>
    );
  }

  if (!account?.studentId) return null;

  const pendingCycle = account.admissionCycles?.find(
    (c) => c.status === 'PENDING' || c.status === 'PARTIAL',
  );
  const tracker = account.monthlyTracker;

  const selectMonth = (demandId: string | null) => {
    if (!demandId) return;
    const item = payables.find((p) => p.demandId === demandId);
    if (item) setSelectedIds(new Set([item.id]));
  };

  const selectAdmissionPayables = () => {
    const ids = payables.filter((p) => /admission|session|cycle/i.test(p.label)).map((p) => p.id);
    if (ids.length) setSelectedIds(new Set(ids));
  };

  const selectMonthlyPayables = () => {
    const ids = payables.filter((p) => /monthly|tuition/i.test(p.label)).map((p) => p.id);
    if (ids.length) setSelectedIds(new Set(ids));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total due"
          value={formatInr(account.summary.totalDue ?? account.summary.outstanding)}
        />
        <SummaryCard
          label="Current due"
          value={formatInr(account.summary.outstanding)}
          tone="warn"
        />
        <SummaryCard
          label="Admission fee"
          value={account.admissionFeeStatus?.status ?? '—'}
          tone={account.admissionFeeStatus?.status === 'PENDING' ? 'warn' : undefined}
        />
        <SummaryCard
          label="Monthly fee"
          value={
            account.monthlyFeeStatus?.status === 'PAID'
              ? 'Clear'
              : `${account.monthlyTracker?.pendingMonths ?? 0} pending`
          }
          tone={account.monthlyFeeStatus?.status === 'PENDING' ? 'warn' : undefined}
        />
      </div>

      {payables.length > 0 ? (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <p className="mb-3 font-semibold">Outstanding fees</p>
          <div className="space-y-2">
            {payables.map((item) => (
              <PayableRow
                key={item.id}
                item={item}
                checked={selectedIds.has(item.id)}
                onToggle={() =>
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  })
                }
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-sm">
              Total selected: <strong>{formatInr(selectedTotal)}</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={selectAdmissionPayables}>
                Pay admission fee
              </Button>
              <Button variant="outline" size="sm" onClick={selectMonthlyPayables}>
                Pay monthly fees
              </Button>
              <Button
                disabled={
                  !onlineEnabled || payMut.isPending || verifyMut.isPending || selectedTotal <= 0
                }
                onClick={() => payMut.mutate()}
              >
                {payMut.isPending || verifyMut.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Pay now
                  </>
                )}
              </Button>
            </div>
          </div>
          {!onlineEnabled ? (
            <p className="mt-2 text-xs text-amber-800">
              {account.studentPortal?.officePaymentEnabled
                ? `Online payment is not available. Pay at the accounts office (${account.studentPortal.officeMethods.join(', ')}).`
                : 'Online payment is not available for this institution.'}
            </p>
          ) : account.studentPortal?.showPayAtOffice ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Pay online below, or visit the accounts office for{' '}
              {account.studentPortal.officeMethods.join(', ')}.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Secure checkout — Razorpay, UPI, net banking, or card.
            </p>
          )}
        </div>
      ) : account.summary.outstanding <= 0 ? (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>All fees are clear. No payment due.</p>
        </div>
      ) : null}

      {paySuccess || payMsg ? (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            paySuccess
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-800',
          )}
        >
          {payMsg}
        </div>
      ) : null}

      {pendingCycle ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
            Admission & session fee
          </p>
          <h3 className="mt-1 text-lg font-bold text-amber-950">{pendingCycle.cycleName}</h3>
          <p className="mt-1 flex items-center gap-2 text-sm text-amber-900">
            <CalendarRange className="h-4 w-4" />
            Covers {pendingCycle.covers}
          </p>
          <p className="mt-3 text-2xl font-bold">
            {formatInr(
              pendingCycle.balanceAmount ??
                pendingCycle.totalAmount ??
                pendingCycle.configuredAmount,
            )}
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 flex items-center gap-2 font-semibold">
          <IndianRupee className="h-4 w-4" />
          Admission fee cycles
        </p>
        <div className="space-y-2">
          {(account.admissionCycles ?? []).map((cycle) => (
            <div
              key={cycle.cycleId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{cycle.cycleName}</p>
                <p className="text-xs text-muted-foreground">{cycle.covers}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {formatInr(cycle.totalAmount ?? cycle.configuredAmount)}
                </p>
                <StatusBadge status={cycle.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 font-semibold">
          Monthly fee tracker {tracker ? `· ${tracker.year}` : ''}
        </p>
        {tracker?.months?.length ? (
          <>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-12">
              {tracker.months.map((m) => (
                <button
                  key={m.period}
                  type="button"
                  disabled={!m.payable}
                  onClick={() => selectMonth(m.demandId)}
                  className={cn(
                    'rounded-lg border px-1 py-2 text-center text-xs font-semibold transition',
                    m.status === 'PAID' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                    m.status === 'PENDING' &&
                      'border-amber-200 bg-amber-50 text-amber-900 hover:ring-2 hover:ring-primary/30',
                    m.status === 'NOT_GENERATED' && 'border-slate-200 bg-slate-50 text-slate-400',
                  )}
                >
                  {m.shortLabel}
                  <div className="text-[10px] font-normal">
                    {m.status === 'PAID' ? '✓' : m.status === 'PENDING' ? 'Due' : '—'}
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Tap a pending month to select it for payment. Paid {tracker.paidMonths} · Pending{' '}
              {tracker.pendingMonths}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No monthly demands yet.</p>
        )}
      </div>

      {(account.paymentHistory ?? []).length ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-3 font-semibold">Payment history</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="pb-2 pr-2">Date</th>
                  <th className="pb-2 pr-2">Fee</th>
                  <th className="pb-2 pr-2 text-right">Amount</th>
                  <th className="pb-2 pr-2">Mode</th>
                  <th className="pb-2">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {account.paymentHistory!.slice(0, 15).map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2 pr-2">
                      {new Date(row.paidAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-2 pr-2">{row.feeHeads.join(', ') || '—'}</td>
                    <td className="py-2 pr-2 text-right font-medium">{formatInr(row.amount)}</td>
                    <td className="py-2 pr-2">{row.paymentSourceLabel}</td>
                    <td className="py-2">
                      {row.receiptId ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void openFeeReceiptPdf(row.receiptId!)}
                        >
                          {row.receiptNo ?? 'PDF'}
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 font-semibold">Monthly fees (detail)</p>
        <div className="space-y-2">
          {(account.monthlyFees ?? []).length ? (
            account.monthlyFees.map((m) => (
              <div
                key={m.demandId}
                className="flex justify-between rounded-lg border px-3 py-2 text-sm"
              >
                <span>{m.monthLabel}</span>
                <span>
                  <StatusBadge status={m.status} /> · {formatInr(m.balanceAmount)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No monthly demands yet.</p>
          )}
        </div>
      </div>

      {(account.receipts ?? []).length ? (
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="mb-2 font-semibold">Recent receipts</p>
          <ul className="space-y-2 text-sm">
            {account.receipts.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2">
                <span>
                  {r.receiptNo} · {formatInr(r.amount)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void openFeeReceiptPdf(r.id)}
                  title="Open PDF to print"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PayableRow({
  item,
  checked,
  onToggle,
}: {
  item: PayableFeeItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 py-2">
      <input type="checkbox" className="mt-1" checked={checked} onChange={onToggle} />
      <div className="flex-1">
        <p className="font-medium">{item.label}</p>
        {item.fineAmount > 0 ? (
          <p className="text-xs text-rose-600">Includes late fine {formatInr(item.fineAmount)}</p>
        ) : null}
      </div>
      <span className="font-semibold">{formatInr(item.amount)}</span>
    </label>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warn' | 'danger';
}) {
  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3',
        tone === 'warn' && 'border-amber-200 bg-amber-50',
        tone === 'danger' && 'border-rose-200 bg-rose-50',
        !tone && 'bg-card',
      )}
    >
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
        status === 'PAID' && 'bg-emerald-100 text-emerald-800',
        status === 'PENDING' && 'bg-amber-100 text-amber-800',
        status === 'PARTIAL' && 'bg-orange-100 text-orange-800',
        status === 'NOT_GENERATED' && 'bg-slate-100 text-slate-600',
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}
