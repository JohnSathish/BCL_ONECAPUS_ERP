'use client';

import Link from 'next/link';
import { AdmissionsApplicantLayout } from '@/components/admissions-portal/admissions-applicant-layout';
import { AdmissionsPaymentPanel } from '@/components/admissions-portal/admissions-payment-panel';
import { formatInr } from '@/components/admissions-portal/cycle-settings';
import { usePortalCycleSettings } from '@/hooks/use-portal-cycle-settings';
import { Button } from '@/components/ui/button';

export default function ApplicantPaymentsPage() {
  const { settings } = usePortalCycleSettings();

  return (
    <AdmissionsApplicantLayout>
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/admissions-portal/dashboard">← Dashboard</Link>
        </Button>
      </div>

      <AdmissionsPaymentPanel />

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
        <h3 className="font-semibold text-[#1a2b4b]">Payment notes</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            The application fee is {formatInr(settings.applicationFee)} and is non-refundable once
            paid.
          </li>
          <li>
            If allotted a seat, you will need to pay at least {formatInr(settings.admissionFeeMin)}{' '}
            towards admission and session fees as directed by the office.
          </li>
          <li>
            If online payment is unavailable, visit the admissions office with your application
            number and pay in person.
          </li>
          <li>
            After payment, continue your application form and upload required documents before the
            deadline.
          </li>
        </ul>
      </div>
    </AdmissionsApplicantLayout>
  );
}
