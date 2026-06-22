'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Star,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import type { RecruitmentStats } from '@/services/hr';
import { cn } from '@/utils/cn';

type Kpi = {
  label: string;
  value: number | string;
  icon: LucideIcon;
  gradient: string;
  trend?: string;
};

export function HrRecruitmentDashboardKpis({
  stats,
  isLoading,
}: {
  stats?: RecruitmentStats;
  isLoading?: boolean;
}) {
  const kpis: Kpi[] = [
    {
      label: 'Open Positions',
      value: stats?.openVacancies ?? 0,
      icon: Briefcase,
      gradient: 'from-blue-600 to-blue-500',
      trend: 'Active on portal',
    },
    {
      label: 'Applications',
      value: stats?.totalApplications ?? stats?.submitted ?? 0,
      icon: ClipboardList,
      gradient: 'from-violet-600 to-indigo-500',
      trend: 'All channels',
    },
    {
      label: 'Shortlisted',
      value: stats?.shortlisted ?? 0,
      icon: Star,
      gradient: 'from-amber-500 to-orange-500',
    },
    {
      label: 'Interviews',
      value: stats?.interviews ?? 0,
      icon: CalendarClock,
      gradient: 'from-cyan-600 to-teal-500',
    },
    {
      label: 'Selected',
      value: stats?.offers ?? 0,
      icon: UserCheck,
      gradient: 'from-emerald-600 to-green-500',
    },
    {
      label: 'Appointed',
      value: stats?.hired ?? 0,
      icon: CheckCircle2,
      gradient: 'from-slate-700 to-slate-600',
    },
    {
      label: 'Joining Pending',
      value: stats?.joiningPending ?? 0,
      icon: Users,
      gradient: 'from-rose-600 to-red-500',
    },
    {
      label: 'Offer Acceptance',
      value: `${stats?.offerAcceptanceRate ?? 0}%`,
      icon: TrendingUp,
      gradient: 'from-[#1e3a5f] to-[#2d5a8a]',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.label}
            className={cn(
              'group relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg',
              kpi.gradient,
            )}
          >
            <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
            <Icon className="h-5 w-5 opacity-90" />
            <p className="mt-3 text-2xl font-bold tabular-nums">{kpi.value}</p>
            <p className="mt-1 text-[11px] font-medium leading-tight text-white/85">{kpi.label}</p>
            {kpi.trend ? <p className="mt-1 text-[10px] text-white/60">{kpi.trend}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
