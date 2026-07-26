'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Wallet } from 'lucide-react';
import { DirectoryKpiSkeleton } from '@/components/students-module/directory/ui/directory-skeleton';
import type { StudentDashboardView, StudentQuickStat } from '@/types/student-portal';
import { cn } from '@/utils/cn';

const TONE_VALUE: Record<string, string> = {
  good: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  bad: 'text-rose-600 dark:text-rose-400',
};

function MiniBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mt-3 flex h-8 items-end gap-0.5">
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1.5 rounded-sm opacity-80"
          style={{
            height: `${Math.max(12, (v / max) * 100)}%`,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  );
}

function Sparkline({ color }: { color: string }) {
  return (
    <svg className="mt-3 h-8 w-full" viewBox="0 0 100 28" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points="0,20 15,18 30,22 45,12 60,16 75,8 90,14 100,10"
      />
    </svg>
  );
}

function AttendanceRing({ pct }: { pct: number }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.max(0, Math.min(100, pct)) / 100) * circ;
  return (
    <svg className="mt-2 h-10 w-10 -rotate-90" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
      <circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        stroke="#10b981"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function CreditsBar({ percent }: { percent: number }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
      <div
        className="h-full rounded-full bg-[#1e4d8c] transition-all"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

function StatCard({
  stat,
  delay,
  visual,
}: {
  stat: StudentQuickStat;
  delay: number;
  visual?: React.ReactNode;
}) {
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.2 }}
      className={cn(
        'flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900',
        stat.href && 'cursor-pointer',
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {stat.title}
      </p>
      <p
        className={cn(
          'mt-2 text-2xl font-bold tracking-tight',
          TONE_VALUE[stat.tone ?? 'neutral'] ?? 'text-slate-900 dark:text-white',
        )}
      >
        {stat.value}
      </p>
      {stat.subvalue ? <p className="mt-0.5 text-xs text-slate-500">{stat.subvalue}</p> : null}
      {visual}
      {stat.key === 'fees' && stat.tone === 'warn' ? (
        <span className="mt-auto pt-2 text-xs font-semibold text-[#1e4d8c]">Pay Now →</span>
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
      subvalue: data.credits != null ? `${data.credits.percent}% Completed` : undefined,
      href: '/student/registration',
    } satisfies StudentQuickStat);
  const library =
    byKey.library ??
    ({
      key: 'library',
      title: 'Library Books',
      value: String(data.library?.issuedBooks ?? 0),
      subvalue:
        data.library?.dueInDays != null
          ? data.library.dueInDays >= 0
            ? `Due in ${data.library.dueInDays} days`
            : `Overdue by ${Math.abs(data.library.dueInDays)} days`
          : 'Books issued',
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
        tone:
          attendancePercent >= 75
            ? ('good' as const)
            : attendancePercent >= 60
              ? ('warn' as const)
              : ('bad' as const),
      };
    }
    if (s.key === 'library' && libraryIssued != null) {
      return {
        ...s,
        value: String(libraryIssued),
        subvalue:
          libraryDueInDays != null
            ? libraryDueInDays >= 0
              ? `Due in ${libraryDueInDays} day${libraryDueInDays === 1 ? '' : 's'}`
              : `Overdue by ${Math.abs(libraryDueInDays)} day${Math.abs(libraryDueInDays) === 1 ? '' : 's'}`
            : s.subvalue,
      };
    }
    if (s.key === 'cgpa' && data.examinations?.cgpa != null && s.value === '—') {
      return { ...s, value: Number(data.examinations.cgpa).toFixed(2) };
    }
    return s;
  });

  const attendancePct = Number.parseInt(stats[0]?.value ?? '0', 10) || 0;
  const creditsPct = data.credits?.percent ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {stats.map((stat, i) => {
        let visual: React.ReactNode = null;
        if (stat.key === 'attendance') {
          visual = <AttendanceRing pct={attendancePct} />;
        } else if (stat.key === 'cgpa') {
          visual = <MiniBars values={[6, 7, 6.5, 8, 7.5, 8.2, 8.4]} color="#1e4d8c" />;
        } else if (stat.key === 'credits') {
          visual = <CreditsBar percent={creditsPct} />;
        } else if (stat.key === 'library') {
          visual = <Sparkline color="#6366f1" />;
        } else if (stat.key === 'fees') {
          visual = (
            <div className="mt-3 flex items-center gap-1.5 text-slate-400">
              <Wallet className="h-3.5 w-3.5" />
              <span className="text-[10px]">Fee account</span>
            </div>
          );
        }

        return <StatCard key={stat.key} stat={stat} delay={i * 0.04} visual={visual} />;
      })}
    </div>
  );
}
