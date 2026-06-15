'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Mail, User } from 'lucide-react';
import { fetchPortalInfo, requestApplicantPasswordReset } from '@/services/admissions-portal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/utils/api-error';

export default function ApplicantForgotPasswordPage() {
  const portalInfo = useQuery({ queryKey: ['admissions-portal-info'], queryFn: fetchPortalInfo });
  const branding = portalInfo.data?.branding;

  const [mode, setMode] = useState<'email' | 'applicationNumber'>('email');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      requestApplicantPasswordReset(
        mode === 'email' ? { email: value.trim() } : { applicationNumber: value.trim() },
      ),
    onSuccess: (res) => {
      setMessage(
        'If an account exists for those details, a reset link has been sent to the registered email address.',
      );
      setDevLink(res.devResetLink ?? null);
    },
    onError: (err) => setMessage(apiErrorMessage(err, 'Could not process request')),
  });

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
              width={64}
              height={64}
              className="mx-auto h-16 w-16 rounded-full object-contain"
              unoptimized
            />
          ) : null}
          <h1 className="mt-4 text-xl font-bold text-[#1a2b4b]">Forgot password</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter your registered email or application number. We will email a reset link to the
            address on your application.
          </p>
        </div>

        <div className="mt-6 flex rounded-lg border border-slate-200 p-1 text-sm">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 font-medium ${mode === 'email' ? 'bg-[#1a2b4b] text-white' : 'text-slate-600'}`}
            onClick={() => setMode('email')}
          >
            Email
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 font-medium ${mode === 'applicationNumber' ? 'bg-[#1a2b4b] text-white' : 'text-slate-600'}`}
            onClick={() => setMode('applicationNumber')}
          >
            Application no.
          </button>
        </div>

        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setMessage(null);
            setDevLink(null);
            mutation.mutate();
          }}
        >
          <div>
            <Label htmlFor="reset-identifier">
              {mode === 'email' ? 'Registered email' : 'Application number'}
            </Label>
            <div className="relative mt-1">
              {mode === 'email' ? (
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              ) : (
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              )}
              <Input
                id="reset-identifier"
                className="pl-10 bg-[#fefce8]"
                placeholder={mode === 'email' ? 'applicant@example.com' : 'DBCT26-0001'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>
          </div>

          {message ? (
            <p className={`text-sm ${mutation.isError ? 'text-red-600' : 'text-emerald-700'}`}>
              {message}
            </p>
          ) : null}

          {devLink ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
              <p className="font-semibold">Dev preview (SMTP not configured)</p>
              <a href={devLink} className="mt-1 block break-all text-[#2563eb] hover:underline">
                {devLink}
              </a>
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={mutation.isPending || !value.trim()}
            className="w-full rounded-full bg-[#2563eb] py-6"
          >
            {mutation.isPending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link
            href="/admissions-portal/login"
            className="font-semibold text-[#2563eb] hover:underline"
          >
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
