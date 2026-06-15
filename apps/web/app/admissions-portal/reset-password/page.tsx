'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { confirmApplicantPasswordReset, fetchPortalInfo } from '@/services/admissions-portal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/utils/api-error';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';

  const portalInfo = useQuery({ queryKey: ['admissions-portal-info'], queryFn: fetchPortalInfo });
  const branding = portalInfo.data?.branding;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => confirmApplicantPasswordReset({ token, newPassword, confirmPassword }),
    onSuccess: () => {
      router.replace('/admissions-portal/login?reset=success');
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not reset password')),
  });

  if (!token) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
        This reset link is invalid.{' '}
        <Link href="/admissions-portal/forgot-password" className="font-semibold underline">
          Request a new link
        </Link>
        .
      </div>
    );
  }

  return (
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
        <h1 className="mt-4 flex items-center justify-center gap-2 text-xl font-bold text-[#1a2b4b]">
          <KeyRound className="h-5 w-5" />
          Set new password
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose a new password for your admission portal account.
        </p>
      </div>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
          }
          mutation.mutate();
        }}
      >
        <div>
          <Label htmlFor="new-password">New password</Label>
          <div className="relative mt-1">
            <Input
              id="new-password"
              type={showPassword ? 'text' : 'password'}
              className="bg-[#fefce8] pr-16"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#2563eb]"
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        <div>
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            className="mt-1 bg-[#fefce8]"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <Button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-full bg-[#2563eb] py-6"
        >
          {mutation.isPending ? 'Saving…' : 'Update password'}
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
  );
}

export default function ApplicantResetPasswordPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{
        backgroundColor: '#e8f0fe',
        backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <Suspense fallback={<p className="text-sm text-slate-600">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
