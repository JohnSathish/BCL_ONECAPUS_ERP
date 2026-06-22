'use client';

import { CareersAnimatedStat } from '@/components/careers-portal/careers-animated-stat';
import type { CareersPortalInfo } from '@/services/careers-portal';
import { Award, Building2, GraduationCap, Users } from 'lucide-react';

export function CareersInstitutionalStatsBar({
  info,
  isLoading,
}: {
  info?: CareersPortalInfo;
  isLoading?: boolean;
}) {
  const inst = info?.institutional;

  return (
    <section className="mt-12">
      <div className="careers-stats-panel rounded-2xl border border-white/15 bg-[#0c1829]/70 p-4 backdrop-blur-xl sm:p-5">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-sky-300/70">
          Institution at a Glance
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <CareersAnimatedStat
            label="Faculty Members"
            value={inst?.facultyMembers ?? 150}
            suffix="+"
            icon={Users}
            accent="sky"
            isLoading={isLoading}
          />
          <CareersAnimatedStat
            label="Students Enrolled"
            value={inst?.students ?? 3000}
            suffix="+"
            icon={GraduationCap}
            accent="emerald"
            isLoading={isLoading}
          />
          <CareersAnimatedStat
            label="Academic Departments"
            value={inst?.departments ?? 17}
            icon={Building2}
            accent="violet"
            isLoading={isLoading}
          />
          <CareersAnimatedStat
            label="Accreditation"
            displayText={inst?.naacGrade ?? 'NAAC B Grade'}
            icon={Award}
            accent="amber"
            isLoading={isLoading}
          />
          <CareersAnimatedStat
            label="Years of Academic Excellence"
            value={inst?.yearsOfExcellence ?? 39}
            suffix="+"
            icon={Award}
            accent="red"
            isLoading={isLoading}
          />
        </div>
      </div>
    </section>
  );
}
