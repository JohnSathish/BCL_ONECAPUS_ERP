'use client';

import { BookOpen, GraduationCap, Shield, Trophy, Users } from 'lucide-react';
import type { CareersPortalInfo } from '@/services/careers-portal';

export function CareersInstitutionalStatsBar({
  info,
  isLoading,
}: {
  info?: CareersPortalInfo;
  isLoading?: boolean;
}) {
  const inst = info?.institutional;
  const items = [
    {
      label: 'Dedicated Faculty',
      value: `${inst?.facultyMembers ?? 140}+`,
      icon: Users,
      tone: 'bg-sky-100 text-sky-700',
    },
    {
      label: 'Departments',
      value: `${inst?.departments ?? 25}+`,
      icon: BookOpen,
      tone: 'bg-emerald-100 text-emerald-700',
    },
    {
      label: 'Students Impacted',
      value: `${inst?.students ?? 1000}+`,
      icon: GraduationCap,
      tone: 'bg-violet-100 text-violet-700',
    },
    {
      label: 'Years of Excellence',
      value: `${inst?.yearsOfExcellence ?? 39}+`,
      icon: Trophy,
      tone: 'bg-orange-100 text-orange-700',
    },
    {
      label: inst?.naacGrade?.includes('B') ? 'B Grade NAAC Accredited' : 'NAAC Accredited',
      value: null as string | null,
      icon: Shield,
      tone: 'bg-amber-100 text-amber-800',
    },
  ];

  return (
    <section className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <div
        className={`grid gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-5 shadow-sm sm:grid-cols-2 sm:px-6 lg:grid-cols-5 ${
          isLoading ? 'opacity-70' : ''
        }`}
      >
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${item.tone}`}
            >
              <item.icon className="h-5 w-5" />
            </span>
            <div>
              {item.value ? (
                <p className="text-lg font-bold leading-tight text-[#0b1f4a]">{item.value}</p>
              ) : null}
              <p
                className={`text-sm text-slate-600 ${item.value ? '' : 'font-semibold text-[#0b1f4a]'}`}
              >
                {item.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
