'use client';

import {
  Building2,
  CalendarOff,
  GraduationCap,
  Radio,
  UserCheck,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

import { DirectoryKpiSkeleton } from '@/components/students-module/directory/ui/directory-skeleton';
import type { StaffDirectoryFilters } from '@/components/staff-module/directory/staff-filter-utils';
import type { EnhancedStaffSummary } from '@/types/staff';
import { cn } from '@/utils/cn';

type Props = {
  summary?: EnhancedStaffSummary;
  loading?: boolean;
  filters: StaffDirectoryFilters;
  onFilterChange: (patch: Partial<StaffDirectoryFilters>) => void;
};

function percent(part: number, total: number) {
  if (!total) return '0% of total';
  return `${((part / total) * 100).toFixed(1)}% of total`;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone: 'sky' | 'emerald' | 'amber' | 'violet';
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass = {
    sky: 'border-sky-200/80 bg-sky-50/50',
    emerald: 'border-emerald-200/80 bg-emerald-50/60',
    amber: 'border-amber-200/80 bg-amber-50/70',
    violet: 'border-violet-200/80 bg-violet-50/50',
  }[tone];
  const Comp = onClick ? 'button' : 'article';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'min-w-[132px] rounded-xl border p-3 text-left shadow-sm',
        toneClass,
        onClick && 'transition hover:brightness-[0.98]',
        active && 'ring-2 ring-sky-500/40',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <Icon className="h-4 w-4 text-sky-700" />
      </div>
      <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium">{label}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
    </Comp>
  );
}

export function StaffKpiStrip({ summary, loading, filters, onFilterChange }: Props) {
  if (loading) return <DirectoryKpiSkeleton />;

  const total = summary?.total ?? 0;
  const teaching = summary?.teaching ?? 0;
  const nonTeaching = summary?.nonTeaching ?? 0;
  const guest = summary?.guest ?? 0;
  const departments = summary?.departments ?? 0;
  const portalActive = summary?.activeAccounts ?? 0;
  const portalPending = summary?.pendingActivation ?? 0;
  const onLeave = summary?.onLeave ?? 0;
  const rfid = summary?.rfidAssigned ?? 0;
  const timetable = summary?.timetableAssigned ?? 0;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10">
      <KpiCard
        icon={Users}
        label="Total Staff"
        value={total.toLocaleString('en-IN')}
        hint="100% of total"
        tone="sky"
      />
      <KpiCard
        icon={GraduationCap}
        label="Teaching Staff"
        value={teaching.toLocaleString('en-IN')}
        hint={percent(teaching, total)}
        tone="sky"
        active={filters.staffType === 'TEACHING'}
        onClick={() =>
          onFilterChange({ staffType: filters.staffType === 'TEACHING' ? '' : 'TEACHING' })
        }
      />
      <KpiCard
        icon={Building2}
        label="Non-Teaching"
        value={nonTeaching.toLocaleString('en-IN')}
        hint={percent(nonTeaching, total)}
        tone="amber"
        active={filters.staffType === 'NON_TEACHING'}
        onClick={() =>
          onFilterChange({
            staffType: filters.staffType === 'NON_TEACHING' ? '' : 'NON_TEACHING',
          })
        }
      />
      <KpiCard
        icon={UserRound}
        label="Guest / Visiting"
        value={guest.toLocaleString('en-IN')}
        hint={percent(guest, total)}
        tone="violet"
        active={filters.staffType === 'GUEST'}
        onClick={() => onFilterChange({ staffType: filters.staffType === 'GUEST' ? '' : 'GUEST' })}
      />
      <KpiCard
        icon={Building2}
        label="Departments"
        value={departments.toLocaleString('en-IN')}
        hint="Active departments"
        tone="sky"
      />
      <KpiCard
        icon={UserCheck}
        label="Portal Active"
        value={portalActive.toLocaleString('en-IN')}
        hint={percent(portalActive, total)}
        tone="emerald"
      />
      <KpiCard
        icon={UserCheck}
        label="Portal Pending"
        value={portalPending.toLocaleString('en-IN')}
        hint={percent(portalPending, total)}
        tone="amber"
        active={filters.uiPortalPending === 'true'}
        onClick={() =>
          onFilterChange({ uiPortalPending: filters.uiPortalPending === 'true' ? '' : 'true' })
        }
      />
      <KpiCard
        icon={CalendarOff}
        label="On Leave"
        value={onLeave.toLocaleString('en-IN')}
        hint={percent(onLeave, total)}
        tone="amber"
        active={filters.status === 'ON_LEAVE'}
        onClick={() =>
          onFilterChange({
            status: filters.status === 'ON_LEAVE' ? '' : 'ON_LEAVE',
            uiOnLeave: filters.status === 'ON_LEAVE' ? '' : 'true',
          })
        }
      />
      <KpiCard
        icon={Radio}
        label="RFID Assigned"
        value={rfid.toLocaleString('en-IN')}
        hint={percent(rfid, total)}
        tone="sky"
      />
      <KpiCard
        icon={GraduationCap}
        label="Timetable Assigned"
        value={timetable.toLocaleString('en-IN')}
        hint={teaching > 0 ? `${((timetable / teaching) * 100).toFixed(1)}% of teaching` : '0%'}
        tone="emerald"
      />
    </div>
  );
}
