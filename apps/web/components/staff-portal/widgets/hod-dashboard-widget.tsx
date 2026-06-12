'use client';

import Link from 'next/link';
import { BarChart3, Building2, ClipboardList, Megaphone, Users } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import type { StaffDashboardData } from '@/types/staff-portal';

export function HodDashboardWidget({
  data,
  loading,
}: {
  data?: StaffDashboardData;
  loading?: boolean;
}) {
  if (!data?.profile.isHod) return null;

  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5 lg:col-span-3">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted" />
          ))}
        </div>
      </GlassCard>
    );
  }

  const deptStrength = data.subjects.reduce((sum, s) => sum + s.studentCount, 0);
  const facultyLoad = data.kpis.teachingLoad.weeklyClasses;

  const tiles = [
    {
      icon: Users,
      label: 'Department Strength',
      value: deptStrength,
      href: '/staff/department',
    },
    {
      icon: ClipboardList,
      label: 'Faculty Workload',
      value: `${facultyLoad}h`,
      href: '/staff/academic/subjects',
    },
    {
      icon: BarChart3,
      label: 'Attendance %',
      value: `${data.kpis.attendance.percentage}%`,
      href: '/staff/attendance',
    },
    {
      icon: Megaphone,
      label: 'Department Notices',
      value: data.kpis.tasks.approvalRequests,
      href: '/staff/department',
    },
  ];

  return (
    <GlassCard className="p-5 lg:col-span-3">
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-semibold tracking-tight">HOD Dashboard</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {data.profile.department ?? 'Department'} insights
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Link
              key={tile.label}
              href={tile.href}
              className="rounded-xl border border-border/50 bg-background/40 p-4 transition hover:border-primary/30 hover:shadow-sm"
            >
              <Icon className="h-4 w-4 text-primary" />
              <p className="mt-2 text-xs text-muted-foreground">{tile.label}</p>
              <p className="text-xl font-bold">
                {typeof tile.value === 'number' ? (
                  <AnimatedCounter value={tile.value} />
                ) : (
                  tile.value
                )}
              </p>
            </Link>
          );
        })}
      </div>
    </GlassCard>
  );
}
