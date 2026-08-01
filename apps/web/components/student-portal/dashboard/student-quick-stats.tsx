'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookOpen, Coins, GraduationCap, Medal } from 'lucide-react';
import { DirectoryKpiSkeleton } from '@/components/students-module/directory/ui/directory-skeleton';
import type { StudentDashboardView, StudentQuickStat } from '@/types/student-portal';
import { cn } from '@/utils/cn';

type Theme = {
  card: string;
  label: string;
  value: string;
  accent: string;
  ringTrack: string;
  ring: string;
};

const THEMES: Record<string, Theme> = {
  attendance: {
    card: 'border-violet-200/70 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50/40 dark:border-violet-900/40 dark:from-violet-950/40 dark:via-slate-900 dark:to-slate-900',
    label: 'text-violet-700/80 dark:text-violet-300',
    value: 'text-violet-900 dark:text-violet-100',
    accent: 'text-violet-600',
    ringTrack: '#ede9fe',
    ring: '#7c3aed',
  },
  fees: {
    card: 'border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50/50 dark:border-amber-900/40 dark:from-amber-950/30 dark:via-slate-900 dark:to-slate-900',
    label: 'text-amber-800/80 dark:text-amber-300',
    value: 'text-amber-900 dark:text-amber-100',
    accent: 'text-amber-700',
    ringTrack: '#fef3c7',
    ring: '#d97706',
  },
  cgpa: {
    card: 'border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-blue-50/40 dark:border-sky-900/40 dark:from-sky-950/30 dark:via-slate-900 dark:to-slate-900',
    label: 'text-sky-700/80 dark:text-sky-300',
    value: 'text-sky-900 dark:text-sky-100',
    accent: 'text-sky-600',
    ringTrack: '#e0f2fe',
    ring: '#0284c7',
  },
  credits: {
    card: 'border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-teal-50/40 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900',
    label: 'text-emerald-700/80 dark:text-emerald-300',
    value: 'text-emerald-900 dark:text-emerald-100',
    accent: 'text-emerald-600',
    ringTrack: '#d1fae5',
    ring: '#059669',
  },
  library: {
    card: 'border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-pink-50/50 dark:border-rose-900/40 dark:from-rose-950/30 dark:via-slate-900 dark:to-slate-900',
    label: 'text-rose-700/80 dark:text-rose-300',
    value: 'text-rose-900 dark:text-rose-100',
    accent: 'text-rose-600',
    ringTrack: '#ffe4e6',
    ring: '#e11d48',
  },
};

function MiniBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mt-3 flex h-9 items-end gap-1">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-2 rounded-md opacity-90"
          style={{
            height: `${Math.max(18, (v / max) * 100)}%`,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
}

function AttendanceRing({ pct, track, stroke }: { pct: number; track: string; stroke: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.max(0, Math.min(100, pct)) / 100) * circ;
  return (
    <div className="relative mx-auto mt-2 h-[72px] w-[72px]">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke={track} strokeWidth="7" />
        <circle
          cx="36"
          cy="36"
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold tabular-nums text-violet-900 dark:text-violet-100">
          {Math.round(pct)}%
        </span>
      </div>
    </div>
  );
}

function StatCard({
  stat,
  delay,
  theme,
  children,
  cta,
}: {
  stat: StudentQuickStat;
  delay: number;
  theme: Theme;
  children?: React.ReactNode;
  cta?: string;
}) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.25 }}
      whileHover={{ y: -3 }}
      className={cn(
        'flex h-full flex-col rounded-3xl border p-4 shadow-sm transition hover:shadow-md',
        theme.card,
        stat.href && 'cursor-pointer',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-[11px] font-bold uppercase tracking-wide', theme.label)}>
          {stat.title}
        </p>
      </div>
      {children}
      {stat.key !== 'attendance' ? (
        <p className={cn('mt-1 text-2xl font-bold tracking-tight tabular-nums', theme.value)}>
          {stat.value}
        </p>
      ) : null}
      {stat.subvalue ? (
        <p
          className={cn(
            'mt-0.5 text-xs text-slate-500 dark:text-slate-400',
            stat.key === 'attendance' &&
              'text-center font-medium text-violet-700/80 dark:text-violet-300',
          )}
        >
          {stat.subvalue}
        </p>
      ) : null}
      {cta ? (
        <span className={cn('mt-auto pt-3 text-xs font-semibold', theme.accent)}>{cta}</span>
      ) : null}
    </motion.div>
  );

  if (stat.href) {
    return (
      <Link href={stat.href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

function buildStats(data: StudentDashboardView): StudentQuickStat[] {
  const byKey = Object.fromEntries(data.quickStats.map((s) => [s.key, s]));

  const attendance = byKey.attendance ?? {
    key: 'attendance',
    title: 'Attendance',
    value: '—',
    href: '/student/attendance',
  };
  const fees = byKey.fees ?? {
    key: 'fees',
    title: 'Fee Status',
    value: data.fees?.status === 'PENDING' ? `Pending ₹${data.fees.due}` : 'PAID',
    tone: data.fees?.status === 'PENDING' ? ('warn' as const) : ('good' as const),
    href: '/student/fees',
  };
  const cgpa =
    byKey.cgpa ??
    ({
      key: 'cgpa',
      title: 'CGPA',
      value: data.examinations?.cgpa != null ? Number(data.examinations.cgpa).toFixed(2) : '—',
      href: '/student/results',
    } satisfies StudentQuickStat);

  const credits =
    byKey.credits ??
    ({
      key: 'credits',
      title: 'Credits Earned',
      value: data.credits != null ? `${data.credits.earned} / ${data.credits.target}` : '—',
      subvalue: data.credits != null ? 'Towards semester target' : undefined,
      href: '/student/registration',
    } satisfies StudentQuickStat);

  const library =
    byKey.library ??
    ({
      key: 'library',
      title: 'Library Books',
      value: String(data.library?.issuedBooks ?? 0),
      subvalue: 'No books issued',
      href: '/student/library',
    } satisfies StudentQuickStat);

  return [attendance, fees, cgpa, credits, library];
}

export function StudentQuickStats({
  data,
  loading,
  attendancePercent,
  libraryIssued,
  libraryDueInDays,
}: {
  data?: StudentDashboardView;
  loading?: boolean;
  attendancePercent?: number | null;
  libraryIssued?: number | null;
  libraryDueInDays?: number | null;
}) {
  if (loading || !data) return <DirectoryKpiSkeleton />;

  const stats = buildStats(data).map((s) => {
    if (s.key === 'attendance' && attendancePercent != null) {
      return {
        ...s,
        value: `${Math.round(attendancePercent)}%`,
        subvalue: 'Overall Attendance',
        tone:
          attendancePercent >= 75
            ? ('good' as const)
            : attendancePercent >= 60
              ? ('warn' as const)
              : ('bad' as const),
      };
    }
    if (s.key === 'credits' && data.credits) {
      return {
        ...s,
        value: `${data.credits.earned} / ${data.credits.target}`,
        subvalue: 'Credits this programme',
      };
    }
    if (s.key === 'library') {
      const issued = libraryIssued ?? data.library?.issuedBooks ?? 0;
      return {
        ...s,
        value: String(issued),
        subvalue:
          issued === 0
            ? 'No books issued'
            : libraryDueInDays != null
              ? libraryDueInDays >= 0
                ? `Due in ${libraryDueInDays} day${libraryDueInDays === 1 ? '' : 's'}`
                : `Overdue by ${Math.abs(libraryDueInDays)} day${Math.abs(libraryDueInDays) === 1 ? '' : 's'}`
              : 'Books issued',
      };
    }
    if (s.key === 'cgpa' && data.examinations?.cgpa != null && s.value === '—') {
      return { ...s, value: Number(data.examinations.cgpa).toFixed(2), subvalue: 'Cumulative GPA' };
    }
    if (s.key === 'fees' && data.fees?.status === 'PENDING') {
      return {
        ...s,
        value: `Pending ₹${Number(data.fees.due).toLocaleString('en-IN')}`,
        subvalue: data.fees.semesterLabel || 'Action needed',
      };
    }
    return s;
  });

  const attendancePct =
    attendancePercent != null
      ? attendancePercent
      : Number.parseInt(stats.find((s) => s.key === 'attendance')?.value ?? '0', 10) || 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {stats.map((stat, i) => {
        const theme = THEMES[stat.key] ?? THEMES.cgpa;
        let body: React.ReactNode = null;
        let cta: string | undefined;

        if (stat.key === 'attendance') {
          body = <AttendanceRing pct={attendancePct} track={theme.ringTrack} stroke={theme.ring} />;
          cta = 'View Details →';
        } else if (stat.key === 'fees') {
          body = (
            <div className="mt-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <Coins className="h-5 w-5" />
            </div>
          );
          cta = stat.tone === 'warn' || /pending/i.test(stat.value) ? 'Pay Now →' : 'View Fees →';
        } else if (stat.key === 'cgpa') {
          body = (
            <div className="mt-1 flex items-end justify-between gap-2">
              <MiniBars values={[6, 7, 6.5, 8, 7.5, 8.2, 8.4]} color={theme.ring} />
              <GraduationCap className="mb-1 h-5 w-5 text-sky-500/70" />
            </div>
          );
        } else if (stat.key === 'credits') {
          body = (
            <div className="mt-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Medal className="h-5 w-5" />
            </div>
          );
          cta = 'View Progress →';
        } else if (stat.key === 'library') {
          body = (
            <div className="mt-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              <BookOpen className="h-5 w-5" />
            </div>
          );
          cta = 'Go to Library →';
        }

        return (
          <StatCard key={stat.key} stat={stat} delay={i * 0.04} theme={theme} cta={cta}>
            {body}
          </StatCard>
        );
      })}
    </div>
  );
}
