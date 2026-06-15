'use client';

import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { DirectoryKpiSkeleton } from '@/components/students-module/directory/ui/directory-skeleton';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import type { EnhancedStudentSummary } from '@/types/students';
import { cn } from '@/utils/cn';

type Props = {
  summary?: EnhancedStudentSummary;
  loading?: boolean;
  filters: DirectoryFilters;
  onFilterChange: (patch: Partial<DirectoryFilters>) => void;
};

type KpiItem = {
  id: string;
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
};

function KpiCell({ item }: { item: KpiItem }) {
  const Comp = item.onClick ? 'button' : 'div';

  return (
    <Comp
      type={item.onClick ? 'button' : undefined}
      onClick={item.onClick}
      className={cn(
        'flex min-w-0 flex-1 flex-col px-3 py-2 text-left',
        item.onClick && 'cursor-pointer transition-colors hover:bg-muted/40',
        item.active && 'bg-primary/5',
      )}
    >
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {item.label}
      </p>
      <p className="mt-0.5 text-xl font-bold tabular-nums leading-none tracking-tight">
        <AnimatedCounter value={item.value} />
      </p>
    </Comp>
  );
}

export function DirectoryKpiStrip({ summary, loading, filters, onFilterChange }: Props) {
  if (loading) return <DirectoryKpiSkeleton />;

  const items: KpiItem[] = [
    {
      id: 'total',
      label: 'Total Students',
      value: summary?.total ?? 0,
    },
    {
      id: 'active',
      label: 'Active',
      value: summary?.activeUsers ?? 0,
    },
    {
      id: 'pending',
      label: 'Pending Enrollment',
      value: summary?.pendingEnrollment ?? 0,
    },
    {
      id: 'fee',
      label: 'Fee Due',
      value: summary?.feeDefaulters ?? 0,
      active: filters.uiFeeDue === 'true',
      onClick: () => onFilterChange({ uiFeeDue: filters.uiFeeDue === 'true' ? '' : 'true' }),
    },
    {
      id: 'subjects',
      label: 'Subject Pending',
      value: summary?.subjectRegistrationPending ?? 0,
      active: filters.uiSubjectPending === 'true',
      onClick: () =>
        onFilterChange({
          uiSubjectPending: filters.uiSubjectPending === 'true' ? '' : 'true',
        }),
    },
    {
      id: 'attendance',
      label: 'Attendance Risk',
      value: summary?.attendanceShortage ?? 0,
      active: filters.uiAttendanceShortage === 'true',
      onClick: () =>
        onFilterChange({
          uiAttendanceShortage: filters.uiAttendanceShortage === 'true' ? '' : 'true',
        }),
    },
    {
      id: 'hostel',
      label: 'Hostellers',
      value: summary?.hostelResidents ?? 0,
      active: filters.uiHostel === 'true',
      onClick: () => onFilterChange({ uiHostel: filters.uiHostel === 'true' ? '' : 'true' }),
    },
  ];

  return (
    <div className="glass-card flex divide-x divide-border/50 overflow-x-auto rounded-xl border border-border/50">
      {items.map((item) => (
        <KpiCell key={item.id} item={item} />
      ))}
    </div>
  );
}
