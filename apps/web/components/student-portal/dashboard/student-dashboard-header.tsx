'use client';

import { motion } from 'framer-motion';
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

export function StudentDashboardHeader({ data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="mt-3 h-4 w-72 rounded bg-muted" />
        </div>
        <div className="hidden min-h-[148px] animate-pulse rounded-2xl bg-muted lg:block" />
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
    { label: 'Academic Year', value: profile.academicYear || '—' },
    {
      label: 'Semester',
      value: profile.semesterSequence != null ? `Sem ${profile.semesterSequence}` : '—',
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)]">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-5"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            {photoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc}
                alt=""
                className="h-14 w-14 rounded-2xl object-cover ring-2 ring-[#1e4d8c]/20"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e4d8c] text-sm font-semibold text-white">
                {displayName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join('')}
              </div>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">
              {greeting}, {firstName}!
            </p>
            <h2 className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white sm:text-xl">
              <StudentName
                name={profile.fullName}
                displayFullName={profile.displayFullName}
                className="inline"
              />
            </h2>
            <p className="truncate text-sm text-slate-600 dark:text-slate-300">
              {profile.programLabel}
              {profile.department && profile.department !== profile.programLabel
                ? ` · ${profile.department}`
                : ''}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {chips.map((c) => (
            <div
              key={c.label}
              className={cn(
                'rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/50',
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {c.label}
              </p>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                {c.value}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      <StudentCampusQuoteCard />
    </div>
  );
}
