'use client';

import Link from 'next/link';
import { ClipboardList, FileUp, PenLine, Users } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { buttonVariants } from '@/components/ui/button';
import type { StaffSubjectCard } from '@/types/staff-portal';
import { cn } from '@/utils/cn';

function roleLabel(role?: string | null) {
  return String(role ?? 'PRIMARY_FACULTY')
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function MySubjectsWidget({
  subjects,
  loading,
}: {
  subjects?: StaffSubjectCard[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-6">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="mt-4 space-y-3">
          <div className="h-20 rounded-xl bg-muted" />
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5" glow>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">My Subjects</h3>
        <Link href="/staff/academic/subjects" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>

      {!subjects?.length ? (
        <p className="mt-4 text-sm text-muted-foreground">No subject assignments yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {subjects.slice(0, 4).map((s) => (
            <li key={s.id} className="rounded-xl border border-border/50 bg-background/40 p-3">
              <p className="font-medium">
                {s.courseCode} — {s.courseTitle}
              </p>
              <p className="text-xs text-muted-foreground">
                Sem {s.semesterNo} · Section {s.sectionCode} · {s.studentCount} students
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] text-primary">
                  {roleLabel(s.role)}
                </span>
                {s.allocationPercent != null ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {Number(s.allocationPercent)}% allocation
                  </span>
                ) : null}
                {s.weeklyHours != null ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    {Number(s.weeklyHours)} hrs/week
                  </span>
                ) : null}
              </div>
              {s.teachingTeam?.length ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Team:{' '}
                  {s.teachingTeam
                    .map(
                      (member) =>
                        `${member.shortCode || member.staffName} (${roleLabel(member.role)})`,
                    )
                    .join(', ')}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {s.canMarkAttendance !== false ? (
                  <Link
                    href="/staff/academic/attendance-entry"
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'h-7 gap-1 text-[10px]',
                    )}
                  >
                    <ClipboardList className="h-3 w-3" />
                    Attendance
                  </Link>
                ) : null}
                {s.canUploadLessonPlan !== false ? (
                  <Link
                    href="/staff/academic/lesson-plans"
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'h-7 gap-1 text-[10px]',
                    )}
                  >
                    <FileUp className="h-3 w-3" />
                    Notes
                  </Link>
                ) : null}
                {s.canEnterInternalMarks ? (
                  <Link
                    href="/staff/academic/marks"
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'h-7 gap-1 text-[10px]',
                    )}
                  >
                    <PenLine className="h-3 w-3" />
                    Marks
                  </Link>
                ) : null}
                <Link
                  href="/staff/academic/students"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'h-7 gap-1 text-[10px]',
                  )}
                >
                  <Users className="h-3 w-3" />
                  Students
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
