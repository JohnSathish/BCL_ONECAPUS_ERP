'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Mail, User } from 'lucide-react';
import {
  AdmissionsAuthCard,
  AdmissionsAuthCardHeader,
  AdmissionsAuthLayout,
  AdmissionsHelpDeskBox,
} from '@/components/admissions-portal/admissions-auth-layout';
import { resolvePortalCycleSettings } from '@/components/admissions-portal/cycle-settings';
import { Button } from '@/components/ui/button';
import { fetchPortalInfo, requestApplicantPasswordReset } from '@/services/admissions-portal';
import { apiErrorMessage } from '@/utils/api-error';

export default function ApplicantForgotPasswordPage() {
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
    <AdmissionsAuthLayout
      collegeName={collegeName}
      portalSubtitle={portalSubtitle}
      logoUrl={branding?.logoUrl}
      admissionsOpen={portalInfo.data?.isOpen !== false}
    >
      <AdmissionsAuthCard>
        <AdmissionsAuthCardHeader
          collegeName={collegeName}
          portalSubtitle={portalSubtitle}
          logoUrl={branding?.logoUrl}
          title="Forgot password"
          description="Enter your registered email or application number. We will email a reset link to the address on your application."
        />

        <div className="mt-6 flex rounded-full border border-slate-200 p-1 text-sm">
          <button
            type="button"
            className={`flex-1 rounded-full px-3 py-2 font-medium ${mode === 'email' ? 'bg-[#0b2545] text-white' : 'text-slate-600'}`}
            onClick={() => setMode('email')}
          >
            Email
          </button>
          <button
            type="button"
            className={`flex-1 rounded-full px-3 py-2 font-medium ${mode === 'applicationNumber' ? 'bg-[#0b2545] text-white' : 'text-slate-600'}`}
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
            <label className="text-sm font-medium text-slate-700">
              {mode === 'email' ? 'Registered email' : 'Application number'}
            </label>
            <div className="relative mt-1.5">
              {mode === 'email' ? (
                <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              ) : (
                <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              )}
              <input
                id="reset-identifier"
                className="h-12 w-full rounded-full border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={mode === 'email' ? 'you@example.com' : 'DBCT26-0001'}
                required
              />
            </div>
          </div>

          {message ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {message}
            </p>
          ) : null}
          {devLink ? (
            <p className="break-all rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Dev reset link: {devLink}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={mutation.isPending || !value.trim()}
            className="h-12 w-full rounded-full bg-[#2563eb] hover:bg-blue-700"
          >
            {mutation.isPending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>

        <div className="mt-6 space-y-4">
          <AdmissionsHelpDeskBox phone={help.helpDesk.phone} email={help.helpDesk.email} />
          <p className="text-center text-sm text-slate-600">
            <Link
              href="/admissions-portal/login"
              className="font-semibold text-blue-700 hover:underline"
            >
              Back to login
            </Link>
          </p>
        </div>
      </AdmissionsAuthCard>
    </AdmissionsAuthLayout>
  );
}
