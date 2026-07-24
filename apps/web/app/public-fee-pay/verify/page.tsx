'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PublicFeePortalShell } from '@/components/public-fee-pay/public-fee-portal-shell';
import { publicFeeReceiptPdfUrl, verifyPublicReceipt } from '@/services/public-fee-pay';
import { apiErrorMessage } from '@/utils/api-error';

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function VerifyInner() {
  const params = useSearchParams();
  const [receiptNo, setReceiptNo] = useState(params.get('receiptNo') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof verifyPublicReceipt>> | null>(
    null,
  );

  useEffect(() => {
    const initial = params.get('receiptNo');
    if (initial) {
      setReceiptNo(initial);
      void onVerify(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onVerify(no?: string) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await verifyPublicReceipt((no ?? receiptNo).trim());
      setResult(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await onVerify();
  }

  const pdfUrl =
    result?.receiptId && result.receiptAccessToken
      ? publicFeeReceiptPdfUrl(result.receiptId, {
          receiptAccessToken: result.receiptAccessToken,
        })
      : null;

  return (
    <>
      {error ? <div className="pfp-error">{error}</div> : null}
      <div className="pfp-layout">
        <section className="pfp-card pfp-search-card">
          <div className="pfp-card-head">
            <h3>Verify Fee Receipt</h3>
          </div>
          <form className="pfp-card-body" onSubmit={onSubmit}>
            <p style={{ margin: '0 0 14px', color: '#5b6b7c', fontSize: 14 }}>
              Enter the receipt number from your payment slip or scan the QR on the official PDF.
            </p>
            <label htmlFor="receiptNo">Receipt number</label>
            <input
              id="receiptNo"
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
              required
            />
            <button type="submit" disabled={busy || !receiptNo.trim()}>
              {busy ? 'Checking…' : 'Verify authenticity'}
            </button>
          </form>
        </section>

        <aside className="pfp-stack">
          {result ? (
            <section className="pfp-card">
              <div className="pfp-summary-head">Authentic College Receipt</div>
              <div className="pfp-card-body">
                <div className="pfp-summary-row">
                  <span>Receipt No</span>
                  <strong>{result.receiptNo}</strong>
                </div>
                <div className="pfp-summary-row">
                  <span>Student</span>
                  <strong>{result.student.fullName}</strong>
                </div>
                <div className="pfp-summary-row">
                  <span>Roll</span>
                  <strong>{result.student.rollNumber ?? '—'}</strong>
                </div>
                <div className="pfp-summary-row">
                  <span>Amount</span>
                  <strong>{inr(result.amount)}</strong>
                </div>
                <div className="pfp-summary-row">
                  <span>Paid at</span>
                  <strong>{new Date(result.issuedAt).toLocaleString('en-IN')}</strong>
                </div>
                {pdfUrl ? (
                  <a
                    className="pfp-pay-btn"
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    Download PDF
                  </a>
                ) : null}
              </div>
            </section>
          ) : (
            <div className="pfp-help">
              <h3>Need Help?</h3>
              <p>☎ +91 9402152496</p>
              <p>✉ accounts@donboscocollege.ac.in</p>
              <p>🕘 Mon–Fri · 9:00 AM – 4:30 PM</p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

export default function PublicFeePayVerifyPage() {
  return (
    <PublicFeePortalShell>
      <Suspense fallback={<p className="pfp-meta">Loading…</p>}>
        <VerifyInner />
      </Suspense>
    </PublicFeePortalShell>
  );
}
