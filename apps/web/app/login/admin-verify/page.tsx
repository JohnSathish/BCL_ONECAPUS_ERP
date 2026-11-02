'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Shield } from 'lucide-react';
import { LoginAuthPanel } from '@/components/auth/login-auth-panel';
import { LoginHeroPanel } from '@/components/auth/login-hero-panel';
import { LoginInstitutionHeader } from '@/components/auth/login-institution-header';
import { LoginPageShell } from '@/components/auth/login-page-shell';
import { LoginDynamicFavicon } from '@/components/branding/login-dynamic-favicon';
import {
  clearStoredAdminEmailOtp,
  readStoredAdminEmailOtp,
  writeStoredAdminEmailOtp,
  type StoredAdminEmailOtp,
} from '@/lib/auth/admin-email-otp';
import { finishWebLogin } from '@/lib/auth/finish-web-login';
import { fetchLoginContext, resendAdminEmailOtp, verifyAdminEmailOtp } from '@/services/auth';
import type { LoginContext } from '@/types/login-context';
import { apiErrorMessage } from '@/utils/api-error';

function secondsUntil(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

function formatClock(total: number) {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function AdminVerifyPage() {
  const router = useRouter();
  const [context, setContext] = useState<LoginContext | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [pending, setPending] = useState<StoredAdminEmailOtp | null>(null);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [trustDevice, setTrustDevice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setPending(readStoredAdminEmailOtp());
    void fetchLoginContext()
      .then(setContext)
      .catch(() => setContext(null))
      .finally(() => setContextLoading(false));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const expiresIn = pending ? secondsUntil(pending.expiresAt) : 0;
  const resendIn = pending ? secondsUntil(pending.resendAvailableAt) : 0;
  const code = digits.join('');
  const collegeName = context?.institution.displayName?.trim() || 'Don Bosco College, Tura';

  const onDigit = useCallback((index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) {
      setDigits((current) => {
        const next = [...current];
        next[index] = '';
        return next;
      });
      return;
    }
    const chars = clean.slice(0, 6 - index).split('');
    setDigits((current) => {
      const next = [...current];
      chars.forEach((char, offset) => {
        next[index + offset] = char;
      });
      return next;
    });
    const focusAt = Math.min(index + chars.length, 5);
    inputs.current[focusAt]?.focus();
  }, []);

  const submit = useCallback(async () => {
    if (!pending || code.length !== 6 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await verifyAdminEmailOtp({
        challengeId: pending.challengeId,
        code,
        trustDevice,
      });
      clearStoredAdminEmailOtp();
      finishWebLogin({
        session,
        rememberMe: pending.rememberMe,
        router,
        context,
        schoolSis: false,
        postLoginPath: pending.returnPath,
      });
    } catch (err) {
      setError(apiErrorMessage(err, 'That verification code could not be accepted.'));
      setSubmitting(false);
    }
  }, [code, context, pending, router, submitting, trustDevice]);

  const resend = useCallback(async () => {
    if (!pending || resendIn > 0 || resending) return;
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      const next = await resendAdminEmailOtp(pending.challengeId);
      const stored: StoredAdminEmailOtp = {
        ...pending,
        expiresAt: next.expiresAt,
        resendAvailableAt: next.resendAvailableAt,
        maskedEmail: next.maskedEmail || pending.maskedEmail,
      };
      writeStoredAdminEmailOtp(stored);
      setPending(stored);
      setDigits(['', '', '', '', '', '']);
      setInfo('A new code has been sent. The previous code no longer works.');
      inputs.current[0]?.focus();
    } catch (err) {
      setError(apiErrorMessage(err, 'A new code could not be sent.'));
    } finally {
      setResending(false);
    }
  }, [pending, resendIn, resending]);

  const heading = useMemo(() => collegeName, [collegeName]);

  return (
    <>
      <LoginDynamicFavicon faviconUrl={context?.institution.faviconUrl} forceProductBrand />
      <LoginPageShell
        hero={
          <div className="relative flex h-full min-h-0 flex-col lg:min-h-screen">
            <LoginHeroPanel compact context={context} />
            <LoginHeroPanel context={context} />
          </div>
        }
        auth={
          <LoginAuthPanel
            theme={context?.theme}
            loginBackgroundStyle={context?.loginBackgroundStyle}
          >
            <article className="login-auth-card mx-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xl">
              <LoginInstitutionHeader context={context} loading={contextLoading} />
              <div className="space-y-4 px-5 py-5 sm:px-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                    {heading}
                  </p>
                  <h1 className="mt-1 text-xl font-semibold text-foreground">
                    Admin Security Verification
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Enter the 6-digit code sent to{' '}
                    <span className="font-medium text-foreground">
                      {pending?.maskedEmail ?? 'your registered email'}
                    </span>
                    .
                  </p>
                </div>

                {pending ? (
                  <>
                    <div
                      className="flex justify-between gap-2"
                      onPaste={(event) => {
                        const text = event.clipboardData.getData('text');
                        if (!/\d/.test(text)) return;
                        event.preventDefault();
                        onDigit(0, text);
                      }}
                    >
                      {digits.map((digit, index) => (
                        <input
                          key={index}
                          ref={(node) => {
                            inputs.current[index] = node;
                          }}
                          inputMode="numeric"
                          autoComplete={index === 0 ? 'one-time-code' : 'off'}
                          aria-label={`Digit ${index + 1}`}
                          maxLength={6}
                          value={digit}
                          disabled={submitting}
                          onChange={(event) => onDigit(index, event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Backspace' && !digits[index] && index > 0) {
                              inputs.current[index - 1]?.focus();
                            }
                            if (event.key === 'Enter') void submit();
                          }}
                          className="h-12 w-full rounded-xl border border-border bg-background text-center text-lg font-semibold tracking-widest text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
                        />
                      ))}
                    </div>

                    <p className="text-sm text-muted-foreground" aria-live="polite">
                      {expiresIn > 0
                        ? `Code expires in ${formatClock(expiresIn)}`
                        : 'This code has expired. Request a new one or go back to sign in.'}
                      <span className="sr-only">{nowTick}</span>
                    </p>

                    <label className="flex items-start gap-2 text-sm text-foreground">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={trustDevice}
                        onChange={(event) => setTrustDevice(event.target.checked)}
                      />
                      <span>Trust this device for 30 days</span>
                    </label>

                    {info ? (
                      <p
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
                        role="status"
                      >
                        {info}
                      </p>
                    ) : null}
                    {error ? (
                      <p
                        className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                        role="alert"
                      >
                        {error}
                      </p>
                    ) : null}

                    <button
                      type="button"
                      disabled={code.length !== 6 || submitting || expiresIn === 0}
                      onClick={() => void submit()}
                      className="login-cta relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="login-cta-gradient absolute inset-0" />
                      <span className="relative z-10 flex items-center gap-2">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Verify & Continue
                      </span>
                    </button>

                    <div className="flex items-center justify-between text-sm">
                      <button
                        type="button"
                        className="font-medium text-primary disabled:cursor-not-allowed disabled:text-muted-foreground"
                        disabled={resendIn > 0 || resending}
                        onClick={() => void resend()}
                      >
                        {resending
                          ? 'Sending…'
                          : resendIn > 0
                            ? `Resend OTP in ${resendIn}s`
                            : 'Resend OTP'}
                      </button>
                      <Link
                        href="/login"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => clearStoredAdminEmailOtp()}
                      >
                        Back to Login
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Sign in with the admin account first. The verification code is sent only after
                      the password is accepted.
                    </p>
                    <Link href="/login" className="text-sm font-medium text-primary">
                      Back to Login
                    </Link>
                  </div>
                )}

                <p className="flex items-center gap-2 border-t border-border/40 pt-3 text-[10px] text-muted-foreground">
                  <Shield className="h-3 w-3 text-primary/80" aria-hidden />
                  This extra check applies to admin accounts on a new device.
                </p>
              </div>
            </article>
          </LoginAuthPanel>
        }
      />
    </>
  );
}
