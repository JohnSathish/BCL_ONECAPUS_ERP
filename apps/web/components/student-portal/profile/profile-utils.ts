import type { StudentPortalProfile360 } from '@/types/student-portal-profile';

export function attendanceTone(pct: number | null | undefined) {
  if (pct == null) return 'neutral' as const;
  if (pct >= 75) return 'good' as const;
  if (pct >= 65) return 'warn' as const;
  return 'bad' as const;
}

export function attendanceBarClass(tone: ReturnType<typeof attendanceTone>) {
  if (tone === 'good') return 'bg-emerald-500';
  if (tone === 'warn') return 'bg-amber-500';
  if (tone === 'bad') return 'bg-rose-500';
  return 'bg-primary';
}

export function profileDefaults(profile: StudentPortalProfile360) {
  return {
    completion: profile.profileCompletion ?? { percent: 0, missing: [] },
    progress: profile.academicProgress ?? {
      currentSemester: profile.academic.semester ?? 1,
      totalSemesters: 6,
    },
    stats: profile.statistics ?? {
      libraryBooks: 0,
      certificates: profile.certificates.length,
      assignments: 0,
      attendance: profile.attendance.overall,
      cgpa: null,
    },
    requiredDocs: profile.requiredDocuments ?? [],
    activity: profile.recentActivity ?? [],
    achievements: profile.achievements ?? [],
  };
}

const SUBJECT_CARD_STYLES: Record<string, string> = {
  MAJOR: 'from-violet-500/15 to-violet-500/5 border-violet-500/25',
  MINOR: 'from-sky-500/15 to-sky-500/5 border-sky-500/25',
  MDC: 'from-emerald-500/15 to-emerald-500/5 border-emerald-500/25',
  AEC: 'from-amber-500/15 to-amber-500/5 border-amber-500/25',
  SEC: 'from-rose-500/15 to-rose-500/5 border-rose-500/25',
  VAC: 'from-teal-500/15 to-teal-500/5 border-teal-500/25',
};

export function subjectCardStyle(category: string) {
  return (
    SUBJECT_CARD_STYLES[category.toUpperCase()] ?? 'from-primary/10 to-primary/5 border-primary/20'
  );
}
