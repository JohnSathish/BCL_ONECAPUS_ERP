'use client';

import { motion } from 'framer-motion';
import {
  BookOpen,
  CalendarDays,
  CalendarRange,
  PartyPopper,
  Sparkles,
  Sun,
  Users,
  Umbrella,
} from 'lucide-react';

import { cn } from '@/utils/cn';

export type StatCardKey =
  | 'workingDays'
  | 'weekends'
  | 'holidays'
  | 'exams'
  | 'meetings'
  | 'eventsThisMonth'
  | 'todaysEvents'
  | 'upcomingEvents';

const STATS: Array<{
  key: StatCardKey;
  label: string;
  icon: typeof Sun;
  tone: string;
  iconBg: string;
}> = [
  {
    key: 'workingDays',
    label: 'Working Days',
    icon: Sun,
    tone: 'text-emerald-700',
    iconBg: 'bg-emerald-100 text-emerald-600',
  },
  {
    key: 'weekends',
    label: 'Weekends',
    icon: Umbrella,
    tone: 'text-rose-700',
    iconBg: 'bg-rose-100 text-rose-600',
  },
  {
    key: 'holidays',
    label: 'Holidays',
    icon: PartyPopper,
    tone: 'text-rose-700',
    iconBg: 'bg-rose-100 text-rose-600',
  },
  {
    key: 'exams',
    label: 'Exams',
    icon: BookOpen,
    tone: 'text-orange-700',
    iconBg: 'bg-orange-100 text-orange-600',
  },
  {
    key: 'meetings',
    label: 'Meetings',
    icon: Users,
    tone: 'text-violet-700',
    iconBg: 'bg-violet-100 text-violet-600',
  },
  {
    key: 'eventsThisMonth',
    label: 'Events This Month',
    icon: CalendarDays,
    tone: 'text-sky-700',
    iconBg: 'bg-sky-100 text-sky-600',
  },
  {
    key: 'todaysEvents',
    label: "Today's Events",
    icon: Sparkles,
    tone: 'text-teal-700',
    iconBg: 'bg-teal-100 text-teal-600',
  },
  {
    key: 'upcomingEvents',
    label: 'Upcoming',
    icon: CalendarRange,
    tone: 'text-amber-700',
    iconBg: 'bg-amber-100 text-amber-600',
  },
];

type Props = {
  values: Partial<Record<StatCardKey, number | string>>;
  onSelect?: (key: StatCardKey) => void;
};

export function CalendarStatsRow({ values, onSelect }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
      {STATS.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.button
            key={stat.key}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03, duration: 0.25 }}
            whileHover={{ y: -2 }}
            className={cn(
              'rounded-2xl border border-[#E5E7EB] bg-white p-3.5 text-left shadow-sm',
              'transition hover:border-sky-200 hover:shadow-md',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40',
            )}
            onClick={() => onSelect?.(stat.key)}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {stat.label}
              </p>
              <span
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-xl',
                  stat.iconBg,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className={cn('mt-2 text-3xl font-bold tracking-tight', stat.tone)}>
              {values[stat.key] ?? '—'}
            </p>
          </motion.button>
        );
      })}
    </div>
  );
}
