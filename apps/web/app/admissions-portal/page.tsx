'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchPortalInfo } from '@/services/admissions-portal';
import {
  AdmissionsCtaButtons,
  AdmissionsPublicShell,
} from '@/components/admissions-portal/admissions-public-shell';
import { AdmissionsInstructionsContent } from '@/components/admissions-portal/admissions-instructions-content';
import { AdmissionsScheduleBanner } from '@/components/admissions-portal/admissions-schedule-banner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdmissionsPortalLandingPage() {
  const { data: info, isLoading } = useQuery({
    queryKey: ['admissions-portal-info'],
    queryFn: fetchPortalInfo,
  });

  return (
    <AdmissionsPublicShell showHero={false}>
      <AdmissionsScheduleBanner info={info} />

      <Card className="mt-8 border-white/10 bg-white/5 text-white backdrop-blur-md">
        <CardHeader>
          <CardTitle>
            {isLoading
              ? 'Loading admission schedule…'
              : info?.isOpen
                ? 'Apply for FYUP Semester 1'
                : 'Admissions closed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-slate-300">
          <p>
            Complete your online registration, fill the 7-step application form, upload documents,
            and track your admission status through this portal.
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>Register to receive your application number (e.g. DBCT26-0001)</li>
            <li>Save progress at each step — resume anytime</li>
            <li>Choose major, minor, MDC, AEC, SEC &amp; VAC with subject codes</li>
            <li>Track verification, merit rank, and seat allotment</li>
          </ul>
          <AdmissionsCtaButtons isOpen={info?.isOpen} />
        </CardContent>
      </Card>

      <div className="mt-8">
        <AdmissionsInstructionsContent info={info} />
      </div>
    </AdmissionsPublicShell>
  );
}
