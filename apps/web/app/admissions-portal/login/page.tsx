'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Lock, User } from 'lucide-react';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { fetchPortalInfo, loginApplicant } from '@/services/admissions-portal';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
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
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const resetSuccess = searchParams.get('reset') === 'success';

  const portalInfo = useQuery({ queryKey: ['admissions-portal-info'], queryFn: fetchPortalInfo });
  const branding = portalInfo.data?.branding;

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
      const session = await loginApplicant(values);
      setSession(session);
      tokenRefreshManager.scheduleProactiveRefresh(session);
      router.replace('/admissions-portal/dashboard');
    } catch (e) {
      setError(apiErrorMessage(e, 'Login failed'));
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{
        backgroundColor: '#e8f0fe',
        backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <div className="text-center">
          {branding?.logoUrl ? (
            <Image
              src={branding.logoUrl}
              alt=""
              width={80}
              height={80}
              className="mx-auto h-20 w-20 rounded-full object-contain"
              unoptimized
            />
          ) : null}
          <h1 className="mt-4 text-xl font-bold text-[#1a2b4b]">
            {branding?.displayName ?? 'Don Bosco College, Tura'}
          </h1>
          <p className="text-sm text-slate-500">Admission Portal 2026–2027</p>
        </div>

        <h2 className="mt-8 text-lg font-bold text-[#1a2b4b]">Applicant Login</h2>
        <p className="mt-1 text-sm text-slate-500">
          Use your application number or registered email, and the password from registration.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Application Number / Email</span>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded-lg border border-slate-200 bg-[#fefce8] pl-10 pr-3 text-sm outline-none focus:border-[#2563eb]"
                placeholder="DBCT26-0001"
                {...register('applicationNumber')}
              />
            </div>
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                className="h-11 w-full rounded-lg border border-slate-200 bg-[#fefce8] pl-10 pr-16 text-sm outline-none focus:border-[#2563eb]"
                {...register('password')}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#2563eb]"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </label>

          <Link
            href="/admissions-portal/forgot-password"
            className="text-sm text-[#2563eb] hover:underline"
          >
            Forgot password?
          </Link>

          {resetSuccess ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Password updated successfully. Sign in with your new password.
            </p>
          ) : null}

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" {...register('rememberMe')} />
            Remember me on this device
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-full bg-[#2563eb] py-6 text-base"
            >
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </Button>
            <Link href="/admissions-portal" className="text-sm text-[#2563eb] hover:underline">
              Need help?
            </Link>
          </div>
        </form>

        <div className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link
            href="/admissions-portal/register"
            className="font-semibold text-[#2563eb] hover:underline"
          >
            Register here
          </Link>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500">
          <p className="font-semibold uppercase tracking-wide">Admission Help Desk:</p>
          <p className="mt-1 text-[#2563eb]">+91 9402152496 / +91 9566363655</p>
        </div>
      </div>
    </div>
  );
}

export default function ApplicantLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
