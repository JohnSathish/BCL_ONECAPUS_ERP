'use client';

import Link from 'next/link';
import { AdmissionsApplicantLayout } from '@/components/admissions-portal/admissions-applicant-layout';
import { AdmissionsInstructionsContent } from '@/components/admissions-portal/admissions-instructions-content';
import { fetchPortalInfo } from '@/services/admissions-portal';
import { usePortalCycleSettings } from '@/hooks/use-portal-cycle-settings';
import { Button } from '@/components/ui/button';

export default function ApplicantInstructionsPage() {
  const { settings, portalInfo } = usePortalCycleSettings();

  return (
    <AdmissionsApplicantLayout>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" asChild>
          <Link href="/admissions-portal/dashboard">← Dashboard</Link>
        </Button>
        {portalInfo?.isOpen ? (
          <Button asChild className="rounded-full bg-[#2563eb]">
            <Link href="/admissions-portal/register">New registration</Link>
          </Button>
        ) : null}
      </div>

      <div className="mb-4">
        <h1 className="text-2xl font-bold text-[#1a2b4b]">Admission instructions</h1>
        <p className="mt-1 text-sm text-slate-600">
          Step-by-step guide for FYUGP Semester 1 online admission.
        </p>
      </div>

      <AdmissionsInstructionsContent info={portalInfo} cycleSettings={settings} />
    </AdmissionsApplicantLayout>
  );
}
