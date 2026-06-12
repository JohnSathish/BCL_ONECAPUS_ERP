'use client';

import { SectionCard } from '@/components/student-profile/student-profile-shell';
import type { StudentProfile } from '@/types/students';
import { cn } from '@/utils/cn';

function eligibilityTone(status?: string | null) {
  if (status === 'DETAINED') return 'text-rose-600 dark:text-rose-300';
  if (status === 'CONDONATION') return 'text-amber-700 dark:text-amber-300';
  if (status === 'ELIGIBLE') return 'text-emerald-700 dark:text-emerald-300';
  return 'text-muted-foreground';
}

export function StudentProfileAttendanceTab({ profile }: { profile: StudentProfile }) {
  const summary = profile.attendanceSummary;

  if (!summary) {
    return (
      <SectionCard title="Attendance" description="Attendance summary and subject breakdown">
        <p className="text-xs text-muted-foreground">
          No attendance data available for this student.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Attendance"
      description="Semester attendance percentage and subject-wise breakdown"
    >
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-md border border-border p-3">
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Overall</p>
          <p className="text-sm font-semibold">
            {summary.attendancePercent != null ? `${summary.attendancePercent}%` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase text-muted-foreground">Eligibility</p>
          <p
            className={cn('text-sm font-semibold', eligibilityTone(summary.attendanceEligibility))}
          >
            {summary.attendanceEligibility?.replace(/_/g, ' ') ?? 'Not computed'}
          </p>
        </div>
        {summary.attendanceShortage ? (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
            Shortage flagged
          </span>
        ) : null}
      </div>

      {summary.subjects.length === 0 ? (
        <p className="text-xs text-muted-foreground">No subject-level attendance records.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Subject</th>
                <th className="py-2 pr-3 font-medium">Sem</th>
                <th className="py-2 pr-3 font-medium">Present</th>
                <th className="py-2 pr-3 font-medium text-right">%</th>
              </tr>
            </thead>
            <tbody>
              {summary.subjects.map((row, index) => (
                <tr
                  key={`${row.subjectName ?? 'subject'}-${index}`}
                  className="border-b border-border/60"
                >
                  <td className="py-2 pr-3 font-medium">{row.subjectName ?? '—'}</td>
                  <td className="py-2 pr-3">{row.semesterSequence ?? '—'}</td>
                  <td className="py-2 pr-3">
                    {row.presentCount != null && row.totalCount != null
                      ? `${row.presentCount}/${row.totalCount}`
                      : '—'}
                  </td>
                  <td
                    className={cn(
                      'py-2 pr-3 text-right font-medium',
                      row.percentage < 75 ? 'text-amber-700 dark:text-amber-300' : '',
                    )}
                  >
                    {row.percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
