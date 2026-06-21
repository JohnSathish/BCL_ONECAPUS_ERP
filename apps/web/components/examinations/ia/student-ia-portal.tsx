'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, TrendingUp } from 'lucide-react';
import {
  IA_ADMIT_CARDS_STUDENT_ENABLED,
  IA_ADMIT_CARDS_STUDENT_PHASE2_MESSAGE,
} from '@/lib/examinations/ia-feature-flags';
import {
  fetchStudentIaMarks,
  fetchStudentIaPerformance,
  fetchStudentIaSchedule,
} from '@/services/examinations-ia';

function dateOnly(value?: string | Date | null) {
  if (!value) return '—';
  return String(value).slice(0, 10);
}

export function StudentIaPortal() {
  const schedule = useQuery({
    queryKey: ['ia', 'student-schedule'],
    queryFn: fetchStudentIaSchedule,
  });
  const marks = useQuery({ queryKey: ['ia', 'student-marks'], queryFn: fetchStudentIaMarks });
  const performance = useQuery({
    queryKey: ['ia', 'student-performance'],
    queryFn: fetchStudentIaPerformance,
  });

  const student = schedule.data?.student;
  const isDefaulter = performance.data?.defaulterStatus === 'DEFAULTER';

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Student Portal</p>
        <h1 className="mt-1 text-2xl font-bold">Internal Assessment</h1>
        {student && (
          <p className="text-sm text-muted-foreground">
            {student.fullName} · Roll {student.rollNumber} · {student.programme}
          </p>
        )}
        {isDefaulter && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-100 px-3 py-2 text-sm text-rose-800">
            <AlertTriangle className="h-4 w-4" />
            Defaulter status — contact examination cell
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <CalendarDays className="h-4 w-4" /> IA Schedule
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2">Code</th>
              <th className="py-2">Paper</th>
              <th className="py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {(schedule.data?.schedule ?? []).map(
              (p: { id: string; paperCode: string; paperName: string; examDate: string }) => (
                <tr key={p.id} className="border-b border-border/40">
                  <td className="py-2">{p.paperCode}</td>
                  <td className="py-2">{p.paperName}</td>
                  <td className="py-2">{dateOnly(p.examDate)}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4" /> Component Marks
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(marks.data?.components ?? []).map(
            (c: {
              code: string;
              label: string;
              marks: number | null;
              maxMarks: number;
              isAbsent: boolean;
            }) => (
              <div
                key={c.code}
                className="rounded-xl border border-border/60 bg-background p-3 text-sm"
              >
                <p className="font-medium">{c.label}</p>
                <p className="text-lg font-bold">
                  {c.isAbsent ? 'AB' : c.marks != null ? c.marks : '—'} / {c.maxMarks}
                </p>
              </div>
            ),
          )}
        </div>
        {(marks.data?.summaries ?? []).length > 0 && (
          <div className="mt-4 rounded-xl bg-muted/50 p-3 text-sm">
            {(
              marks.data.summaries as Array<{
                totalMarks: number;
                maxMarks: number;
                percentage: number;
                resultStatus: string;
              }>
            ).map((s, i) => (
              <p key={i}>
                Total: {s.totalMarks}/{s.maxMarks} ({s.percentage.toFixed(1)}%) — {s.resultStatus}
              </p>
            ))}
          </div>
        )}
      </section>

      {!IA_ADMIT_CARDS_STUDENT_ENABLED ? (
        <section className="rounded-2xl border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
          {IA_ADMIT_CARDS_STUDENT_PHASE2_MESSAGE}
        </section>
      ) : null}
    </div>
  );
}
