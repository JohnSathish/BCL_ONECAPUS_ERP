'use client';

import { CareersHeroSection } from '@/components/careers-portal/careers-hero-section';
import { CareersOpeningsPreview } from '@/components/careers-portal/careers-openings-preview';
import { CareersRecruitmentTimeline } from '@/components/careers-portal/careers-recruitment-timeline';
import { CareersFaq, CareersWhyJoin } from '@/components/careers-portal/careers-faq-section';
import { CareersDepartmentHiring } from '@/components/careers-portal/careers-department-hiring';
import { CareersPrincipalMessage } from '@/components/careers-portal/careers-principal-message';
import { fetchCareersPortalInfo, type CareersJob } from '@/services/careers-portal';
import { useQuery } from '@tanstack/react-query';

export function CareersLandingPage({ jobs }: { jobs: CareersJob[] }) {
  const infoQ = useQuery({ queryKey: ['careers-portal-info'], queryFn: fetchCareersPortalInfo });
  const info = infoQ.data;

  return (
    <>
      <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
        <CareersHeroSection info={info} heroImages={info?.heroImages} />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <CareersOpeningsPreview jobs={jobs} />
        <CareersWhyJoin collegeName={info?.shortName} />
        <CareersDepartmentHiring jobs={jobs} />
        <CareersRecruitmentTimeline />
        <CareersPrincipalMessage info={info} />
        <CareersFaq />
      </div>
    </>
  );
}
