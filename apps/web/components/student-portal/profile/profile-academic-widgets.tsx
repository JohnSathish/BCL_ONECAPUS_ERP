'use client';

import { Award, BookOpen, Brain, Globe, GraduationCap } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import type { StudentPortalProfile360 } from '@/types/student-portal-profile';
import { cn } from '@/utils/cn';
import { profileDefaults, subjectCardStyle } from './profile-utils';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MAJOR: GraduationCap,
  MINOR: BookOpen,
  MDC: Brain,
  AEC: Award,
  SEC: BookOpen,
  VAC: Globe,
};

export function ProfileAcademicSnapshot({ profile }: { profile: StudentPortalProfile360 }) {
  const subjects = profile.academic.subjects.length
    ? profile.academic.subjects
    : ([
        profile.academic.major
          ? { category: 'MAJOR', label: 'Major', title: profile.academic.major }
          : null,
        profile.academic.minor
          ? { category: 'MINOR', label: 'Minor', title: profile.academic.minor }
          : null,
      ].filter(Boolean) as StudentPortalProfile360['academic']['subjects']);

  return (
    <GlassCard className="p-5">
      <h2 className="text-sm font-semibold tracking-tight">Academic Snapshot</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {subjects.map((s) => {
          const Icon = CATEGORY_ICONS[s.category] ?? GraduationCap;
          return (
            <div
              key={`${s.category}-${s.title}`}
              className={cn(
                'rounded-xl border bg-gradient-to-br p-3',
                subjectCardStyle(s.category),
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold leading-snug">{s.title}</p>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

export function ProfileAcademicProgress({ profile }: { profile: StudentPortalProfile360 }) {
  const { progress } = profileDefaults(profile);

  return (
    <GlassCard className="p-5">
      <h2 className="text-sm font-semibold tracking-tight">Semester Progress</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Semester {progress.currentSemester} of {progress.totalSemesters}
      </p>
      <div className="mt-4 flex items-center justify-center gap-2">
        {Array.from({ length: progress.totalSemesters }, (_, i) => {
          const sem = i + 1;
          const done = sem < progress.currentSemester;
          const current = sem === progress.currentSemester;
          return (
            <div key={sem} className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition',
                  done && 'border-emerald-500 bg-emerald-500/15 text-emerald-700',
                  current &&
                    'border-primary bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.25)]',
                  !done && !current && 'border-border/60 bg-muted/30 text-muted-foreground',
                )}
              >
                {done ? '✓' : sem}
              </span>
              <span className="text-[9px] text-muted-foreground">Sem {sem}</span>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

export function ProfileAchievements({ profile }: { profile: StudentPortalProfile360 }) {
  const { achievements } = profileDefaults(profile);
  if (!achievements.length) return null;

  return (
    <GlassCard className="p-5">
      <h2 className="text-sm font-semibold tracking-tight">Achievement Badges</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {achievements.map((badge) => (
          <span
            key={badge.code}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              badge.earned
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border/50 bg-muted/30 text-muted-foreground opacity-60',
            )}
          >
            {badge.label}
            {badge.earned ? ' ✓' : ''}
          </span>
        ))}
      </div>
    </GlassCard>
  );
}
