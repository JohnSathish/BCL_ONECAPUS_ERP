'use client';

import { motion } from 'framer-motion';
import {
  AlertTriangle,
  BookOpenCheck,
  Building2,
  Clock,
  CreditCard,
  GraduationCap,
  Radio,
  Sun,
  Users,
} from 'lucide-react';

import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { DirectoryKpiSkeleton } from '@/components/students-module/directory/ui/directory-skeleton';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import type { EnhancedStudentSummary } from '@/types/students';
import { cn } from '@/utils/cn';

type Option = { id: string; label: string };

type Props = {
  summary?: EnhancedStudentSummary;
  loading?: boolean;
  filters: DirectoryFilters;
  shiftOptions?: Option[];
  streamOptions?: Option[];
  onFilterChange: (patch: Partial<DirectoryFilters>) => void;
};

type KpiItem = {
  id: string;
  label: string;
  value: number;
  trend?: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
  gradient: string;
};

function CompactKpi({ item, delay }: { item: KpiItem; delay: number }) {
  const Icon = item.icon;
  const Comp = item.onClick ? 'button' : 'div';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2 }}
      className="min-w-[108px] flex-1 shrink-0"
    >
      <Comp
        type={item.onClick ? 'button' : undefined}
        onClick={item.onClick}
        className={cn(
          'group relative w-full overflow-hidden rounded-[20px] border border-border/40 p-2 text-left transition-all',
          'bg-gradient-to-br shadow-sm',
          item.gradient,
          item.onClick &&
            'cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)] motion-reduce:hover:translate-y-0',
          item.active && 'ring-1 ring-primary/50 shadow-[var(--shadow-glow)]',
        )}
      >
        <div className="flex items-start justify-between gap-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-background/40 text-primary backdrop-blur-sm">
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <p className="mt-1.5 text-lg font-bold leading-none tracking-tight">
          <AnimatedCounter value={item.value} />
        </p>
        <p className="mt-0.5 truncate text-[10px] font-medium text-muted-foreground">
          {item.label}
        </p>
        {item.trend ? (
          <p className="mt-0.5 truncate text-[9px] font-medium text-foreground/70">{item.trend}</p>
        ) : null}
      </Comp>
    </motion.div>
  );
}

function resolveOptionId(options: Option[], name: string, currentId: string): string {
  const match = options.find((o) => o.label === name || o.id === name);
  if (!match) return '';
  return currentId === match.id ? '' : match.id;
}

export function DirectoryKpiStrip({
  summary,
  loading,
  filters,
  shiftOptions = [],
  streamOptions = [],
  onFilterChange,
}: Props) {
  if (loading) return <DirectoryKpiSkeleton />;

  const sem1Count = summary?.bySemester?.['1'] ?? 0;
  const dayShiftEntry = Object.entries(summary?.byShift ?? {}).find(([name]) => /day/i.test(name));
  const scienceStreamEntry = Object.entries(summary?.byStream ?? {}).find(([name]) =>
    /science/i.test(name),
  );

  const total = summary?.total ?? 0;
  const active = summary?.activeUsers ?? 0;
  const activePct = total > 0 ? Math.round((active / total) * 100) : 0;
  const rfidCount = summary?.rfidAssigned ?? 0;
  const rfidPct = total > 0 ? ((100 * rfidCount) / total).toFixed(1) : '0';
  const subjectPending = summary?.subjectRegistrationPending ?? 0;
  const newThisYear = summary?.newThisYear ?? 0;

  const items: KpiItem[] = [
    {
      id: 'total',
      label: 'Total Students',
      value: total,
      trend: newThisYear > 0 ? `+${newThisYear} this year` : 'Stable cohort',
      icon: Users,
      gradient: 'from-primary/10 via-primary/5 to-transparent',
    },
    {
      id: 'active',
      label: 'Active Students',
      value: active,
      trend: total > 0 ? `${activePct}% active` : 'No data',
      icon: GraduationCap,
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    },
    {
      id: 'pending',
      label: 'Pending Enrollment',
      value: summary?.pendingEnrollment ?? 0,
      trend: (summary?.pendingEnrollment ?? 0) === 0 ? 'All enrolled' : 'Needs action',
      icon: Clock,
      gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
    },
    {
      id: 'sem1',
      label: 'Sem 1',
      value: sem1Count,
      icon: BookOpenCheck,
      gradient: 'from-violet-500/10 via-violet-500/5 to-transparent',
      active: filters.semester === '1',
      onClick: () => onFilterChange({ semester: filters.semester === '1' ? '' : '1' }),
    },
    {
      id: 'day-shift',
      label: dayShiftEntry?.[0] ?? 'Day Shift',
      value: dayShiftEntry?.[1] ?? Object.values(summary?.byShift ?? {})[0] ?? 0,
      icon: Sun,
      gradient: 'from-sky-500/10 via-sky-500/5 to-transparent',
      active: dayShiftEntry
        ? filters.shiftId === shiftOptions.find((o) => o.label === dayShiftEntry[0])?.id
        : false,
      onClick: dayShiftEntry
        ? () =>
            onFilterChange({
              shiftId: resolveOptionId(shiftOptions, dayShiftEntry[0], filters.shiftId),
            })
        : undefined,
    },
    {
      id: 'science',
      label: scienceStreamEntry?.[0] ?? 'Science Stream',
      value: scienceStreamEntry?.[1] ?? Object.values(summary?.byStream ?? {})[0] ?? 0,
      icon: GraduationCap,
      gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
      active: scienceStreamEntry
        ? filters.streamId === streamOptions.find((o) => o.label === scienceStreamEntry[0])?.id
        : false,
      onClick: scienceStreamEntry
        ? () =>
            onFilterChange({
              streamId: resolveOptionId(streamOptions, scienceStreamEntry[0], filters.streamId),
            })
        : undefined,
    },
    {
      id: 'hostel',
      label: 'Hostel',
      value: summary?.hostelResidents ?? 0,
      trend: (summary?.hostelResidents ?? 0) === 0 ? 'No residents tagged' : 'Hostellers on file',
      icon: Building2,
      gradient: 'from-teal-500/10 via-teal-500/5 to-transparent',
      active: filters.uiHostel === 'true',
      onClick: () => onFilterChange({ uiHostel: filters.uiHostel === 'true' ? '' : 'true' }),
    },
    {
      id: 'fee',
      label: 'Fee Due',
      value: summary?.feeDefaulters ?? 0,
      trend:
        (summary?.feeDefaulters ?? 0) === 0
          ? 'No pending fees'
          : `${summary?.feeDefaulters} defaulters`,
      icon: CreditCard,
      gradient: 'from-rose-500/10 via-rose-500/5 to-transparent',
      active: filters.uiFeeDue === 'true',
      onClick: () => onFilterChange({ uiFeeDue: filters.uiFeeDue === 'true' ? '' : 'true' }),
    },
    {
      id: 'attendance',
      label: 'Attendance Shortage',
      value: summary?.attendanceShortage ?? 0,
      trend:
        (summary?.attendanceShortage ?? 0) === 0
          ? 'All above 75%'
          : `${summary?.attendanceShortage} at risk`,
      icon: AlertTriangle,
      gradient: 'from-orange-500/10 via-orange-500/5 to-transparent',
      active: filters.uiAttendanceShortage === 'true',
      onClick: () =>
        onFilterChange({
          uiAttendanceShortage: filters.uiAttendanceShortage === 'true' ? '' : 'true',
        }),
    },
    {
      id: 'rfid',
      label: 'RFID Assigned',
      value: rfidCount,
      trend: `${rfidPct}% coverage`,
      icon: Radio,
      gradient: 'from-cyan-500/10 via-cyan-500/5 to-transparent',
      active: filters.uiRfidAssigned === 'true',
      onClick: () =>
        onFilterChange({
          uiRfidAssigned: filters.uiRfidAssigned === 'true' ? '' : 'true',
        }),
    },
    {
      id: 'subjects',
      label: 'Subject Pending',
      value: subjectPending,
      trend: subjectPending === 0 ? 'All mapped' : `${subjectPending} to assign`,
      icon: BookOpenCheck,
      gradient: 'from-purple-500/10 via-purple-500/5 to-transparent',
      active: filters.uiSubjectPending === 'true',
      onClick: () =>
        onFilterChange({
          uiSubjectPending: filters.uiSubjectPending === 'true' ? '' : 'true',
        }),
    },
  ];

  return (
    <div className="-mx-0.5 flex gap-2 overflow-x-auto pb-0.5 pt-0.5 scrollbar-none">
      {items.map((item, i) => (
        <CompactKpi key={item.id} item={item} delay={i * 0.02} />
      ))}
    </div>
  );
}
