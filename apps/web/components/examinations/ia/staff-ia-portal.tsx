'use client';

import { useQuery } from '@tanstack/react-query';
import { BookOpen, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { IaMarkEntryWorkspace } from '@/components/examinations/ia/ia-admin-workspaces';
import { fetchFacultyIaSubjects, fetchPendingIaApprovals } from '@/services/examinations-ia';

export function StaffIaPortal() {
  const subjects = useQuery({
    queryKey: ['ia', 'faculty-subjects'],
    queryFn: fetchFacultyIaSubjects,
  });
  const approvals = useQuery({ queryKey: ['ia', 'approvals'], queryFn: fetchPendingIaApprovals });

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Staff Portal</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <ClipboardList className="h-6 w-6 text-primary" />
          Internal Assessment Mark Entry
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter marks only for subjects you are assigned to teach (canEnterInternalMarks).
        </p>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="h-4 w-4" /> My Subjects
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {(subjects.data ?? []).map(
            (s: {
              assignmentId: string;
              courseCode: string;
              courseName: string;
              semesterNo?: number;
              papers?: Array<{ id: string; paperCode: string }>;
            }) => (
              <li
                key={s.assignmentId}
                className="rounded-xl border border-border/60 bg-background p-3 text-sm"
              >
                <p className="font-medium">
                  {s.courseCode} — {s.courseName}
                </p>
                <p className="text-xs text-muted-foreground">Semester {s.semesterNo ?? '—'}</p>
                {(s.papers ?? []).map((p) => (
                  <Link
                    key={p.id}
                    href={`/staff/academic/ia/mark-entry/${p.id}`}
                    className="mt-2 inline-block text-xs text-primary hover:underline"
                  >
                    Enter marks →
                  </Link>
                ))}
              </li>
            ),
          )}
        </ul>
        {!subjects.data?.length && (
          <p className="text-sm text-muted-foreground">
            No assigned subjects with mark entry permission.
          </p>
        )}
      </section>

      {(approvals.data ?? []).length > 0 && (
        <section className="rounded-2xl border border-border/60 bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">Pending HOD Approvals</h2>
          <Link
            href="/staff/academic/ia/approvals"
            className="text-sm text-primary hover:underline"
          >
            Review {approvals.data.length} pending item(s) →
          </Link>
        </section>
      )}

      <IaMarkEntryWorkspace staffMode />
    </div>
  );
}
