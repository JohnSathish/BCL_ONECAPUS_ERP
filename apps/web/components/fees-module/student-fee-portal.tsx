'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  CreditCard,
  Download,
  Loader2,
  Lock,
  QrCode,
  Receipt,
  Upload,
  X,
} from 'lucide-react';
import {
  createMyPaymentRequest,
  fetchExternalPaymentSources,
  fetchMyFeeAccount,
  initiateMyFeePayment,
  openFeeReceiptPdf,
  simulateFeePayment,
  submitMyExternalPayment,
  uploadExternalPaymentAttachment,
  verifyFeePayment,
} from '@/services/fee-cycle';
import type {
  FeeDemandRow,
  MonthlyFeeTrackerMonth,
  PayableFeeItem,
  StudentFeeAccount,
  StudentFeeCycleStatus,
} from '@/types/fee-cycle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

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

function classifyPayable(item: PayableFeeItem) {
  const text = `${item.label} ${item.demandType ?? ''}`.toLowerCase();
  if (/monthly|tuition/.test(text)) return 'monthly';
  if (/admission|session|cycle/.test(text)) return 'admission';
  return 'other';
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

export function StudentFeePortal() {
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [payMsg, setPayMsg] = useState('');
  const [paySuccess, setPaySuccess] = useState(false);
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [qrCheckout, setQrCheckout] = useState<{
    qrImageUrl?: string | null;
    amount: number;
  } | null>(null);

  const accountQ = useQuery({ queryKey: ['my-fee-account'], queryFn: fetchMyFeeAccount });
  const sourcesQ = useQuery({
    queryKey: ['external-payment-sources'],
    queryFn: fetchExternalPaymentSources,
  });

  const account = accountQ.data;
  const payables = account?.payableItems ?? [];
  const allowAdvance = account?.studentPortal?.allowAdvanceMonthlyPayment ?? false;

  const payableByDemandId = useMemo(() => {
    const map = new Map<string, PayableFeeItem>();
    for (const p of payables) map.set(p.demandId, p);
    return map;
  }, [payables]);

  const pendingTrackerMonths = useMemo(
    () => account?.monthlyTracker?.months.filter((m) => m.status === 'PENDING') ?? [],
    [account?.monthlyTracker?.months],
  );

  const selectedItems = useMemo(
    () => payables.filter((p) => selectedIds.has(p.id)),
    [payables, selectedIds],
  );
  const selectedTotal = useMemo(
    () => selectedItems.reduce((s, p) => s + p.amount, 0),
    [selectedItems],
  );
  const selectedDemandIds = useMemo(
    () => [...new Set(selectedItems.map((p) => p.demandId))],
    [selectedItems],
  );

  const admissionPayables = payables.filter((p) => classifyPayable(p) === 'admission');
  const otherPayables = payables.filter((p) => classifyPayable(p) === 'other');

  const currentCycle =
    account?.admissionCycles?.find((c) => c.status === 'PAID') ??
    account?.admissionCycles?.find((c) => c.status === 'PENDING' || c.status === 'PARTIAL') ??
    account?.admissionCycles?.[0];

  const nextPendingMonth = account?.monthlyTracker?.months?.find((m) => m.status === 'PENDING');
  const concession = account?.concessions?.[0];

  const feeCalculatorDemand = account?.demands?.find((d) =>
    String(d.demandType ?? '').includes('MONTHLY'),
  );

  const onlineEnabled = account?.collectionModes?.gateway ?? account?.studentPortal?.onlineEnabled;
  const qrEnabled = account?.collectionModes?.upi_qr;

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
          description: 'Fee payment',
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
    [verifyMut, accountQ],
  );

  const payMut = useMutation({
    mutationFn: () => {
      if (!selectedDemandIds.length) throw new Error('Select at least one fee item.');
      return initiateMyFeePayment({
        amount: selectedTotal,
        provider: 'RAZORPAY',
        demandIds: selectedDemandIds,
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

  const qrMut = useMutation({
    mutationFn: () => {
      if (!selectedDemandIds.length) throw new Error('Select at least one fee item.');
      return createMyPaymentRequest({ demandIds: selectedDemandIds, channel: 'OFFICE_QR' });
    },
    onSuccess: (res) => {
      setQrCheckout({ qrImageUrl: res.checkout.qrImageUrl, amount: res.checkout.amount });
      setPayMsg('Scan the QR code with any UPI app to pay.');
    },
    onError: (e) => setPayMsg(apiErrorMessage(e, 'Could not generate QR')),
  });

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setPayableSelection = (ids: string[], replace = true) => {
    setSelectedIds((prev) => (replace ? new Set(ids) : new Set([...prev, ...ids])));
  };

  const toggleDemand = (demandId: string) => {
    const item = payableByDemandId.get(demandId);
    if (!item) return;
    toggleItem(item.id);
  };

  const removeFromCart = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const selectCurrentMonth = () => {
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const month =
      account?.monthlyTracker?.months.find(
        (m) => m.period === currentPeriod && m.status === 'PENDING',
      ) ?? pendingTrackerMonths[0];
    if (!month?.demandId) return;
    const item = payableByDemandId.get(month.demandId);
    if (item) setPayableSelection([item.id]);
  };

  const selectQuarter = () => {
    const ids = pendingTrackerMonths
      .slice(0, 3)
      .map((m) => (m.demandId ? payableByDemandId.get(m.demandId)?.id : null))
      .filter((id): id is string => Boolean(id));
    if (ids.length) setPayableSelection(ids);
  };

  const selectAllPending = () => {
    const ids = pendingTrackerMonths
      .map((m) => (m.demandId ? payableByDemandId.get(m.demandId)?.id : null))
      .filter((id): id is string => Boolean(id));
    if (ids.length) setPayableSelection(ids);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const scrollToPayment = () => {
    document
      .getElementById('student-fee-payment-options')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (accountQ.isLoading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border bg-card p-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading your fee account…
      </div>
    );
  }

  if (!account?.studentId) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        No student fee profile linked to your account.
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24 lg:pb-4">
      <header className="rounded-2xl border bg-gradient-to-br from-primary/8 via-card to-card p-4 sm:p-5">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">My Fee Account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {account.student?.name ?? 'Student'}
          {account.student?.enrollmentNumber ? ` · ${account.student.enrollmentNumber}` : ''}
          {account.student?.program ? ` · ${account.student.program}` : ''}
        </p>
      </header>

      <DueAlerts account={account} />

      {(paySuccess || payMsg) && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3 text-sm',
            paySuccess
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-sky-200 bg-sky-50 text-sky-900',
          )}
        >
          {payMsg}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Admission & Session Fee"
          subtitle={currentCycle?.covers ?? 'Current cycle'}
          value={
            currentCycle
              ? formatInr(currentCycle.totalAmount ?? currentCycle.configuredAmount)
              : '—'
          }
          status={currentCycle?.status ?? '—'}
          statusTone={
            currentCycle?.status === 'PAID'
              ? 'good'
              : currentCycle?.status === 'PENDING'
                ? 'warn'
                : undefined
          }
        />
        <SummaryCard
          title="Monthly Fees"
          subtitle={`Paid ${account.monthlyTracker?.paidMonths ?? 0} · Pending ${account.monthlyTracker?.pendingMonths ?? 0}`}
          value={nextPendingMonth ? `Next: ${nextPendingMonth.label}` : 'All clear'}
          status={
            account.monthlyFeeStatus?.status === 'PAID'
              ? 'Clear'
              : `${account.monthlyTracker?.pendingMonths ?? 0} due`
          }
          statusTone={account.monthlyTracker?.pendingMonths ? 'warn' : 'good'}
        />
        <SummaryCard
          title="Total Outstanding"
          subtitle={
            nextPendingMonth
              ? `Next due month: ${nextPendingMonth.shortLabel}`
              : 'No pending months'
          }
          value={formatInr(account.summary.outstanding)}
          status={account.summary.outstanding > 0 ? 'Due' : 'Clear'}
          statusTone={account.summary.outstanding > 0 ? 'warn' : 'good'}
        />
        {concession || (account.summary.concessionTotal ?? 0) > 0 ? (
          <SummaryCard
            title="Scholarship / Concession"
            subtitle={concession?.schemeName ?? 'Approved concession'}
            value={formatInr(concession?.approvedAmount ?? account.summary.concessionTotal ?? 0)}
            status="Granted"
            statusTone="good"
            icon={Award}
          />
        ) : (
          <SummaryCard
            title="Payment Status"
            subtitle={
              account.lastPayment
                ? `Last paid ${new Date(account.lastPayment.issuedAt).toLocaleDateString('en-IN')}`
                : 'No payments yet'
            }
            value={account.summary.outstanding <= 0 ? 'All clear ✅' : 'Payment due'}
            statusTone={account.summary.outstanding <= 0 ? 'good' : 'warn'}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="space-y-4">
          <section className="rounded-2xl border bg-card p-4 sm:p-5">
            <h2 className="text-base font-semibold">Pending payments</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Select admission cycles and other charges below. Use the monthly calendar for tuition
              months.
            </p>

            {admissionPayables.length || otherPayables.length ? (
              <div className="mt-4 space-y-4">
                {admissionPayables.length ? (
                  <PayableGroup
                    title="Admission fee cycles"
                    items={admissionPayables}
                    selectedIds={selectedIds}
                    onToggle={toggleItem}
                  />
                ) : null}
                {otherPayables.length ? (
                  <PayableGroup
                    title="Other charges"
                    items={otherPayables}
                    selectedIds={selectedIds}
                    onToggle={toggleItem}
                  />
                ) : null}
              </div>
            ) : payables.length ? (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                Use the monthly fee calendar below to select tuition months for payment.
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                All fees are clear. No payment due.
              </div>
            )}
          </section>

          <section className="rounded-2xl border bg-card p-4 sm:p-5">
            <h2 className="text-base font-semibold">Admission fee timeline</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Select payable cycles to add them to your payment cart.
            </p>
            <div className="mt-4 space-y-0">
              {(account.admissionCycles ?? []).map((cycle, index) => (
                <AdmissionCycleRow
                  key={cycle.cycleId}
                  cycle={cycle}
                  index={index}
                  total={account.admissionCycles?.length ?? 0}
                  payable={cycle.demandId ? payableByDemandId.get(cycle.demandId) : undefined}
                  selected={
                    cycle.demandId
                      ? selectedIds.has(payableByDemandId.get(cycle.demandId)?.id ?? '')
                      : false
                  }
                  onToggle={() => cycle.demandId && toggleDemand(cycle.demandId)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">
                Monthly fee calendar{' '}
                {account.monthlyTracker ? `· ${account.monthlyTracker.year}` : ''}
              </h2>
              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Paid
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded border border-amber-400" />
                  Due
                </span>
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Not generated
                </span>
              </div>
            </div>
            {account.monthlyTracker?.months?.length ? (
              <>
                <QuickSelectBar
                  pendingCount={pendingTrackerMonths.length}
                  onSelectCurrent={selectCurrentMonth}
                  onSelectQuarter={selectQuarter}
                  onSelectAllPending={selectAllPending}
                  onClear={clearSelection}
                />
                <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-12">
                  {account.monthlyTracker.months.map((m) => (
                    <MonthlyCalendarCell
                      key={m.period}
                      month={m}
                      payable={m.demandId ? payableByDemandId.get(m.demandId) : undefined}
                      selected={
                        m.demandId
                          ? selectedIds.has(payableByDemandId.get(m.demandId)?.id ?? '')
                          : false
                      }
                      allowAdvance={allowAdvance}
                      onToggle={() => m.demandId && toggleDemand(m.demandId)}
                    />
                  ))}
                </div>
                {!allowAdvance ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Future months are locked until the college generates the demand. Advance payment
                    is disabled.
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Advance payment is enabled — you may select future months when a payable amount
                    is shown.
                  </p>
                )}
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No monthly demands yet.</p>
            )}
          </section>

          {feeCalculatorDemand?.lines?.length ? (
            <section className="rounded-2xl border bg-card p-4 sm:p-5">
              <h2 className="text-base font-semibold">Fee calculator</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Breakdown for your monthly fee plan.
              </p>
              <div className="mt-3 space-y-1.5 text-sm">
                {feeCalculatorDemand.lines.map((line) => (
                  <div
                    key={line.code}
                    className="flex justify-between gap-2 border-b border-dashed py-1.5 last:border-0"
                  >
                    <span>{line.name}</span>
                    <span className="font-medium">{formatInr(line.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between gap-2 pt-2 font-semibold">
                  <span>Total per month</span>
                  <span>{formatInr(feeCalculatorDemand.totalAmount)}</span>
                </div>
              </div>
            </section>
          ) : null}

          <section
            id="student-fee-payment-options"
            className="rounded-2xl border bg-card p-4 sm:p-5"
          >
            <h2 className="text-base font-semibold">Payment options</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!onlineEnabled || payMut.isPending || selectedTotal <= 0}
                onClick={() => payMut.mutate()}
              >
                <CreditCard className="mr-1.5 h-4 w-4" />
                Pay online
              </Button>
              {qrEnabled ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={qrMut.isPending || selectedTotal <= 0}
                  onClick={() => qrMut.mutate()}
                >
                  <QrCode className="mr-1.5 h-4 w-4" />
                  Generate QR
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={selectedTotal <= 0}
                onClick={() => setShowExternalForm((v) => !v)}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Submit external payment
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Razorpay · UPI · Net banking · Debit/Credit card
            </p>
            {qrCheckout?.qrImageUrl ? (
              <div className="mt-4 rounded-xl border bg-muted/30 p-4 text-center">
                <p className="mb-2 text-sm font-medium">
                  Scan to pay {formatInr(qrCheckout.amount)}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCheckout.qrImageUrl} alt="Payment QR" className="mx-auto max-h-48" />
              </div>
            ) : null}
            {showExternalForm ? (
              <ExternalPaymentForm
                amount={selectedTotal}
                demandIds={selectedDemandIds}
                sources={sourcesQ.data ?? []}
                onSuccess={() => {
                  setShowExternalForm(false);
                  setPaySuccess(true);
                  setPayMsg('External payment submitted — pending office verification.');
                  void qc.invalidateQueries({ queryKey: ['my-fee-account'] });
                }}
              />
            ) : null}
          </section>

          {(account.receipts ?? []).length ? (
            <section className="rounded-2xl border bg-card p-4 sm:p-5">
              <h2 className="mb-3 text-base font-semibold">Receipts</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="pb-2 pr-2">Receipt No</th>
                      <th className="pb-2 pr-2">Date</th>
                      <th className="pb-2 pr-2 text-right">Amount</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.receipts.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="py-2 pr-2 font-medium">{r.receiptNo}</td>
                        <td className="py-2 pr-2">
                          {new Date(r.issuedAt).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2 pr-2 text-right">{formatInr(r.amount)}</td>
                        <td className="py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void openFeeReceiptPdf(r.id)}
                          >
                            <Download className="mr-1 h-3.5 w-3.5" />
                            PDF
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {(account.paymentHistory ?? []).length ? (
            <section className="rounded-2xl border bg-card p-4 sm:p-5">
              <h2 className="mb-3 text-base font-semibold">Payment history</h2>
              <div className="space-y-0">
                {account.paymentHistory!.map((row, i) => (
                  <div key={row.id} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < account.paymentHistory!.length - 1 ? (
                      <span className="absolute left-[5px] top-3 h-full w-0.5 bg-border" />
                    ) : null}
                    <div className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(row.paidAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="font-medium">{row.feeHeads.join(', ') || 'Fee payment'}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatInr(row.amount)} · {row.paymentSourceLabel}
                        {row.receiptNo ? ` · ${row.receiptNo}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {concession ? (
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Award className="h-4 w-4 text-emerald-700" />
                Concession & scholarship
              </h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Type</dt>
                  <dd className="font-medium">{concession.schemeName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Amount waived</dt>
                  <dd className="font-medium">{formatInr(concession.approvedAmount)}</dd>
                </div>
                {concession.approvedAt ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Approved on</dt>
                    <dd>{new Date(concession.approvedAt).toLocaleDateString('en-IN')}</dd>
                  </div>
                ) : null}
                {concession.reason ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Remarks</dt>
                    <dd>{concession.reason}</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          ) : null}
        </div>

        <PaymentCart
          items={selectedItems}
          total={selectedTotal}
          onlineEnabled={Boolean(onlineEnabled)}
          qrEnabled={Boolean(qrEnabled)}
          paying={payMut.isPending || verifyMut.isPending}
          qrLoading={qrMut.isPending}
          onPayOnline={() => payMut.mutate()}
          onGenerateQr={() => qrMut.mutate()}
          onExternal={() => setShowExternalForm(true)}
          onRemove={removeFromCart}
          onProceed={scrollToPayment}
          className="hidden lg:block"
        />
      </div>

      {selectedItems.length > 0 ? (
        <PaymentCart
          items={selectedItems}
          total={selectedTotal}
          onlineEnabled={Boolean(onlineEnabled)}
          qrEnabled={Boolean(qrEnabled)}
          paying={payMut.isPending || verifyMut.isPending}
          qrLoading={qrMut.isPending}
          onPayOnline={() => payMut.mutate()}
          onGenerateQr={() => qrMut.mutate()}
          onExternal={() => setShowExternalForm(true)}
          onRemove={removeFromCart}
          onProceed={scrollToPayment}
          className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 p-3 shadow-lg backdrop-blur lg:hidden"
          compact
        />
      ) : null}
    </div>
  );
}

function DueAlerts({ account }: { account: StudentFeeAccount }) {
  const alerts: string[] = [];
  const pendingMonth = account.monthlyTracker?.months?.find((m) => m.status === 'PENDING');
  if (pendingMonth) {
    alerts.push(
      `Monthly fee for ${pendingMonth.label} is pending (${formatInr(pendingMonth.balanceAmount ?? pendingMonth.amount ?? 0)}).`,
    );
  }
  const nextCycle = account.admissionCycles?.find(
    (c) => c.status === 'PENDING' || c.status === 'PARTIAL',
  );
  if (nextCycle) {
    alerts.push(
      `Admission & session fee for ${nextCycle.covers} — ${formatInr(nextCycle.balanceAmount ?? nextCycle.totalAmount ?? 0)} due.`,
    );
  }
  if (!alerts.length) return null;

  return (
    <div className="space-y-2">
      {alerts.map((text) => (
        <div
          key={text}
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {text}
        </div>
      ))}
    </div>
  );
}

function SummaryCard({
  title,
  subtitle,
  value,
  status,
  statusTone,
  icon: Icon = Receipt,
}: {
  title: string;
  subtitle: string;
  value: string;
  status?: string;
  statusTone?: 'good' | 'warn';
  icon?: typeof Receipt;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <Icon className="h-4 w-4 text-primary/70" />
      </div>
      <p className="mt-2 text-lg font-bold leading-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      {status ? (
        <p
          className={cn(
            'mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
            statusTone === 'good' && 'bg-emerald-100 text-emerald-800',
            statusTone === 'warn' && 'bg-amber-100 text-amber-800',
            !statusTone && 'bg-muted text-muted-foreground',
          )}
        >
          {status}
        </p>
      ) : null}
    </div>
  );
}

function PayableGroup({
  title,
  items,
  selectedIds,
  onToggle,
}: {
  title: string;
  items: PayableFeeItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="space-y-2">
        {items.map((item) => (
          <label
            key={item.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background px-3 py-2.5 transition hover:border-primary/30"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border"
              checked={selectedIds.has(item.id)}
              onChange={() => onToggle(item.id)}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{item.label}</p>
              {item.periodLabel ? (
                <p className="text-xs text-muted-foreground">{item.periodLabel}</p>
              ) : null}
              {item.fineAmount > 0 ? (
                <p className="text-xs text-rose-600">
                  Includes late fine {formatInr(item.fineAmount)}
                </p>
              ) : null}
            </div>
            <span className="shrink-0 font-semibold">{formatInr(item.amount)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function QuickSelectBar({
  pendingCount,
  onSelectCurrent,
  onSelectQuarter,
  onSelectAllPending,
  onClear,
}: {
  pendingCount: number;
  onSelectCurrent: () => void;
  onSelectQuarter: () => void;
  onSelectAllPending: () => void;
  onClear: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Quick select
      </span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={onSelectCurrent}
      >
        Current month
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={pendingCount < 2}
        onClick={onSelectQuarter}
      >
        Quarter
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        disabled={pendingCount < 1}
        onClick={onSelectAllPending}
      >
        All pending
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}

function MonthlyCalendarCell({
  month,
  payable,
  selected,
  allowAdvance,
  onToggle,
}: {
  month: MonthlyFeeTrackerMonth;
  payable?: PayableFeeItem;
  selected: boolean;
  allowAdvance: boolean;
  onToggle: () => void;
}) {
  const amount = payable?.amount ?? month.balanceAmount ?? month.amount ?? 0;
  const isPaid = month.status === 'PAID';
  const isPending = month.status === 'PENDING';
  const isAdvanceSelectable = month.status === 'NOT_GENERATED' && allowAdvance && Boolean(payable);
  const selectable = (isPending || isAdvanceSelectable) && Boolean(payable);

  if (isPaid) {
    return (
      <div
        className="rounded-lg border border-emerald-200 bg-emerald-50 px-1 py-2 text-center text-xs font-semibold text-emerald-800"
        title={`${month.label} — Paid`}
      >
        <CheckCircle2 className="mx-auto h-3.5 w-3.5" />
        <div className="mt-1">{month.shortLabel}</div>
        <div className="mt-0.5 text-[10px] font-normal uppercase">Paid</div>
      </div>
    );
  }

  if (selectable) {
    return (
      <label
        className={cn(
          'cursor-pointer rounded-lg border px-1 py-2 text-center text-xs font-semibold transition',
          selected
            ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30'
            : 'border-amber-200 bg-amber-50 text-amber-900 hover:ring-2 hover:ring-primary/20',
        )}
        title={`${month.label} — ${formatInr(amount)}`}
      >
        <input type="checkbox" className="sr-only" checked={selected} onChange={onToggle} />
        <span
          className={cn(
            'mx-auto flex h-3.5 w-3.5 items-center justify-center rounded border text-[10px]',
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-amber-500 bg-white',
          )}
        >
          {selected ? '✓' : ''}
        </span>
        <div className="mt-1">{month.shortLabel}</div>
        <div className="mt-0.5 text-[10px] font-normal">{formatInr(amount)}</div>
      </label>
    );
  }

  return (
    <div
      className="rounded-lg border border-slate-200 bg-slate-50 px-1 py-2 text-center text-xs font-semibold text-slate-400"
      title={`${month.label} — Not generated`}
    >
      <Lock className="mx-auto h-3.5 w-3.5 opacity-60" />
      <div className="mt-1">{month.shortLabel}</div>
      <div className="mt-0.5 text-[10px] font-normal">Locked</div>
    </div>
  );
}

function AdmissionCycleRow({
  cycle,
  index,
  total,
  payable,
  selected,
  onToggle,
}: {
  cycle: StudentFeeCycleStatus;
  index: number;
  total: number;
  payable?: PayableFeeItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const selectable = Boolean(payable);
  const amount =
    payable?.amount ?? cycle.balanceAmount ?? cycle.totalAmount ?? cycle.configuredAmount;

  return (
    <div className="relative flex gap-3 pb-6 last:pb-0">
      {index < total - 1 ? (
        <span className="absolute left-[11px] top-6 h-full w-0.5 bg-border" />
      ) : null}
      <div
        className={cn(
          'relative z-10 mt-1 h-6 w-6 shrink-0 rounded-full border-2',
          cycle.status === 'PAID' && 'border-emerald-500 bg-emerald-100',
          (cycle.status === 'PENDING' || cycle.status === 'PARTIAL') &&
            'border-amber-500 bg-amber-100',
          cycle.status === 'NOT_GENERATED' && 'border-slate-300 bg-slate-100',
        )}
      />
      <div
        className={cn(
          'min-w-0 flex-1 rounded-xl border px-3 py-2.5',
          selectable && selected && 'border-primary bg-primary/5 ring-1 ring-primary/20',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {selectable ? (
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-border"
                checked={selected}
                onChange={onToggle}
                aria-label={`Select ${cycle.cycleName}`}
              />
            ) : null}
            <div>
              <p className="font-medium">{cycle.cycleName}</p>
              <p className="text-xs text-muted-foreground">{cycle.covers}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold">{formatInr(amount)}</p>
            <StatusPill status={cycle.status} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentCart({
  items,
  total,
  onlineEnabled,
  qrEnabled,
  paying,
  qrLoading,
  onPayOnline,
  onGenerateQr,
  onExternal,
  onRemove,
  onProceed,
  className,
  compact,
}: {
  items: PayableFeeItem[];
  total: number;
  onlineEnabled: boolean;
  qrEnabled: boolean;
  paying: boolean;
  qrLoading: boolean;
  onPayOnline: () => void;
  onGenerateQr: () => void;
  onExternal: () => void;
  onRemove: (id: string) => void;
  onProceed: () => void;
  className?: string;
  compact?: boolean;
}) {
  if (!items.length && !compact) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-dashed bg-muted/20 p-5 text-center text-sm text-muted-foreground',
          className,
        )}
      >
        <Lock className="mx-auto mb-2 h-5 w-5 opacity-50" />
        Select fee items to see your payment cart
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border bg-card p-4', className)}>
      <h3 className="font-semibold">Payment cart</h3>
      {!compact ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">Selected items</p>
          <ul className="mt-3 max-h-56 space-y-2 overflow-auto text-sm">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-2 border-b border-dashed pb-1.5 last:border-0"
              >
                <div className="flex min-w-0 items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.label}</p>
                    {item.periodLabel ? (
                      <p className="text-xs text-muted-foreground">{item.periodLabel}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <span className="font-medium">{formatInr(item.amount)}</span>
                  <button
                    type="button"
                    className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => onRemove(item.id)}
                    aria-label={`Remove ${item.label}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {items.length} item(s) · {formatInr(total)}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between border-t pt-3">
        <span className="text-sm text-muted-foreground">Total amount</span>
        <span className="text-lg font-bold">{formatInr(total)}</span>
      </div>
      <div className={cn('mt-3 grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-1')}>
        <Button size="sm" disabled={total <= 0} onClick={onProceed}>
          Proceed to payment
        </Button>
        <Button size="sm" disabled={!onlineEnabled || paying || total <= 0} onClick={onPayOnline}>
          {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay online'}
        </Button>
        {!compact && qrEnabled ? (
          <Button
            size="sm"
            variant="outline"
            disabled={qrLoading || total <= 0}
            onClick={onGenerateQr}
          >
            <QrCode className="mr-1.5 h-4 w-4" />
            Generate QR
          </Button>
        ) : null}
        {!compact ? (
          <Button size="sm" variant="outline" disabled={total <= 0} onClick={onExternal}>
            <Upload className="mr-1.5 h-4 w-4" />
            Submit external payment
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function MonthBreakdown({ demand, onClose }: { demand: FeeDemandRow; onClose: () => void }) {
  return (
    <div className="mt-4 rounded-xl border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{demand.periodLabel ?? demand.label}</p>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="mt-2 space-y-1 text-sm">
        {(demand.lines ?? []).map((line) => (
          <div key={line.code} className="flex justify-between gap-2">
            <span>{line.name}</span>
            <span>{formatInr(line.amount)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-2 border-t pt-2 font-semibold">
          <span>Total</span>
          <span>{formatInr(demand.balanceAmount)}</span>
        </div>
      </div>
    </div>
  );
}

function ExternalPaymentForm({
  amount,
  demandIds,
  sources,
  onSuccess,
}: {
  amount: number;
  demandIds: string[];
  sources: Array<{ value: string; label: string }>;
  onSuccess: () => void;
}) {
  const [paymentSource, setPaymentSource] = useState(sources[0]?.value ?? 'SBI_ICOLLECT');
  const [externalReference, setExternalReference] = useState('');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState(String(amount || ''));
  const [remarks, setRemarks] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const submitMut = useMutation({
    mutationFn: () =>
      submitMyExternalPayment({
        paymentSource,
        externalReference: externalReference.trim() || undefined,
        transactionDate,
        amount: Number(payAmount),
        demandIds,
        remarks: remarks.trim() || undefined,
        attachmentUrls: attachments,
      }),
    onSuccess: () => onSuccess(),
    onError: (e) => setError(apiErrorMessage(e, 'Submission failed')),
  });

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const res = await uploadExternalPaymentAttachment(file);
      setAttachments((prev) => [...prev, res.url]);
    } catch (e) {
      setError(apiErrorMessage(e, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border bg-muted/20 p-4">
      <p className="text-sm font-medium">Submit external payment proof</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Payment method</Label>
          <select
            className="mt-1 h-9 w-full rounded-lg border bg-background px-2 text-sm"
            value={paymentSource}
            onChange={(e) => setPaymentSource(e.target.value)}
          >
            {sources.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Transaction / UTR number</Label>
          <Input
            className="mt-1 h-9"
            value={externalReference}
            onChange={(e) => setExternalReference(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Amount (₹)</Label>
          <Input
            className="mt-1 h-9"
            type="number"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs">Payment date</Label>
          <Input
            className="mt-1 h-9"
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">Upload proof (screenshot / receipt / PDF)</Label>
        <input
          type="file"
          accept="image/*,.pdf"
          className="mt-1 block w-full text-sm"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        {attachments.length ? (
          <p className="mt-1 text-xs text-emerald-700">{attachments.length} file(s) attached</p>
        ) : null}
      </div>
      <Input
        placeholder="Remarks (optional)"
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
      />
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      <Button
        size="sm"
        disabled={submitMut.isPending || !payAmount || Number(payAmount) <= 0}
        onClick={() => submitMut.mutate()}
      >
        {submitMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Submit for verification
      </Button>
      <p className="text-xs text-muted-foreground">
        Status after submit: Pending verification by accounts office.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
        status === 'PAID' && 'bg-emerald-100 text-emerald-800',
        (status === 'PENDING' || status === 'PARTIAL') && 'bg-amber-100 text-amber-800',
        status === 'NOT_GENERATED' && 'bg-slate-100 text-slate-600',
      )}
    >
      {status === 'PAID'
        ? 'Paid ✅'
        : status === 'NOT_GENERATED'
          ? 'Future'
          : status.replace(/_/g, ' ')}
    </span>
  );
}
