'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import { AuthField, JournalAuthLayout } from '@/components/journals-portal/journal-auth-layout';
import {
  fetchJournalPortalInfo,
  fetchJournalPortalMe,
  journalPortalLogin,
} from '@/services/journals-portal';
import { bootstrapSession } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import { apiErrorMessage } from '@/utils/api-error';
import type { AuthSession } from '@/types/auth';

const NAVY = '#0B2545';

function JournalLoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const registered = search.get('registered') === '1';
  const emailFromQuery = search.get('email') ?? '';
  const setSession = useAuthStore((s) => s.setSession);
  const existing = useAuthStore((s) => s.session);
  const infoQ = useQuery({
    queryKey: ['journal-portal-info'],
    queryFn: fetchJournalPortalInfo,
    staleTime: 60_000,
  });
  const short = infoQ.data?.journal?.shortName || infoQ.data?.journal?.name || 'TRANSIENT';

  const [email, setEmail] = useState(emailFromQuery);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [erpReady, setErpReady] = useState(Boolean(existing?.accessToken));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (existing?.accessToken) {
        setErpReady(true);
        return;
      }
      try {
        const session = await bootstrapSession();
        if (!cancelled && session?.accessToken) {
          setSession(session);
          useAuthStore.getState().setBootstrapping(false);
          setErpReady(true);
        }
      } catch {
        /* no ERP session */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existing?.accessToken, setSession]);

  async function continueWithErp() {
    setError('');
    setLoading(true);
    try {
      await fetchJournalPortalMe();
      router.replace('/journals-portal/author');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not continue with ERP session'));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await journalPortalLogin({ email, password, rememberMe });
      const authSession: AuthSession = {
        accessToken: session.accessToken,
        expiresIn: session.expiresIn,
        expiresAt: session.expiresAt,
        user: {
          id: session.user.id,
          email: session.user.email,
          displayName: session.user.displayName,
          tenantId: session.user.tenantId,
          tenantSlug: session.user.tenantSlug,
          roles: session.user.roles,
          permissions: session.user.permissions,
        },
      };
      setSession(authSession);
      useAuthStore.getState().setBootstrapping(false);
      router.replace('/journals-portal/author');
    } catch (err) {
      setError(apiErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <JournalAuthLayout mode="login">
      <div>
        <p className="jp-auth-section-title">Welcome back</p>
        <h2
          className="jp-serif mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ color: NAVY }}
        >
          Sign in to {short}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#0B2545]/75">
          Access your author desk, submissions, and reviewer assignments.
        </p>
      </div>

      {registered ? (
        <p className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Account created
          {emailFromQuery ? (
            <>
              {' '}
              for <strong>{emailFromQuery}</strong>
            </>
          ) : null}
          . Sign in with your new credentials.
        </p>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <AuthField id="login-email" label="Email address" icon={<Mail className="h-4 w-4" />}>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@institution.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </AuthField>

        <AuthField
          id="login-password"
          label="Password"
          icon={<Lock className="h-4 w-4" />}
          className="has-toggle"
        >
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-[#0B2545]/45 hover:text-[#0B2545]"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </AuthField>

        <div className="flex items-center justify-between gap-3 pt-1 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[#0B2545]/75">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-[#0B2545]/25 accent-[#D4A017]"
            />
            Remember me
          </label>
          <Link
            href="/journals-portal/contact"
            className="font-medium text-[#0B2545]/65 underline-offset-2 hover:text-[#0B2545] hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={loading} className="jp-auth-submit">
          {loading ? 'Signing in…' : 'Sign in'}
          {!loading ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
      </form>

      {erpReady ? (
        <>
          <div className="jp-auth-divider my-6">OR</div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void continueWithErp()}
            className="w-full rounded-xl border border-[#0B2545]/15 bg-white/80 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-[#0B2545] transition hover:border-[#D4A017]/5 hover:bg-[var(--jp-card)]"
          >
            Continue with ERP login
          </button>
        </>
      ) : null}

      <p className="mt-7 text-center text-sm text-[#0B2545]/65">
        New author?{' '}
        <Link
          href="/journals-portal/register"
          className="font-semibold text-[#0B2545] underline-offset-2 hover:underline"
        >
          Register →
        </Link>
      </p>
    </JournalAuthLayout>
  );
}

export default function JournalLoginPage() {
  return (
    <JournalPublicShell>
      <Suspense
        fallback={<div className="px-4 py-20 text-center text-sm text-[#0B2545]/55">Loading…</div>}
      >
        <JournalLoginForm />
      </Suspense>
    </JournalPublicShell>
  );
}
