'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, IndianRupee, Loader2 } from 'lucide-react';
import {
  createAdmissionPaymentOrder,
  fetchPaymentInfo,
  fetchPortalInfo,
  verifyAdmissionPayment,
  type PaymentOrderResponse,
} from '@/services/admissions-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { formatInr } from '@/components/admissions-portal/cycle-settings';
import { Button } from '@/components/ui/button';
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

function paymentStatusLabel(status?: string) {
  switch (status) {
    case 'PAID':
      return 'Paid';
    case 'WAIVED':
      return 'Waived';
    case 'PENDING':
      return 'Pending';
    default:
      return status?.replace(/_/g, ' ') ?? 'Unknown';
  }
}

type Props = {
  compact?: boolean;
};

export function AdmissionsPaymentPanel({ compact = false }: Props) {
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);

  const portalInfo = useQuery({
    queryKey: ['admissions-portal-info'],
    queryFn: fetchPortalInfo,
  });

  const paymentInfo = useQuery({
    queryKey: ['applicant-payment-info'],
    queryFn: fetchPaymentInfo,
    enabled,
  });

  const verifyMutation = useMutation({
    mutationFn: verifyAdmissionPayment,
    onSuccess: () => {
      setPaySuccess(true);
      setPayError(null);
      void queryClient.invalidateQueries({ queryKey: ['applicant-payment-info'] });
      void queryClient.invalidateQueries({ queryKey: ['applicant-me'] });
      void queryClient.invalidateQueries({ queryKey: ['applicant-status'] });
    },
    onError: (err: Error) => {
      setPayError(err.message || 'Payment verification failed');
    },
  });

  const openCheckout = useCallback(
    async (order: Extract<PaymentOrderResponse, { configured: true }>) => {
      await loadRazorpayScript();
      if (!window.Razorpay) {
        throw new Error('Razorpay checkout is unavailable');
      }

      const branding = portalInfo.data?.branding;

      return new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay!({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: branding?.displayName ?? 'Admissions Portal',
          description: order.description,
          order_id: order.orderId,
          prefill: order.prefill,
          theme: { color: '#1a2b4b' },
          handler: (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            verifyMutation.mutate(response, {
              onSuccess: () => resolve(),
              onError: (err) => reject(err),
            });
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled')),
          },
        });

        rzp.on('payment.failed', (response) => {
          reject(new Error(response.error?.description ?? 'Payment failed'));
        });

        rzp.open();
      });
    },
    [portalInfo.data?.branding, verifyMutation],
  );

  const payMutation = useMutation({
    mutationFn: createAdmissionPaymentOrder,
    onMutate: () => {
      setPayError(null);
      setPaySuccess(false);
    },
    onSuccess: async (order) => {
      if (!order.configured) {
        setPayError(order.message);
        return;
      }
      try {
        await openCheckout(order);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Payment failed';
        if (message !== 'Payment cancelled') {
          setPayError(message);
        }
      }
    },
    onError: (err: Error) => {
      setPayError(err.message || 'Could not start payment');
    },
  });

  useEffect(() => {
    if (paymentInfo.data?.paymentStatus === 'PAID') {
      setPaySuccess(false);
    }
  }, [paymentInfo.data?.paymentStatus]);

  const info = paymentInfo.data;
  const isPaid = info?.paymentStatus === 'PAID' || info?.paymentStatus === 'WAIVED';
  const isLoading = paymentInfo.isLoading;
  const isPaying = payMutation.isPending || verifyMutation.isPending;

  if (isLoading) {
    return (
      <div
        className={cn(
          'rounded-xl border border-slate-200 bg-white p-6 shadow-sm',
          compact && 'p-4',
        )}
      >
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading payment details…
        </div>
      </div>
    );
  }

  if (!info) {
    return null;
  }

  return (
    <div
      className={cn('rounded-xl border border-slate-200 bg-white p-6 shadow-sm', compact && 'p-4')}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5 text-[#2563eb]" />
            <h2 className="text-lg font-bold text-[#1a2b4b]">Application Fee</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Pay the non-refundable <strong>application fee</strong> (
            {formatInr(info.applicationFee)}) to register and submit your form. Admission fee is
            collected only if you are selected.
          </p>
        </div>
        <StatusBadge status={info.paymentStatus} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Detail label="Amount" value={formatInr(info.applicationFee)} />
        <Detail label="Status" value={paymentStatusLabel(info.paymentStatus)} />
        {info.amountPaid != null ? (
          <Detail label="Amount paid" value={formatInr(info.amountPaid)} />
        ) : null}
        {info.paymentReference && isPaid ? (
          <Detail label="Reference" value={info.paymentReference} mono />
        ) : null}
        {info.paymentDeadline ? (
          <Detail
            label="Payment deadline"
            value={new Date(info.paymentDeadline).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          />
        ) : null}
      </div>

      {info.paymentStatus === 'PAID' || info.paymentStatus === 'WAIVED' ? (
        <p className="mt-4 text-xs text-slate-500">
          Application fee received. If you are later selected for admission, the college will inform
          you of the separate admission fee amount.
        </p>
      ) : (
        <p className="mt-4 text-xs text-slate-500">
          This page is for the application fee only. Admission fee is payable only after selection.
        </p>
      )}

      {paySuccess || isPaid ? (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {isPaid
              ? 'Your application fee has been received. You can continue with document uploads and form submission.'
              : 'Payment received. Updating your application status…'}
          </p>
        </div>
      ) : null}

      {!isPaid && !info.configured ? (
        <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Online payment is not available yet. Please pay {formatInr(info.applicationFee)} at the
          college office and wait for the admissions desk to confirm your payment.
        </div>
      ) : null}

      {payError ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {payError}
        </div>
      ) : null}

      {!isPaid && info.canPay ? (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            className="rounded-full bg-[#2563eb] hover:bg-[#1d4ed8]"
            disabled={isPaying}
            onClick={() => payMutation.mutate()}
          >
            {isPaying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Pay {formatInr(info.applicationFee)} online
              </>
            )}
          </Button>
          <p className="text-xs text-slate-500">Secure checkout powered by Razorpay</p>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const paid = status === 'PAID' || status === 'WAIVED';
  return (
    <span
      className={cn(
        'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide',
        paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
      )}
    >
      {paymentStatusLabel(status)}
    </span>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-1 font-semibold text-[#1a2b4b]', mono && 'font-mono text-sm')}>
        {value}
      </p>
    </div>
  );
}
