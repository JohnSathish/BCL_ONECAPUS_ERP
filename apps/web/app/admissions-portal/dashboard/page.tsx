'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  CreditCard,
  FileText,
  FileWarning,
  IndianRupee,
} from 'lucide-react';
import { fetchApplicantMe, fetchPaymentInfo } from '@/services/admissions-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { usePortalCycleSettings } from '@/hooks/use-portal-cycle-settings';
import { AdmissionsApplicantLayout } from '@/components/admissions-portal/admissions-applicant-layout';
import { AdmissionsMeritPanel } from '@/components/admissions-portal/admissions-merit-panel';
import { applicationFeeHint, formatInr } from '@/components/admissions-portal/cycle-settings';
import { applicantDisplayName, applicantPhotoUrl } from '@/components/admissions-portal/utils';
import { findMissingRequiredDocuments } from '@/components/admissions-portal/constants';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

const JOURNEY = [
  {
    key: 'form',
    label: 'Application information',
    hint: 'Personal details through course preferences',
  },
  { key: 'docs', label: 'Documents & uploads', hint: 'Mark sheets and declaration on the form' },
  { key: 'fee', label: 'Application fee', hint: 'Secure online payment' },
  { key: 'submit', label: 'Submit to admissions', hint: 'Application sent for review' },
] as const;

export default function ApplicantDashboardPage() {
  const enabled = useAuthQueryEnabled();
  const { data, isLoading } = useQuery({
    queryKey: ['applicant-me'],
    queryFn: fetchApplicantMe,
    enabled,
  });

  const paymentQuery = useQuery({
    queryKey: ['applicant-payment-info'],
    queryFn: fetchPaymentInfo,
    enabled,
  });

  const { settings: cycleSettings } = usePortalCycleSettings();

  const app = data?.application;
  const name = app ? applicantDisplayName(app) : 'Applicant';
  const photo = applicantPhotoUrl(app?.documents);
  const progress = app?.progressPercent ?? 0;
  const feePaid = app?.paymentStatus === 'PAID' || app?.paymentStatus === 'WAIVED';
  const canPayOnline = paymentQuery.data?.canPay && !data?.readOnly;
  const missingDocs = findMissingRequiredDocuments(
    app?.documents?.map((d) => d.slotCode) ?? [],
    app?.formData as Record<string, unknown> | undefined,
  );

  return (
    <AdmissionsApplicantLayout>
      {data?.cycleArchived ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          This admission cycle is archived. Your application is read-only.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#1a4a5a] to-[#1a2b4b] p-6 text-white shadow-lg">
        <div className="flex flex-wrap items-center gap-4">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              className="h-16 w-16 rounded-full border-2 border-white/30 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-xl font-bold">
              {name.charAt(0)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm text-sky-200">Welcome back,</p>
            <h2 className="text-2xl font-bold">{name}</h2>
            <p className="font-mono text-sm text-sky-100">{app?.applicationNumber}</p>
            <p className="text-xs text-slate-300">Shift: Pending Selection</p>
          </div>
          {!data?.readOnly ? (
            <Button asChild className="rounded-full bg-white text-[#1a2b4b] hover:bg-slate-100">
              <Link href="/admissions-portal/application">
                Continue application
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          ) : null}
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs">
            <span>Form progress</span>
            <span>{isLoading ? '—' : `${progress}%`}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <StatCard icon={FileText} label="Profile" value={`${progress}% complete`} />
        <StatCard
          icon={BarChart3}
          label="Application"
          value={data?.meritRank != null ? `Rank #${data.meritRank}` : formatStatus(app?.status)}
          hint={
            data?.meritRank != null
              ? `Merit list${data.meritRound ? ` round ${data.meritRound}` : ''}`
              : undefined
          }
        />
        <StatCard
          icon={FileWarning}
          label="Documents"
          value={missingDocs.length === 0 ? 'Complete' : `${missingDocs.length} pending`}
          hint={
            missingDocs.length
              ? 'Upload photo and Class X/XII marksheets before submitting.'
              : 'Required uploads are on file.'
          }
        />
        <StatCard
          icon={IndianRupee}
          label="Fee"
          value={feePaid ? 'Paid' : paymentQuery.data?.configured ? 'Pending' : 'Pay at office'}
          hint={applicationFeeHint(cycleSettings)}
        />
      </div>

      <div className="mt-6">
        <AdmissionsMeritPanel
          meritRank={data?.meritRank}
          meritRound={data?.meritRound}
          meritScore={app?.meritScore}
          applicationStatus={app?.status}
          waitingList={data?.meritRound != null && data.meritRound > 1}
        />
      </div>

      {!data?.readOnly && progress < 100 ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-[#2563eb]/30 bg-white p-5 shadow-sm">
          <div>
            <p className="font-semibold text-[#1a2b4b]">Complete your application</p>
            <p className="text-sm text-slate-600">
              Finish all form sections before your application can be reviewed.
            </p>
          </div>
          <Button asChild className="rounded-full bg-[#2563eb]">
            <Link href="/admissions-portal/application">Continue application</Link>
          </Button>
        </div>
      ) : null}

      {!data?.readOnly && missingDocs.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-amber-300/60 bg-white p-5 shadow-sm">
          <div>
            <p className="font-semibold text-[#1a2b4b]">Documents required</p>
            <p className="text-sm text-slate-600">
              Upload photo and Class X/XII marksheets before you can submit your application.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/admissions-portal/documents">Upload documents</Link>
          </Button>
        </div>
      ) : null}

      {canPayOnline ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-emerald-300/50 bg-white p-5 shadow-sm">
          <div>
            <p className="font-semibold text-[#1a2b4b]">Application fee pending</p>
            <p className="text-sm text-slate-600">
              Pay {formatInr(paymentQuery.data?.applicationFee ?? cycleSettings.applicationFee)}{' '}
              online to complete your registration fee.
            </p>
          </div>
          <Button asChild className="rounded-full bg-emerald-600 hover:bg-emerald-700">
            <Link href="/admissions-portal/payments">
              <CreditCard className="mr-2 h-4 w-4" />
              Pay now
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-[#1a2b4b]">Your Admission Journey</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {JOURNEY.map((item, idx) => {
            const active = idx === 0 && progress < 100;
            const done =
              (idx === 0 && progress >= 85) ||
              (idx === 2 && app?.paymentStatus === 'PAID') ||
              app?.status === 'submitted';
            return (
              <div
                key={item.key}
                className={cn(
                  'rounded-lg border p-3 text-sm',
                  active && 'border-amber-300 bg-amber-50',
                  done && 'border-emerald-200 bg-emerald-50',
                  !active && !done && 'border-slate-200 bg-slate-50',
                )}
              >
                <p className="font-medium text-[#1a2b4b]">
                  {idx + 1}. {item.label}
                </p>
                <p className="mt-1 text-xs text-slate-500">{item.hint}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        <Button variant="outline" asChild>
          <Link href="/admissions-portal/application">Continue application form</Link>
        </Button>
      </div>
    </AdmissionsApplicantLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 text-[#2563eb]" />
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 text-lg font-semibold text-[#1a2b4b]">{value}</p>
          {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
        </div>
      </div>
    </div>
  );
}

function formatStatus(status?: string) {
  if (!status || status === 'draft') return 'In Progress';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
