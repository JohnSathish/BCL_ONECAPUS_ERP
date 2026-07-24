'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Hash,
  IdCard,
  Layers,
  Lock,
  RefreshCw,
  UserRound,
} from 'lucide-react';
import { PublicFeePortalShell } from '@/components/public-fee-pay/public-fee-portal-shell';
import { runFeeGatewayCheckout } from '@/lib/fee-gateway-checkout';
import {
  fetchPublicFeeChallenge,
  initiatePublicFeePayment,
  lookupPublicFees,
  publicFeeReceiptPdfUrl,
  simulatePublicFeePayment,
  verifyPublicFeeRazorpay,
  type PublicFeeChallenge,
  type PublicFeeLookupResult,
} from '@/services/public-fee-pay';
import { apiErrorMessage } from '@/utils/api-error';

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDueDate(value: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

type Step = 'lookup' | 'dues' | 'receipt';

export default function PublicFeePayPage() {
  const [step, setStep] = useState<Step>('lookup');
  const [identifier, setIdentifier] = useState('');
  const [challenge, setChallenge] = useState<PublicFeeChallenge | null>(null);
  const [mathAnswer, setMathAnswer] = useState('');
  const [useMathFallback, setUseMathFallback] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [result, setResult] = useState<PublicFeeLookupResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [receiptAccessToken, setReceiptAccessToken] = useState<string | null>(null);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);

  const loadChallenge = useCallback(async () => {
    try {
      const next = await fetchPublicFeeChallenge();
      setChallenge(next);
      setMathAnswer('');
      setTurnstileToken(null);
      setUseMathFallback(next.mode !== 'turnstile');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not load CAPTCHA'));
    }
  }, []);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  useEffect(() => {
    if (!challenge || challenge.mode !== 'turnstile' || useMathFallback) return;
    const siteKey = challenge.siteKey;
    const scriptId = 'cf-turnstile-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onerror = () => setUseMathFallback(true);
      document.body.appendChild(script);
    }

    let widgetId: string | undefined;
    let cancelled = false;
    const tryRender = () => {
      const w = (window as any).turnstile;
      const el = document.getElementById('public-fee-turnstile');
      if (!w || !el || cancelled) {
        if (!cancelled) setTimeout(tryRender, 200);
        return;
      }
      try {
        widgetId = w.render(el, {
          sitekey: siteKey,
          callback: (token: string) => setTurnstileToken(token),
          'error-callback': () => setUseMathFallback(true),
          'expired-callback': () => setTurnstileToken(null),
        });
      } catch {
        setUseMathFallback(true);
      }
    };
    tryRender();
    return () => {
      cancelled = true;
      try {
        if (widgetId && (window as any).turnstile) {
          (window as any).turnstile.remove(widgetId);
        }
      } catch {
        /* ignore */
      }
    };
  }, [challenge, useMathFallback]);

  const mathPayload = useMemo(() => {
    if (!challenge) return null;
    if (challenge.mode === 'math') return challenge;
    return challenge.math;
  }, [challenge]);

  const payAmount = useMemo(() => {
    if (!result) return 0;
    return result.unpaidFees
      .filter((f) => selected.includes(f.demandId))
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);
  }, [result, selected]);

  const activeStep: 1 | 2 | 3 | 4 | 5 = step === 'lookup' ? 1 : step === 'dues' ? 3 : 5;

  async function onLookup(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: Parameters<typeof lookupPublicFees>[0] = {
        identifier: identifier.trim(),
      };
      if (!useMathFallback && challenge?.mode === 'turnstile' && turnstileToken) {
        payload.turnstileToken = turnstileToken;
      } else if (mathPayload) {
        payload.challengeToken = mathPayload.token;
        payload.challengeAnswer = mathAnswer.trim();
      }

      const res = await lookupPublicFees(payload);
      setResult(res);
      setSelected(res.unpaidFees.map((f) => f.demandId));
      try {
        sessionStorage.setItem('publicFeePaySession', res.paymentSessionToken);
      } catch {
        /* ignore */
      }
      setStep('dues');
      await loadChallenge();
    } catch (err) {
      setError(apiErrorMessage(err));
      await loadChallenge();
    } finally {
      setBusy(false);
    }
  }

  function toggleAll(checked: boolean) {
    if (!result) return;
    setSelected(checked ? result.unpaidFees.map((f) => f.demandId) : []);
  }

  function resetSearch() {
    setStep('lookup');
    setResult(null);
    setSelected([]);
    setReceiptId(null);
    setReceiptAccessToken(null);
    setReceiptNo(null);
    setError(null);
    void loadChallenge();
  }

  async function onPay() {
    if (!result || payAmount <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await initiatePublicFeePayment({
        paymentSessionToken: result.paymentSessionToken,
        demandIds: selected,
      });
      const checkout = res.checkout as any;
      const paymentId = checkout.paymentId ?? res.payment?.id;
      const gatewayResult = await runFeeGatewayCheckout(
        {
          ...checkout,
          returnUrl:
            checkout.returnUrl ||
            `${window.location.origin}/public-fee-pay/return?atomReturn=1&paymentId=${paymentId}`,
        },
        {
          onRazorpaySuccess: async (response) => {
            const verified = await verifyPublicFeeRazorpay({
              ...response,
              paymentSessionToken: result.paymentSessionToken,
            });
            setReceiptId(verified.receiptId ?? verified.receipt?.id ?? null);
            setReceiptAccessToken(verified.receiptAccessToken ?? null);
            setReceiptNo(verified.receipt?.receiptNo ?? null);
            setStep('receipt');
          },
        },
      );

      if (gatewayResult.kind === 'mock') {
        const simulated = await simulatePublicFeePayment({
          paymentSessionToken: result.paymentSessionToken,
          paymentId: gatewayResult.paymentId,
        });
        setReceiptId(simulated.receiptId ?? simulated.receipt?.id ?? null);
        setReceiptAccessToken(simulated.receiptAccessToken ?? null);
        setReceiptNo(simulated.receipt?.receiptNo ?? null);
        setStep('receipt');
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const pdfUrl =
    receiptId && (receiptAccessToken || result?.paymentSessionToken)
      ? publicFeeReceiptPdfUrl(receiptId, {
          receiptAccessToken: receiptAccessToken ?? undefined,
          paymentSessionToken: result?.paymentSessionToken,
        })
      : null;

  const studentFields = result
    ? [
        { label: 'Student Name', value: result.student.fullName, icon: UserRound },
        { label: 'Roll Number', value: result.student.rollNumber ?? '—', icon: Hash },
        {
          label: 'Registration No.',
          value: result.student.registrationNumber ?? '—',
          icon: IdCard,
        },
        { label: 'Programme', value: result.student.programme ?? '—', icon: GraduationCap },
        { label: 'Department', value: result.student.department ?? '—', icon: Layers },
        {
          label: 'Semester',
          value: result.student.semester != null ? String(result.student.semester) : '—',
          icon: BookOpen,
        },
        { label: 'Academic Year', value: result.student.academicYear ?? '—', icon: CalendarDays },
        {
          label: 'Admission Batch',
          value: result.student.admissionBatch ?? result.student.academicYear ?? '—',
          icon: CalendarDays,
        },
      ]
    : [];

  return (
    <PublicFeePortalShell activeStep={activeStep}>
      {error ? <div className="pfp-error">{error}</div> : null}

      {step === 'lookup' ? (
        <div className="pfp-layout">
          <div className="pfp-stack">
            <section className="pfp-card pfp-search-card">
              <div className="pfp-card-head">
                <h3>
                  <UserRound size={16} aria-hidden /> Search Student
                </h3>
              </div>
              <form className="pfp-card-body" onSubmit={onLookup}>
                <div>
                  <label htmlFor="identifier">College Roll / Registration Number</label>
                  <input
                    id="identifier"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. BA25-025"
                    required
                    autoComplete="off"
                  />
                </div>

                <div style={{ marginTop: 14 }}>
                  {challenge?.mode === 'turnstile' && !useMathFallback ? (
                    <>
                      <label>CAPTCHA verification</label>
                      <div id="public-fee-turnstile" style={{ marginTop: 8 }} />
                      <button
                        type="button"
                        onClick={() => setUseMathFallback(true)}
                        style={{
                          marginTop: 8,
                          border: 0,
                          background: 'none',
                          color: '#0b2e59',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        Use math CAPTCHA instead
                      </button>
                    </>
                  ) : mathPayload ? (
                    <>
                      <label htmlFor="captcha">Solve CAPTCHA: {mathPayload.expression}</label>
                      <input
                        id="captcha"
                        value={mathAnswer}
                        onChange={(e) => setMathAnswer(e.target.value)}
                        required
                        inputMode="numeric"
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => void loadChallenge()}
                        style={{
                          marginTop: 8,
                          border: 0,
                          background: 'none',
                          color: '#0b2e59',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        New CAPTCHA
                      </button>
                    </>
                  ) : null}
                </div>

                <button type="submit" disabled={busy || !identifier.trim()}>
                  {busy ? 'Searching…' : 'Search fees'}
                </button>
              </form>
            </section>
          </div>

          <aside className="pfp-stack">
            <div className="pfp-help">
              <h3>Need Help?</h3>
              <p>Admission / Accounts Office</p>
              <p>☎ +91 9402152496</p>
              <p>✉ accounts@donboscocollege.ac.in</p>
              <p>🕘 Mon–Fri · 9:00 AM – 4:30 PM</p>
            </div>
          </aside>
        </div>
      ) : null}

      {step === 'dues' && result ? (
        <div className="pfp-layout">
          <div className="pfp-stack">
            <div className="pfp-found-bar">
              <div>
                <strong>✓ Student found!</strong>
                <div style={{ fontSize: 13, color: '#166534', marginTop: 2 }}>
                  Search Roll Number: {result.student.rollNumber ?? identifier}
                </div>
              </div>
              <button
                type="button"
                className="pfp-cancel-btn"
                style={{ width: 'auto' }}
                onClick={resetSearch}
              >
                <RefreshCw size={14} aria-hidden style={{ display: 'inline', marginRight: 6 }} />
                New Search
              </button>
            </div>

            <section className="pfp-card">
              <div className="pfp-card-head">
                <h3>
                  <UserRound size={16} aria-hidden /> Student Information
                </h3>
              </div>
              <div className="pfp-card-body">
                <div className="pfp-student-grid">
                  {studentFields.map((field) => {
                    const Icon = field.icon;
                    return (
                      <div key={field.label} className="pfp-field">
                        <span>
                          <Icon size={13} aria-hidden /> {field.label}
                        </span>
                        <strong>{field.value}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="pfp-card">
              <div className="pfp-card-head">
                <h3>Pending Fee Details</h3>
                <label
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}
                >
                  <input
                    type="checkbox"
                    checked={
                      result.unpaidFees.length > 0 && selected.length === result.unpaidFees.length
                    }
                    onChange={(e) => toggleAll(e.target.checked)}
                  />
                  Select all
                </label>
              </div>
              <div className="pfp-table-wrap">
                {result.unpaidFees.length === 0 ? (
                  <p className="pfp-meta">No unpaid fees for this student.</p>
                ) : (
                  <table className="pfp-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Fee Head</th>
                        <th>Period</th>
                        <th>Due Date</th>
                        <th>Amount (₹)</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.unpaidFees.map((fee, index) => (
                        <tr key={fee.demandId}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selected.includes(fee.demandId)}
                              onChange={(e) => {
                                setSelected((prev) =>
                                  e.target.checked
                                    ? [...prev, fee.demandId]
                                    : prev.filter((id) => id !== fee.demandId),
                                );
                              }}
                              aria-label={`Select ${fee.label}`}
                            />{' '}
                            {index + 1}
                          </td>
                          <td>{fee.label}</td>
                          <td>{fee.periodLabel ?? fee.semester ?? '—'}</td>
                          <td>{formatDueDate(fee.dueDate)}</td>
                          <td>{inr(fee.amount)}</td>
                          <td>
                            <span className="pfp-status pfp-status-unpaid">● Unpaid</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="pfp-meta">
                Last updated:{' '}
                {new Date(result.lookedUpAt ?? Date.now()).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </section>
          </div>

          <aside className="pfp-stack">
            <section className="pfp-card">
              <div className="pfp-summary-head">Payment Summary</div>
              <div className="pfp-card-body">
                <div className="pfp-summary-row">
                  <span>Selected Items</span>
                  <strong>{selected.length}</strong>
                </div>
                <div className="pfp-summary-row">
                  <span>Total Amount</span>
                  <strong>{inr(payAmount)}</strong>
                </div>
                <div className="pfp-summary-row">
                  <span>Convenience Fee</span>
                  <strong>{inr(0)}</strong>
                </div>
                <div className="pfp-grand">
                  <span>Grand Total</span>
                  <strong>{inr(payAmount)}</strong>
                </div>
                <button
                  type="button"
                  className="pfp-pay-btn"
                  disabled={busy || payAmount <= 0}
                  onClick={() => void onPay()}
                >
                  <Lock size={16} aria-hidden />
                  {busy ? 'Processing…' : 'Proceed to Secure Payment'}
                </button>
                <button type="button" className="pfp-cancel-btn" onClick={resetSearch}>
                  Cancel
                </button>
                <div className="pfp-gateway-logos" aria-label="Accepted payment methods">
                  <span>UPI</span>
                  <span>RuPay</span>
                  <span>Visa</span>
                  <span>Mastercard</span>
                  <span>Powered by Razorpay</span>
                </div>
              </div>
            </section>

            <div className="pfp-help">
              <h3>Need Help?</h3>
              <p>Admission / Accounts Office</p>
              <p>☎ +91 9402152496</p>
              <p>✉ accounts@donboscocollege.ac.in</p>
              <p>🕘 Mon–Fri · 9:00 AM – 4:30 PM</p>
            </div>
          </aside>
        </div>
      ) : null}

      {step === 'receipt' ? (
        <section className="pfp-card">
          <div className="pfp-success-panel">
            <h2>✓ Payment successful</h2>
            {receiptNo ? <p>Receipt No: {receiptNo}</p> : null}
            <p style={{ color: '#5b6b7c', fontSize: 14 }}>
              Download or print your official fee receipt. You can verify it anytime using the
              receipt number.
            </p>
            <div
              style={{
                marginTop: 18,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                justifyContent: 'center',
              }}
            >
              {pdfUrl ? (
                <>
                  <a
                    className="pfp-pay-btn"
                    style={{ width: 'auto', padding: '0 18px' }}
                    href={pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View / Download PDF
                  </a>
                  <button
                    type="button"
                    className="pfp-cancel-btn"
                    style={{ width: 'auto', padding: '0 18px' }}
                    onClick={() => window.open(pdfUrl, '_blank')}
                  >
                    Print
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="pfp-cancel-btn"
                style={{ width: 'auto', padding: '0 18px' }}
                onClick={resetSearch}
              >
                Pay another
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </PublicFeePortalShell>
  );
}
