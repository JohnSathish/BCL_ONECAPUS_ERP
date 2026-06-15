'use client';

import { motion } from 'framer-motion';

import { StudentName } from '@/components/students/student-name';
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
      <div className="animate-pulse rounded-2xl border border-border/40 bg-card/60 p-6">
        <div className="h-6 w-48 rounded bg-muted" />
        <div className="mt-3 h-4 w-72 rounded bg-muted" />
      </div>
    );
  }

  const { profile } = data;
  const greeting = getLocalGreeting();
  const photoSrc = profile.photoUrl ? resolveUploadAssetUrl(profile.photoUrl) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-primary/15 via-card/80 to-background p-4 backdrop-blur-xl sm:p-6"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative shrink-0">
            {photoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc}
                alt=""
                className="h-16 w-16 rounded-2xl border border-border/60 object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-primary/10 text-xl font-bold text-primary shadow-sm">
                <StudentName name={profile.fullName} className="sr-only" />
                {profile.enrollmentNumber?.slice(-2) ?? 'ST'}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {greeting},{' '}
              <StudentName
                name={profile.fullName}
                displayFullName={profile.displayFullName}
                className="inline"
              />
            </h1>
            <p className="mt-1 text-sm font-medium text-foreground/90">{profile.programLabel}</p>
            <p className="text-sm text-muted-foreground">
              {profile.semesterSequence != null
                ? `Semester ${profile.semesterSequence}`
                : 'Semester —'}
              {' · '}
              Roll No: {profile.enrollmentNumber || '—'}
            </p>
            {profile.academicYear ? (
              <p className="text-xs text-muted-foreground">Academic Year: {profile.academicYear}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.department ? (
                <span className="rounded-full border border-border/60 bg-background/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {profile.department}
                </span>
              ) : null}
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  profile.rfidStatus === 'assigned'
                    ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
                )}
              >
                RFID {profile.rfidStatus === 'assigned' ? 'Active' : 'Pending'}
              </span>
              <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                Profile {profile.profileCompletion}%
              </span>
            </div>
          </div>
        </div>
        <div className="shrink-0 rounded-xl border border-border/50 bg-background/50 px-4 py-3 text-right backdrop-blur-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Student Portal
          </p>
          <p className="font-semibold">Today&apos;s Overview</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Classes:{' '}
            <span className="font-medium text-foreground">
              {data.todayTimetable?.length ?? '—'}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            Health:{' '}
            <span className="font-medium text-foreground">{data.health?.score ?? '—'}%</span>
          </p>
        </div>
      </div>
    </motion.div>
  );
}
