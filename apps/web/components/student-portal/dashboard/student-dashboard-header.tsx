'use client';

import { motion } from 'framer-motion';
import { Building2, CalendarDays, GraduationCap, Hash, IdCard, Layers, Sun } from 'lucide-react';
import { StudentName } from '@/components/students/student-name';
import { StudentCampusQuoteCard } from '@/components/student-portal/dashboard/student-campus-quote-card';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import type { StudentDashboardView } from '@/types/student-portal';
import { getLocalGreeting } from '@/utils/student-portal-utils';
import { cn } from '@/utils/cn';

type Props = {
  data?: StudentDashboardView;
  loading?: boolean;
};

const CHIP_ICONS = {
  'Roll No.': Hash,
  'College Reg.': IdCard,
  'NEHU Reg.': GraduationCap,
  Department: Building2,
  Shift: Sun,
  'Academic Year': CalendarDays,
  Semester: Layers,
} as const;

export function StudentDashboardHeader({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.85fr)]">
        <div className="animate-pulse rounded-3xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="mt-3 h-4 w-72 rounded bg-muted" />
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-muted" />
            ))}
          </div>
        </div>
        <div className="hidden min-h-[168px] animate-pulse rounded-3xl bg-muted lg:block" />
      </div>
    );
  }

  const { profile } = data;
  const greeting = getLocalGreeting();
  const photoSrc = profile.photoUrl ? resolveUploadAssetUrl(profile.photoUrl) : null;
  const displayName = profile.displayFullName?.trim() || profile.fullName;
  const firstName = displayName.split(/\s+/)[0] || displayName;

  const chips = [
    { label: 'Roll No.', value: profile.rollNumber?.trim() || '—' },
    { label: 'College Reg.', value: profile.enrollmentNumber?.trim() || '—' },
    { label: 'NEHU Reg.', value: profile.universityRegistrationNumber?.trim() || '—' },
    { label: 'Department', value: profile.department || '—' },
    { label: 'Shift', value: profile.shiftName?.trim() || profile.shiftCode?.trim() || '—' },
    { label: 'Academic Year', value: profile.academicYear || '—' },
    {
      label: 'Semester',
      value: profile.semesterSequence != null ? `Sem ${profile.semesterSequence}` : '—',
    },
  ] as const;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.85fr)]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200/70 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:p-5"
      >
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="relative shrink-0">
            {photoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc}
                alt=""
                className="h-16 w-16 rounded-2xl object-cover shadow-md ring-2 ring-sky-500/20"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-700 text-base font-semibold text-white shadow-md">
                {displayName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-[3px] ring-white dark:ring-slate-900" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {greeting}, {firstName}!{' '}
              <span aria-hidden className="inline-block">
                👋
              </span>
            </p>
            <h2 className="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              <StudentName
                name={profile.fullName}
                displayFullName={profile.displayFullName}
                className="inline"
              />
            </h2>
            <p className="mt-0.5 truncate text-sm text-slate-600 dark:text-slate-300">
              {profile.programLabel}
              {profile.department && profile.department !== profile.programLabel
                ? ` · ${profile.department}`
                : ''}
              {profile.shiftName ? ` · ${profile.shiftName} Shift` : ''}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {chips.map((c) => {
            const Icon = CHIP_ICONS[c.label];
            return (
              <div
                key={c.label}
                className={cn(
                  'rounded-2xl border border-slate-100 bg-gradient-to-b from-white to-slate-50/90 px-2.5 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.03)] dark:border-slate-800 dark:from-slate-950 dark:to-slate-900',
                  c.label === 'Shift' &&
                    c.value !== '—' &&
                    'border-sky-200/80 from-sky-50/80 to-white dark:border-sky-900/50 dark:from-sky-950/30',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-slate-400" />
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {c.label}
                  </p>
                </div>
                <p className="mt-1 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {c.value}
                </p>
              </div>
            );
          })}
        </div>
      </motion.div>

      <StudentCampusQuoteCard />
    </div>
  );
}
