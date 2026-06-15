'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchApplicantStatus } from '@/services/admissions-portal';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { AdmissionsApplicantLayout } from '@/components/admissions-portal/admissions-applicant-layout';
import { AdmissionsMeritPanel } from '@/components/admissions-portal/admissions-merit-panel';
import { AdmissionsPaymentPanel } from '@/components/admissions-portal/admissions-payment-panel';
import { formatInr } from '@/components/admissions-portal/cycle-settings';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

export default function ApplicantStatusPage() {
  const enabled = useAuthQueryEnabled();
  const { data, isLoading } = useQuery({
    queryKey: ['applicant-status'],
    queryFn: fetchApplicantStatus,
    enabled,
  });

  return (
    <AdmissionsApplicantLayout>
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/admissions-portal/dashboard">← Dashboard</Link>
        </Button>
      </div>

      <div className="mb-6">
        <AdmissionsMeritPanel
          compact
          meritRank={data?.meritRank}
          meritRound={data?.meritRound}
          meritScore={data?.meritScore}
          applicationStatus={data?.application?.status}
          waitingList={data?.waitingList}
        />
      </div>

      <div className="mb-6">
        <AdmissionsPaymentPanel compact />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[#1a2b4b]">
          {isLoading ? 'Loading…' : 'Application timeline'}
        </h2>
        <ol className="mt-6 space-y-4">
          {(data?.steps ?? []).map(
            (step: { key: string; label: string; done: boolean; at?: string | null }) => (
              <li key={step.key} className="flex items-start gap-3">
                <span
                  className={cn(
                    'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                    step.done
                      ? 'bg-emerald-500 text-white'
                      : 'border border-slate-200 bg-slate-50 text-slate-400',
                  )}
                >
                  {step.done ? '✓' : '·'}
                </span>
                <div>
                  <p className={cn('font-medium', step.done ? 'text-[#1a2b4b]' : 'text-slate-500')}>
                    {step.label}
                  </p>
                  {step.at ? (
                    <p className="text-xs text-slate-500">{new Date(step.at).toLocaleString()}</p>
                  ) : null}
                </div>
              </li>
            ),
          )}
        </ol>

        {data?.admissionFeeStatus && data.admissionFeeStatus !== 'NOT_APPLICABLE' ? (
          <div
            className={cn(
              'mt-6 rounded-lg border px-4 py-3 text-sm',
              data.admissionFeeStatus === 'PAID' || data.admissionFeeStatus === 'WAIVED'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900',
            )}
          >
            <p className="font-semibold">Admission fee (after selection)</p>
            {data.admissionFeeAmount != null ? (
              <p className="mt-1">
                Amount due: <strong>{formatInr(data.admissionFeeAmount)}</strong>
              </p>
            ) : null}
            <p className="mt-1">
              Status: <strong>{data.admissionFeeStatus.replace(/_/g, ' ')}</strong>
            </p>
            {data.admissionFeeStatus === 'PENDING' ? (
              <p className="mt-2 text-xs">
                You have been selected for admission. Pay the admission fee amount shown above at
                the college office (or as directed in your offer letter). This is separate from the
                ₹600 application fee paid at registration.
              </p>
            ) : null}
          </div>
        ) : null}

        {data?.allocation ? (
          <p className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Seat allocation: <strong>{data.allocation.status}</strong>
            {data.allocation.shiftName ? ` · ${data.allocation.shiftName}` : ''}
          </p>
        ) : null}
      </div>
    </AdmissionsApplicantLayout>
  );
}
