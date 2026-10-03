'use client';

import {
  AlertTriangle,
  BookOpen,
  CircleCheck,
  Hourglass,
  IndianRupee,
  Users,
  type LucideIcon,
} from 'lucide-react';

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
  tone: 'sky' | 'emerald' | 'amber' | 'rose';
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass = {
    sky: 'border-sky-200/80 bg-sky-50/50 dark:border-sky-900 dark:bg-sky-950/20',
    emerald:
      'border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20',
    amber: 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20',
    rose: 'border-rose-200/80 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20',
  }[tone];
  const Comp = onClick ? 'button' : 'article';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3 text-left shadow-sm',
        toneClass,
        onClick && 'transition hover:brightness-[0.98]',
        active && 'ring-2 ring-sky-500/40',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-sky-700 dark:text-sky-300" />
      </div>
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </Comp>
  );
}

export function DirectoryKpiStrip({ summary, loading, filters, onFilterChange }: Props) {
  if (loading) return <DirectoryKpiSkeleton />;

  const total = summary?.total ?? 0;
  const active = summary?.activeUsers ?? 0;
  const pending = summary?.pendingEnrollment ?? 0;
  const feeDue = summary?.feeDefaulters ?? 0;
  const subjects = summary?.subjectRegistrationPending ?? 0;
  const attendance = summary?.attendanceShortage ?? 0;
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0;
  const pendingPct = total > 0 ? ((pending / total) * 100).toFixed(1) : '0';

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      <KpiCard
        icon={Users}
        label="Total Students"
        value={total.toLocaleString('en-IN')}
        hint="All student records"
        tone="sky"
      />
      <KpiCard
        icon={CircleCheck}
        label="Active Students"
        value={active.toLocaleString('en-IN')}
        hint={`${activePct}% of total`}
        tone="emerald"
      />
      <KpiCard
        icon={Hourglass}
        label="Pending Enrollment"
        value={pending.toLocaleString('en-IN')}
        hint={`${pendingPct}% of total`}
        tone="amber"
        active={filters.studentStatus === 'PENDING'}
        onClick={() =>
          onFilterChange({ studentStatus: filters.studentStatus === 'PENDING' ? '' : 'PENDING' })
        }
      />
      <KpiCard
        icon={IndianRupee}
        label="Students with Fee Due"
        value={feeDue.toLocaleString('en-IN')}
        hint="Students with an outstanding balance"
        tone="rose"
        active={filters.uiFeeDue === 'true'}
        onClick={() => onFilterChange({ uiFeeDue: filters.uiFeeDue === 'true' ? '' : 'true' })}
      />
      <KpiCard
        icon={BookOpen}
        label="Subject Pending"
        value={subjects.toLocaleString('en-IN')}
        hint={total > 0 ? `${Math.round((subjects / total) * 100)}% of total` : '0% of total'}
        tone="sky"
        active={filters.uiSubjectPending === 'true'}
        onClick={() =>
          onFilterChange({
            uiSubjectPending: filters.uiSubjectPending === 'true' ? '' : 'true',
          })
        }
      />
      <KpiCard
        icon={AlertTriangle}
        label="Attendance Risk"
        value={attendance.toLocaleString('en-IN')}
        hint={total > 0 ? `${Math.round((attendance / total) * 100)}% of total` : '0% of total'}
        tone="amber"
        active={filters.uiAttendanceShortage === 'true'}
        onClick={() =>
          onFilterChange({
            uiAttendanceShortage: filters.uiAttendanceShortage === 'true' ? '' : 'true',
          })
        }
      />
    </div>
  );
}
