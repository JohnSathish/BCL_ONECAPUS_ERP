'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { reconcileCenterPayment } from '@/services/fee-collection-centers';
import { apiErrorMessage } from '@/utils/api-error';

function ReturnInner() {
  const params = useSearchParams();
  const paymentId = params.get('paymentId');
  const [msg, setMsg] = useState('Confirming payment…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      setMsg('No payment reference found. Check History for status.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = (await reconcileCenterPayment(paymentId)) as {
          synced?: boolean;
          payment?: { status?: string };
          providerStatus?: string;
        };
        if (cancelled) return;
        if (res?.payment?.status === 'SUCCESS' || res?.synced) {
          setMsg('Payment confirmed. Receipt will appear under History.');
        } else {
          setMsg(
            `Gateway status: ${res?.providerStatus ?? 'pending'}. Check History shortly if the bank debit succeeded.`,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(apiErrorMessage(err));
          setMsg('Could not auto-confirm. Open History to verify status.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center">
      <h2 className="text-2xl font-semibold text-white">Payment return</h2>
      <p className="text-sm text-slate-300">{msg}</p>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <div className="flex justify-center gap-3">
        <Link className="text-sky-300 underline" href="/fee-collection-portal">
          Dashboard
        </Link>
        <Link className="text-sky-300 underline" href="/fee-collection-portal/transactions">
          History
        </Link>
      </div>
    </div>
  );
}

export default function FeeCollectionPayReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-400">
          Loading…
        </div>
      }
    >
      <ReturnInner />
    </Suspense>
  );
}
