'use client';

import { useQuery } from '@tanstack/react-query';
import { CareersPublicShell } from '@/components/careers-portal/careers-public-shell';
import { CareersLandingPage } from '@/components/careers-portal/careers-landing-page';
import { fetchCareersJobs } from '@/services/careers-portal';

export default function CareersPortalLandingPage() {
  const jobsQ = useQuery({ queryKey: ['careers-jobs'], queryFn: fetchCareersJobs });
  const jobs = jobsQ.data ?? [];

  return (
    <CareersPublicShell hideHeroPadding>
      <CareersLandingPage jobs={jobs} />
    </CareersPublicShell>
  );
}
