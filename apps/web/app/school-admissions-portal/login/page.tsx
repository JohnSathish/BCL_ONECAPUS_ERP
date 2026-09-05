'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, Lock, LogIn, Mail, UserRoundPlus } from 'lucide-react';
import { SchoolPublicSplit } from '@/components/school-admissions-portal/school-public-split';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { useAuthStore } from '@/store/auth-store';
import { apiErrorMessage } from '@/utils/api-error';
import { fetchSchoolPortalInfo, loginSchoolApplicant } from '@/services/school-admissions';

const schema = z.object({
  applicationNumber: z.string().min(4),
  password: z.string().min(4),
  rememberMe: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;
const CREDENTIALS_KEY = 'tps-kg-registration';

export default function SchoolAdmissionsLoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState<{
    username?: string;
    password?: string;
    email?: string;
  } | null>(null);
  const portalInfo = useQuery({
    queryKey: ['school-admissions-info'],
    queryFn: fetchSchoolPortalInfo,
  });
  const {
    register,
    handleSubmit,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { rememberMe: true } });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(CREDENTIALS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { username?: string; password?: string; email?: string };
      setSaved(parsed);
      if (parsed.username) setValue('applicationNumber', parsed.username);
      if (parsed.password) setValue('password', parsed.password);
    } catch {
      /* ignore */
    }
  }, [setValue]);

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      const session = await loginSchoolApplicant({
        applicationNumber: values.applicationNumber,
        password: values.password,
        rememberMe: values.rememberMe,
      });
      sessionStorage.removeItem(CREDENTIALS_KEY);
      setSession(session);
      tokenRefreshManager.scheduleProactiveRefresh(session);
      router.replace('/school-admissions-portal/dashboard');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <SchoolPublicSplit>
      <form onSubmit={handleSubmit(onSubmit)} className="tps-public-card p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf5ee] text-[#1a5336]">
            <UserRoundPlus className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#1a5336]">Applicant Login</p>
            <h2 className="tps-serif mt-0.5 text-[1.65rem] leading-tight text-slate-900">
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Sign in with your application number or parent email to continue your K.G.
              application.
            </p>
          </div>
        </div>

        {saved?.username ? (
          <div className="mt-4 rounded-xl bg-[#eaf5ee] p-3 text-sm">
            <p>
              Username: <strong className="font-mono">{saved.username}</strong>
            </p>
            {saved.password ? (
              <p>
                Password: <strong className="font-mono">{saved.password}</strong>
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              These details were also emailed{saved.email ? ` to ${saved.email}` : ''}.
            </p>
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          <div>
            <Label htmlFor="applicationNumber">Application number / Email</Label>
            <div className="relative mt-1">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1a5336]" />
              <Input
                id="applicationNumber"
                placeholder="TPS27-0002"
                autoComplete="username"
                className="tps-public-input h-12 pl-10"
                {...register('applicationNumber')}
              />
            </div>
            {errors.applicationNumber ? (
              <p className="text-xs text-destructive">{errors.applicationNumber.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="relative mt-1">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1a5336]" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="tps-public-input h-12 px-10"
                {...register('password')}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                onClick={() => setShowPassword((open) => !open)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-slate-600">
              <input type="checkbox" className="accent-[#1a5336]" {...register('rememberMe')} />
              Remember me
            </label>
            <Link
              className="font-medium text-[#1a5336] underline"
              href="/school-admissions-portal/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button
            type="submit"
            className="h-12 w-full bg-[#1a5336] text-white hover:bg-[#15462d]"
            disabled={isSubmitting}
          >
            <LogIn className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Signing in…' : 'Login'}
          </Button>
        </div>

        <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          OR
          <span className="h-px flex-1 bg-slate-200" />
        </div>
        {portalInfo.data?.isOpen === false ? (
          <p className="mt-3 text-center text-sm text-slate-600">
            {portalInfo.data.message || 'Online admissions are currently closed.'}
            {portalInfo.data.lastDateLabel
              ? ` The last date to apply was ${portalInfo.data.lastDateLabel}.`
              : ''}
          </p>
        ) : (
          <p className="mt-3 text-center text-sm text-slate-600">
            New applicant?{' '}
            <Link
              className="font-semibold text-[#1a5336] underline"
              href="/school-admissions-portal/register"
            >
              Register here
            </Link>
          </p>
        )}
      </form>
    </SchoolPublicSplit>
  );
}
