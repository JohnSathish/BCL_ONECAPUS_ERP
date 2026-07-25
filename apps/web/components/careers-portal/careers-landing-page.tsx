'use client';

import { CareersHeroSection } from '@/components/careers-portal/careers-hero-section';
import { CareersOpeningsPreview } from '@/components/careers-portal/careers-openings-preview';
import { CareersRecruitmentTimeline } from '@/components/careers-portal/careers-recruitment-timeline';
import { CareersFaq, CareersWhyJoin } from '@/components/careers-portal/careers-faq-section';
import { CareersDepartmentHiring } from '@/components/careers-portal/careers-department-hiring';
import { CareersPrincipalMessage } from '@/components/careers-portal/careers-principal-message';
import { CareersInstitutionalStatsBar } from '@/components/careers-portal/careers-institutional-stats';
import { fetchCareersPortalInfo, type CareersJob } from '@/services/careers-portal';
import { useQuery } from '@tanstack/react-query';

export function CareersLandingPage({ jobs }: { jobs: CareersJob[] }) {
  const infoQ = useQuery({ queryKey: ['careers-portal-info'], queryFn: fetchCareersPortalInfo });
  const info = infoQ.data;

  return (
    <>
      <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
        <CareersHeroSection info={info} heroImages={info?.heroImages} jobs={jobs} />
      </div>

      <div className="relative z-10 -mt-2 space-y-0 pb-4">
        <CareersInstitutionalStatsBar info={info} isLoading={infoQ.isLoading} />
      </div>

      <CareersWhyJoin collegeName={info?.collegeName ?? info?.shortName} />

      <div id="about" className="bg-white">
        <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
          <CareersPrincipalMessage info={info} />
        </div>
      </div>

      <CareersOpeningsPreview jobs={jobs} />

      <div className="bg-white">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <CareersDepartmentHiring jobs={jobs} />
          <CareersRecruitmentTimeline />
        </div>
      </div>

      <CareersFaq />
    </>
  );
}
