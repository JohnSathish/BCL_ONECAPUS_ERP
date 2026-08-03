'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, Headset, Lock, User } from 'lucide-react';
import {
  AdmissionsAuthCard,
  AdmissionsAuthCardHeader,
  AdmissionsAuthFooterLinks,
  AdmissionsAuthLayout,
  AdmissionsHelpDeskBox,
} from '@/components/admissions-portal/admissions-auth-layout';
import { resolvePortalCycleSettings } from '@/components/admissions-portal/cycle-settings';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { fetchPortalInfo, loginApplicant } from '@/services/admissions-portal';
import { useAuthStore } from '@/store/auth-store';
import { apiErrorMessage } from '@/utils/api-error';

const schema = z.object({
  applicationNumber: z.string().min(4),
  password: z.string().min(4),
  rememberMe: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, isReady } = useAuth();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const resetSuccess = searchParams.get('reset') === 'success';

  useEffect(() => {
    if (!isReady || !session) return;
    router.replace('/admissions-portal/dashboard');
  }, [isReady, session, router]);

  const portalInfo = useQuery({ queryKey: ['admissions-portal-info'], queryFn: fetchPortalInfo });
  const branding = portalInfo.data?.branding;
  const help = useMemo(
    () => resolvePortalCycleSettings({ portalInfo: portalInfo.data }),
    [portalInfo.data],
  );

  const collegeName = branding?.displayName ?? 'Don Bosco College Tura';
  const portalSubtitle =
    branding?.portalSubtitle?.trim() ||
    portalInfo.data?.cycle?.title ||
    'Admission Portal 2026–2027';

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rememberMe: false },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const next = await loginApplicant(values);
      setSession(next);
      tokenRefreshManager.scheduleProactiveRefresh(next);
      router.replace('/admissions-portal/dashboard');
    } catch (e) {
      setError(apiErrorMessage(e, 'Login failed'));
    }
  };

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e8f1fb] text-sm text-slate-500">
        Loading…
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e8f1fb] text-sm text-slate-500">
        Redirecting…
      </div>
    );
  }

  return (
    <AdmissionsAuthLayout
      collegeName={collegeName}
      portalSubtitle={portalSubtitle}
      logoUrl={branding?.logoUrl}
      admissionsOpen={portalInfo.data?.isOpen !== false}
      openMessage={
        portalInfo.data?.isOpen === false
          ? portalInfo.data.message || 'Online admissions are currently closed.'
          : undefined
      }
    >
      <AdmissionsAuthCard>
        <AdmissionsAuthCardHeader
          collegeName={collegeName}
          portalSubtitle={portalSubtitle}
          logoUrl={branding?.logoUrl}
          title="Applicant Login"
          description="Use your application number or registered email, and the password from registration."
        />

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Application Number / Email</span>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-12 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                placeholder="DBCT26-0001"
                autoComplete="username"
                {...register('applicationNumber')}
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="h-12 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-12 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                placeholder="Enter your password"
                autoComplete="current-password"
                {...register('password')}
              />
              <button
                type="button"
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          <div className="flex items-center justify-between gap-3 text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
                {...register('rememberMe')}
              />
              Remember me on this device
            </label>
            <Link
              href="/admissions-portal/forgot-password"
              className="font-semibold text-blue-700 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {resetSuccess ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Password updated successfully. Sign in with your new password.
            </p>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 w-full rounded-full bg-[#2563eb] text-base font-semibold hover:bg-blue-700"
          >
            <Lock className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Signing in…' : 'Sign In'}
            {!isSubmitting ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Need help?
          </span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-2">
            <Headset className="mt-3 h-4 w-4 shrink-0 text-sky-700" />
            <div className="min-w-0 flex-1">
              <AdmissionsHelpDeskBox phone={help.helpDesk.phone} email={help.helpDesk.email} />
            </div>
          </div>
          <AdmissionsAuthFooterLinks />
        </div>
      </AdmissionsAuthCard>
    </AdmissionsAuthLayout>
  );
}

export default function ApplicantLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#e8f1fb] text-slate-500">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
