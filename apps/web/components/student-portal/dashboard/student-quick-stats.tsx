'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Award, BookOpen, ClipboardList, GraduationCap, Library, Wallet } from 'lucide-react';

import { DirectoryKpiSkeleton } from '@/components/students-module/directory/ui/directory-skeleton';
import type { StudentDashboardView, StudentQuickStat } from '@/types/student-portal';
import { cn } from '@/utils/cn';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  attendance: ClipboardList,
  semester: GraduationCap,
  fees: Wallet,
  library: Library,
  certificates: Award,
  cgpa: BookOpen,
};

const GRADIENTS: Record<string, string> = {
  attendance: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
  semester: 'from-violet-500/10 via-violet-500/5 to-transparent',
  fees: 'from-amber-500/10 via-amber-500/5 to-transparent',
  library: 'from-sky-500/10 via-sky-500/5 to-transparent',
  certificates: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
  cgpa: 'from-rose-500/10 via-rose-500/5 to-transparent',
};

const TONE_VALUE: Record<string, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-rose-600 dark:text-rose-400',
};

function StatCard({ stat, delay }: { stat: StudentQuickStat; delay: number }) {
  const Icon = ICONS[stat.key] ?? GraduationCap;
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2 }}
      className={cn(
        'glass-card min-w-[140px] flex-1 overflow-hidden rounded-[20px] border border-border/40 p-4',
        'bg-gradient-to-br shadow-sm transition hover:shadow-md',
        GRADIENTS[stat.key] ?? 'from-primary/10 to-transparent',
        stat.href && 'cursor-pointer',
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/40 text-primary backdrop-blur-sm">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {stat.title}
        </p>
      </div>
      <p className={cn('mt-3 text-xl font-bold', TONE_VALUE[stat.tone ?? 'neutral'] ?? '')}>
        {stat.value}
      </p>
      {stat.subvalue ? <p className="text-xs text-muted-foreground">{stat.subvalue}</p> : null}
    </motion.div>
  );

  if (stat.href) {
    return (
      <Link href={stat.href} className="flex flex-1">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function StudentQuickStats({
  data,
  loading,
}: {
  data?: StudentDashboardView;
  loading?: boolean;
}) {
  if (loading || !data) return <DirectoryKpiSkeleton />;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      {data.quickStats.map((stat, i) => (
        <StatCard key={stat.key} stat={stat} delay={i * 0.04} />
      ))}
    </div>
  );
}
