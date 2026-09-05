'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Mail } from 'lucide-react';
import { SchoolPublicSplit } from '@/components/school-admissions-portal/school-public-split';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/utils/api-error';
import {
  confirmSchoolPasswordReset,
  requestSchoolPasswordReset,
} from '@/services/school-admissions';

const requestSchema = z.object({
  emailOrApplicationNumber: z.string().min(4, 'Enter application number or parent email'),
});

const confirmSchema = z
  .object({
    emailOrApplicationNumber: z.string().min(4),
    otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit OTP'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RequestValues = z.infer<typeof requestSchema>;
type ConfirmValues = z.infer<typeof confirmSchema>;

export default function SchoolForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState('');

  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
  });
  const confirmForm = useForm<ConfirmValues>({
    resolver: zodResolver(confirmSchema),
  });

  const onRequest = async (values: RequestValues) => {
    setError(null);
    setMessage(null);
    try {
      const data = await requestSchoolPasswordReset(values.emailOrApplicationNumber);
      setIdentifier(values.emailOrApplicationNumber.trim());
      confirmForm.setValue('emailOrApplicationNumber', values.emailOrApplicationNumber.trim());
      setMessage(data.emailHint ? `${data.message} (${data.emailHint})` : data.message);
      setStep('confirm');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const onConfirm = async (values: ConfirmValues) => {
    setError(null);
    setMessage(null);
    try {
      const data = await confirmSchoolPasswordReset({
        emailOrApplicationNumber: values.emailOrApplicationNumber,
        otp: values.otp,
        newPassword: values.newPassword,
      });
      setMessage(data.message);
      window.setTimeout(() => {
        router.push('/school-admissions-portal/login');
      }, 1500);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <SchoolPublicSplit>
      <div className="tps-public-card relative p-6 sm:p-8">
        <div className="mb-5">
          <p className="inline-flex rounded-full bg-[#eaf5ee] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1a5336]">
            Account recovery
          </p>
          <h2 className="tps-serif mt-2 text-2xl text-slate-900">Reset password</h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter your application number or registered parent email. We will send a one-time code
            to the parent email on file.
          </p>
        </div>

        {step === 'request' ? (
          <form className="space-y-4" onSubmit={requestForm.handleSubmit(onRequest)} noValidate>
            <div className="space-y-2">
              <Label htmlFor="emailOrApplicationNumber">Application number or email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="emailOrApplicationNumber"
                  className="tps-public-input h-12 px-10"
                  placeholder="TPS27-0001 or parent@email.com"
                  {...requestForm.register('emailOrApplicationNumber')}
                />
              </div>
              {requestForm.formState.errors.emailOrApplicationNumber ? (
                <p className="text-sm text-destructive">
                  {requestForm.formState.errors.emailOrApplicationNumber.message}
                </p>
              ) : null}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <Button
              type="submit"
              className="h-12 w-full bg-[#1a5336] text-white hover:bg-[#15462d]"
              disabled={requestForm.formState.isSubmitting}
            >
              {requestForm.formState.isSubmitting ? 'Sending…' : 'Send reset OTP'}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={confirmForm.handleSubmit(onConfirm)} noValidate>
            <input type="hidden" {...confirmForm.register('emailOrApplicationNumber')} />
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Resetting for <span className="font-medium text-slate-900">{identifier}</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="otp">Email OTP</Label>
              <Input
                id="otp"
                className="tps-public-input h-12"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                {...confirmForm.register('otp')}
              />
              {confirmForm.formState.errors.otp ? (
                <p className="text-sm text-destructive">
                  {confirmForm.formState.errors.otp.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="newPassword"
                  type="password"
                  className="tps-public-input h-12 px-10"
                  {...confirmForm.register('newPassword')}
                />
              </div>
              {confirmForm.formState.errors.newPassword ? (
                <p className="text-sm text-destructive">
                  {confirmForm.formState.errors.newPassword.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                className="tps-public-input h-12"
                {...confirmForm.register('confirmPassword')}
              />
              {confirmForm.formState.errors.confirmPassword ? (
                <p className="text-sm text-destructive">
                  {confirmForm.formState.errors.confirmPassword.message}
                </p>
              ) : null}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
            <Button
              type="submit"
              className="h-12 w-full bg-[#1a5336] text-white hover:bg-[#15462d]"
              disabled={confirmForm.formState.isSubmitting}
            >
              {confirmForm.formState.isSubmitting ? 'Updating…' : 'Update password'}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-[#1a5336] underline"
              onClick={() => {
                setStep('request');
                setError(null);
                setMessage(null);
              }}
            >
              Request a new OTP
            </button>
          </form>
        )}

        {step === 'request' && message ? (
          <p className="mt-3 text-sm text-emerald-800">{message}</p>
        ) : null}

        <p className="mt-5 text-center text-sm text-slate-600">
          <Link
            className="font-semibold text-[#1a5336] underline"
            href="/school-admissions-portal/login"
          >
            Back to login
          </Link>
        </p>
      </div>
    </SchoolPublicSplit>
  );
}
