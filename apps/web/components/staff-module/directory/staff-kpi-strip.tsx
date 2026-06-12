'use client';

import { motion } from 'framer-motion';
import { Building2, Clock, GraduationCap, Radio, UserCheck, Users, UserX } from 'lucide-react';

import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import { DirectoryKpiSkeleton } from '@/components/students-module/directory/ui/directory-skeleton';
import { STAFF_TYPE_COLORS } from '@/components/staff-module/add-staff/constants';
import type { StaffDirectoryFilters } from '@/components/staff-module/directory/staff-filter-utils';
import type { EnhancedStaffSummary } from '@/types/staff';
import { cn } from '@/utils/cn';

type Props = {
  summary?: EnhancedStaffSummary;
  loading?: boolean;
  filters: StaffDirectoryFilters;
  onFilterChange: (patch: Partial<StaffDirectoryFilters>) => void;
};

type KpiItem = {
  id: string;
  label: string;
  value: number;
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
      </Comp>
    </motion.div>
  );
}

export function StaffKpiStrip({ summary, loading, filters, onFilterChange }: Props) {
  if (loading) return <DirectoryKpiSkeleton />;

  const items: KpiItem[] = [
    {
      id: 'total',
      label: 'Total Staff',
      value: summary?.total ?? 0,
      icon: Users,
      gradient: STAFF_TYPE_COLORS.ALL ?? 'from-primary/10 via-primary/5 to-transparent',
    },
    {
      id: 'teaching',
      label: 'Teaching',
      value: summary?.teaching ?? 0,
      icon: GraduationCap,
      gradient: STAFF_TYPE_COLORS.TEACHING,
      active: filters.staffType === 'TEACHING',
      onClick: () =>
        onFilterChange({ staffType: filters.staffType === 'TEACHING' ? '' : 'TEACHING' }),
    },
    {
      id: 'non-teaching',
      label: 'Non-Teaching',
      value: summary?.nonTeaching ?? 0,
      icon: Building2,
      gradient: STAFF_TYPE_COLORS.NON_TEACHING,
      active: filters.staffType === 'NON_TEACHING',
      onClick: () =>
        onFilterChange({
          staffType: filters.staffType === 'NON_TEACHING' ? '' : 'NON_TEACHING',
        }),
    },
    {
      id: 'guest',
      label: 'Guest / Visiting',
      value: summary?.guest ?? 0,
      icon: UserCheck,
      gradient: STAFF_TYPE_COLORS.GUEST,
      active: filters.staffType === 'GUEST',
      onClick: () => onFilterChange({ staffType: filters.staffType === 'GUEST' ? '' : 'GUEST' }),
    },
    {
      id: 'departments',
      label: 'Departments',
      value: summary?.departments ?? 0,
      icon: Building2,
      gradient: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
    },
    {
      id: 'portal-active',
      label: 'Portal Active',
      value: summary?.activeAccounts ?? 0,
      icon: UserCheck,
      gradient: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
    },
    {
      id: 'portal-pending',
      label: 'Portal Pending',
      value: summary?.pendingActivation ?? 0,
      icon: Clock,
      gradient: 'from-amber-500/10 via-amber-500/5 to-transparent',
      active: filters.uiPortalPending === 'true',
      onClick: () =>
        onFilterChange({
          uiPortalPending: filters.uiPortalPending === 'true' ? '' : 'true',
        }),
    },
    {
      id: 'on-leave',
      label: 'On Leave',
      value: summary?.onLeave ?? 0,
      icon: UserX,
      gradient: 'from-orange-500/10 via-orange-500/5 to-transparent',
      active: filters.uiOnLeave === 'true' || filters.status === 'ON_LEAVE',
      onClick: () =>
        onFilterChange({
          uiOnLeave: filters.uiOnLeave === 'true' ? '' : 'true',
          status: filters.status === 'ON_LEAVE' ? '' : 'ON_LEAVE',
        }),
    },
    {
      id: 'rfid',
      label: 'RFID Assigned',
      value: summary?.rfidAssigned ?? 0,
      icon: Radio,
      gradient: 'from-cyan-500/10 via-cyan-500/5 to-transparent',
    },
    {
      id: 'timetable',
      label: 'Timetable Assigned',
      value: summary?.timetableAssigned ?? 0,
      icon: GraduationCap,
      gradient: 'from-violet-500/10 via-violet-500/5 to-transparent',
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
