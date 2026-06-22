'use client';

import { Briefcase, Building2, CalendarCheck, ClipboardList } from 'lucide-react';
import { CareersAnimatedStat } from '@/components/careers-portal/careers-animated-stat';
import type { CareersPortalInfo } from '@/services/careers-portal';

export function CareersRecruitmentLiveStats({
  info,
  isLoading,
}: {
  info?: CareersPortalInfo;
  isLoading?: boolean;
}) {
  const stats = info?.stats;

  return (
    <section className="w-full border-y border-white/10 bg-[#0c1829]/95 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-px bg-white/10 sm:grid-cols-4">
        <div className="bg-[#0c1829] p-5 sm:p-6">
          <CareersAnimatedStat
            label="Open Positions"
            value={stats?.openPositions ?? info?.openVacancies ?? 0}
            icon={Briefcase}
            accent="sky"
            isLoading={isLoading}
          />
        </div>
        <div className="bg-[#0c1829] p-5 sm:p-6">
          <CareersAnimatedStat
            label="Applications Received"
            value={stats?.applicationsReceived ?? 0}
            icon={ClipboardList}
            accent="violet"
            isLoading={isLoading}
          />
        </div>
        <div className="bg-[#0c1829] p-5 sm:p-6">
          <CareersAnimatedStat
            label="Interviews Scheduled"
            value={stats?.interviewsScheduled ?? 0}
            icon={CalendarCheck}
            accent="amber"
            isLoading={isLoading}
          />
        </div>
        <div className="bg-[#0c1829] p-5 sm:p-6">
          <CareersAnimatedStat
            label="Departments Hiring"
            value={stats?.departmentsHiring ?? 0}
            icon={Building2}
            accent="emerald"
            isLoading={isLoading}
          />
        </div>
      </div>
    </section>
  );
}
