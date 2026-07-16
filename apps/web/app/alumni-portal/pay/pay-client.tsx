'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlumniPublicShell } from '@/components/alumni-portal/alumni-public-shell';
import { Button } from '@/components/ui/button';
import {
  feeGatewayDisplayName,
  runFeeGatewayCheckout,
  type FeeCheckoutPayload,
} from '@/lib/fee-gateway-checkout';
import {
  openAlumniMembershipCardPdf,
  openAlumniPaymentReceiptPdf,
  confirmAlumniMockPayment,
  fetchAlumniPaymentStatus,
  initiateAlumniPayment,
  verifyAlumniPayment,
} from '@/services/alumni-portal';
import { apiErrorMessage } from '@/utils/api-error';

export default function AlumniPayPageClient() {
  const params = useSearchParams();
  const qc = useQueryClient();
  const alumniId = params.get('alumniId') ?? '';
  const paymentId = params.get('paymentId') ?? '';
  const paymentToken = params.get('paymentToken') ?? '';
  const isReturn = params.get('return') === '1';
  const [message, setMessage] = useState('');

  const statusQ = useQuery({
    queryKey: ['alumni-payment-status', alumniId, paymentId, paymentToken],
    queryFn: () => fetchAlumniPaymentStatus({ alumniId, paymentId, paymentToken }),
    enabled: Boolean(alumniId && paymentId && paymentToken),
  });

  const pay = useMutation({
    mutationFn: async (forceDemo?: boolean) => {
      const initiated = await initiateAlumniPayment({
        alumniId,
        paymentId,
        paymentToken,
        forceDemo: forceDemo || statusQ.data?.demoPaymentEnabled === true,
      });
      if (initiated.alreadyPaid) return { kind: 'already_paid' as const };

      const checkout = initiated.checkout as FeeCheckoutPayload | undefined;
      if (!checkout) throw new Error('Checkout session was not created');

      // Demo / SAFE_MOCK: mark paid immediately so receipt can be downloaded.
      if (
        initiated.demo ||
        checkout.mode === 'SAFE_MOCK' ||
        checkout.mode === 'MOCK' ||
        String(checkout.orderId ?? '').startsWith('MOCK-')
      ) {
        await confirmAlumniMockPayment({ alumniId, paymentId, paymentToken });
        return { kind: 'paid' as const, demo: true as const };
      }

      const result = await runFeeGatewayCheckout(checkout, {
        description: initiated.description ?? 'Alumni membership',
        onRazorpaySuccess: async (response) => {
          await verifyAlumniPayment({
            alumniId,
            paymentId,
            paymentToken,
            ...response,
          });
        },
      });

      if (result.kind === 'mock') {
        await confirmAlumniMockPayment({ alumniId, paymentId, paymentToken });
        return { kind: 'paid' as const, demo: true as const };
      }
      if (result.kind === 'verified') {
        return { kind: 'paid' as const, demo: false as const };
      }
      return { kind: result.kind, demo: false as const };
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({
        queryKey: ['alumni-payment-status', alumniId, paymentId, paymentToken],
      });
      if (res.kind === 'already_paid' || res.kind === 'paid') {
        setMessage(
          res.demo
            ? 'Demo payment successful. You can download the payment receipt PDF now.'
            : 'Payment successful. Membership activation is pending office verification.',
        );
      } else if (res.kind === 'redirected' || res.kind === 'atom_opened') {
        setMessage('Complete payment in the gateway window. This page will update after return.');
      }
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Payment failed')),
  });

  useEffect(() => {
    if (!isReturn || !alumniId || !paymentId || !paymentToken) return;
    if (statusQ.data?.payment.status === 'PAID') return;
    void confirmAlumniMockPayment({ alumniId, paymentId, paymentToken })
      .then(() => {
        void qc.invalidateQueries({
          queryKey: ['alumni-payment-status', alumniId, paymentId, paymentToken],
        });
        setMessage('Payment confirmed. Membership activation is pending office verification.');
      })
      .catch(() => {
        // Non-mock returns stay pending until webhook / manual confirm path.
      });
  }, [alumniId, isReturn, paymentId, paymentToken, qc, statusQ.data?.payment.status]);

  const paid = statusQ.data?.payment.status === 'PAID';
  const amount = statusQ.data?.payment.amountInr;
  const gatewayLabel = feeGatewayDisplayName(statusQ.data?.payment.gateway);

  return (
    <AlumniPublicShell>
      <div className="mx-auto max-w-xl px-4 py-14 lg:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f3b63b]">
          Membership payment
        </p>
        <h1 className="mt-2 font-serif text-3xl text-[#1a2b47]">Complete your payment</h1>
        <p className="mt-3 text-sm leading-relaxed text-[#1a2b47]/75">
          {statusQ.data?.demoPaymentEnabled
            ? 'Local demo mode is ON — payment will be simulated so you can download the receipt PDF without live gateway credentials.'
            : "Uses the institution's default payment gateway configured in Administration → Payment Gateway."}
        </p>

        {!alumniId || !paymentId || !paymentToken ? (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Missing payment link details. Please register again or open the payment link from your
            registration confirmation.
          </div>
        ) : statusQ.isLoading ? (
          <p className="mt-8 text-sm text-[#1a2b47]/70">Loading payment details…</p>
        ) : statusQ.isError ? (
          <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {apiErrorMessage(statusQ.error, 'Could not load payment')}
          </div>
        ) : (
          <div className="mt-8 space-y-4 rounded-2xl border border-[#1a2b47]/10 bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1a2b47]/55">
                Member
              </p>
              <p className="mt-1 text-lg font-semibold text-[#1a2b47]">
                {statusQ.data?.alumni.fullName}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1a2b47]/55">
                  Amount
                </p>
                <p className="mt-1 text-2xl font-semibold text-[#1a2b47]">
                  ₹{(amount ?? 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#1a2b47]/55">
                  Status
                </p>
                <p className="mt-1 text-sm font-medium text-[#1a2b47]">
                  {paid ? 'Paid' : 'Pending payment'}
                  {statusQ.data?.payment.gateway ? ` · ${gatewayLabel}` : ''}
                </p>
              </div>
            </div>
            {paid && statusQ.data?.payment.receiptNumber ? (
              <p className="text-sm text-[#1a2b47]/75">
                Receipt: <code>{statusQ.data.payment.receiptNumber}</code>
              </p>
            ) : null}

            {!paid ? (
              <div className="space-y-2">
                <Button
                  className="w-full bg-[#f3b63b] text-[#1a2b47] hover:bg-[#e5a82e]"
                  disabled={pay.isPending}
                  onClick={() => pay.mutate(Boolean(statusQ.data?.demoPaymentEnabled))}
                >
                  {pay.isPending
                    ? 'Processing…'
                    : statusQ.data?.demoPaymentEnabled
                      ? 'Pay with Demo Gateway (Test)'
                      : 'Pay membership fee'}
                </Button>
                {!statusQ.data?.demoPaymentEnabled ? (
                  <Button
                    variant="outline"
                    className="w-full border-[#0A2342]/20"
                    disabled={pay.isPending}
                    onClick={() => pay.mutate(true)}
                  >
                    Use demo / test payment instead
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                {statusQ.data?.canDownloadReceipt ? (
                  <Button
                    className="w-full bg-[#0A2342] text-white hover:bg-[#F4B400] hover:text-[#0A2342]"
                    onClick={() => {
                      void openAlumniPaymentReceiptPdf({
                        alumniId,
                        paymentId,
                        paymentToken,
                      }).catch((e) => setMessage(apiErrorMessage(e, 'Could not open receipt PDF')));
                    }}
                  >
                    Download Payment Receipt (PDF)
                  </Button>
                ) : null}
                {statusQ.data?.canDownloadMembershipCard ? (
                  <Button
                    variant="outline"
                    className="w-full border-[#0A2342]/20"
                    onClick={() => {
                      void openAlumniMembershipCardPdf({
                        alumniId,
                        paymentId,
                        paymentToken,
                      }).catch((e) =>
                        setMessage(apiErrorMessage(e, 'Could not open membership card')),
                      );
                    }}
                  >
                    Download Membership Card
                    {statusQ.data.alumni.membershipNumber
                      ? ` (${statusQ.data.alumni.membershipNumber})`
                      : ''}
                  </Button>
                ) : (
                  <p className="rounded-lg bg-[#F8FAFC] px-3 py-2 text-xs text-[#1a2b47]/7">
                    Membership card will be available after Alumni Office activation.
                  </p>
                )}
                <Link
                  href="/alumni-portal"
                  className="inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium text-[#1a2b47]/75 underline"
                >
                  Back to Alumni Home
                </Link>
              </div>
            )}

            {message ? <p className="text-sm text-[#1a2b47]/75">{message}</p> : null}
          </div>
        )}
      </div>
    </AlumniPublicShell>
  );
}
