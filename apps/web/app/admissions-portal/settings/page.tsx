'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, Mail, Phone, User } from 'lucide-react';
import { AdmissionsApplicantLayout } from '@/components/admissions-portal/admissions-applicant-layout';
import { AdmissionsChangePasswordDialog } from '@/components/admissions-portal/admissions-change-password-dialog';
import { applicantDisplayName } from '@/components/admissions-portal/utils';
import { fetchApplicantMe } from '@/services/admissions-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

export default function ApplicantSettingsPage() {
  const enabled = useAuthQueryEnabled();
  const [passwordOpen, setPasswordOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['applicant-me'],
    queryFn: fetchApplicantMe,
    enabled,
  });

  const app = data?.application;
  const name = app ? applicantDisplayName(app) : 'Applicant';

  return (
    <AdmissionsApplicantLayout>
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/admissions-portal/dashboard">← Dashboard</Link>
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-[#1a2b4b]">Account settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          View your registration details and manage your portal password.
        </p>

        {isLoading ? (
          <p className="mt-6 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <SettingRow icon={User} label="Full name" value={name} />
            <SettingRow
              icon={User}
              label="Application number"
              value={app?.applicationNumber ?? '—'}
              mono
            />
            <SettingRow icon={Mail} label="Email" value={app?.email ?? '—'} />
            <SettingRow icon={Phone} label="Mobile" value={app?.phone ?? '—'} />
          </div>
        )}

        <div className="mt-8 rounded-lg border border-slate-100 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 font-semibold text-[#1a2b4b]">
                <KeyRound className="h-4 w-4" />
                Password
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Change your portal login password. You will be signed out after a successful update.
              </p>
            </div>
            <Button className="rounded-full bg-[#1a2b4b]" onClick={() => setPasswordOpen(true)}>
              Change password
            </Button>
          </div>
        </div>
      </div>

      <AdmissionsChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </AdmissionsApplicantLayout>
  );
}

function SettingRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p
        className={
          mono ? 'mt-1 font-mono font-semibold text-[#1a2b4b]' : 'mt-1 font-semibold text-[#1a2b4b]'
        }
      >
        {value}
      </p>
    </div>
  );
}
