'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { PublicFeePortalShell } from '@/components/public-fee-pay/public-fee-portal-shell';
import {
  publicFeeReceiptPdfUrl,
  simulatePublicFeePayment,
  verifyPublicFeeRazorpay,
} from '@/services/public-fee-pay';
import { apiErrorMessage } from '@/utils/api-error';

function ReturnInner() {
  const params = useSearchParams();
  const paymentId = params.get('paymentId');
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptAccessToken, setReceiptAccessToken] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const session =
      typeof window !== 'undefined' ? sessionStorage.getItem('publicFeePaySession') : null;
    const orderId = params.get('razorpay_order_id');
    const paymentRef = params.get('razorpay_payment_id');
    const signature = params.get('razorpay_signature');

    async function run() {
      try {
        if (orderId && paymentRef && signature) {
          const verified = await verifyPublicFeeRazorpay({
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentRef,
            razorpay_signature: signature,
            paymentSessionToken: session ?? undefined,
          });
          setReceiptId(verified.receiptId ?? verified.receipt?.id ?? null);
          setReceiptAccessToken(verified.receiptAccessToken ?? null);
          setDone(true);
          return;
        }
        if (paymentId && session) {
          const simulated = await simulatePublicFeePayment({
            paymentSessionToken: session,
            paymentId,
          });
          setReceiptId(simulated.receiptId ?? simulated.receipt?.id ?? null);
          setReceiptAccessToken(simulated.receiptAccessToken ?? null);
          setDone(true);
          return;
        }
        setError('Unable to reconcile payment. Use Verify Receipt with your receipt number.');
      } catch (err) {
        setError(apiErrorMessage(err));
      }
    }
    void run();
  }, [params, paymentId]);

  const pdfUrl =
    receiptId && receiptAccessToken
      ? publicFeeReceiptPdfUrl(receiptId, { receiptAccessToken })
      : null;

  return (
    <section className="pfp-card">
      <div className="pfp-success-panel">
        <h2>Payment return</h2>
        {error ? <div className="pfp-error">{error}</div> : null}
        {!error && !done ? <p>Confirming payment…</p> : null}
        {done ? (
          <>
            <p style={{ color: '#0f7a45', fontWeight: 700 }}>Payment confirmed.</p>
            {pdfUrl ? (
              <a
                className="pfp-pay-btn"
                style={{
                  width: 'auto',
                  margin: '16px auto 0',
                  padding: '0 18px',
                  textDecoration: 'none',
                }}
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
              >
                Download receipt
              </a>
            ) : null}
          </>
        ) : null}
        <p style={{ marginTop: 20 }}>
          <Link href="/public-fee-pay" style={{ color: '#0b2e59' }}>
            Back to fee payment
          </Link>
        </p>
      </div>
    </section>
  );
}

export default function PublicFeePayReturnPage() {
  return (
    <PublicFeePortalShell activeStep={5}>
      <Suspense fallback={<p className="pfp-meta">Loading…</p>}>
        <ReturnInner />
      </Suspense>
    </PublicFeePortalShell>
  );
}
