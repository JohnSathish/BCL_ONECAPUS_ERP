'use client';

import { useQuery } from '@tanstack/react-query';
import { Award, BookOpen, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchMyExamResults } from '@/services/examinations';

export function StudentResultsPortal() {
  const results = useQuery({
    queryKey: ['student', 'exam-results'],
    queryFn: () => fetchMyExamResults(),
  });
  const student = results.data?.student;
  const summaries = results.data?.summaries ?? [];
  const marks = results.data?.marks ?? [];
  const papers = results.data?.papers ?? [];

  if (results.isLoading)
    return (
      <div className="rounded-3xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
        Loading results...
      </div>
    );

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Student Results
            </p>
            <h1 className="mt-1 text-2xl font-bold">My Published Results</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Published marks, SGPA, percentage, and pass/fail status from Examination Management.
            </p>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-border/60 bg-card p-5 print:border-0">
        <div className="border-b border-border/60 pb-4 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">BCL OneCampus ERP</p>
          <h2 className="text-2xl font-bold">Result Statement</h2>
          <p className="text-sm text-muted-foreground">
            {student?.masterProfile?.fullName ?? student?.user?.displayName ?? 'Student'}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Metric icon={<Award />} label="Published Results" value={summaries.length} />
          <Metric icon={<BookOpen />} label="Papers" value={marks.length} />
          <Metric
            icon={<Award />}
            label="Latest Status"
            value={summaries[0]?.resultStatus ?? 'Pending'}
          />
        </div>

        <div className="mt-5 overflow-auto rounded-2xl border border-border/60">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Paper</th>
                <th className="px-3 py-2">Internal</th>
                <th className="px-3 py-2">External</th>
                <th className="px-3 py-2">Practical</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {marks.map((mark: any) => {
                const paper = papers.find((item: any) => item.id === mark.paperId);
                return (
                  <tr key={mark.id} className="border-t border-border/60">
                    <td className="px-3 py-2">
                      <p className="font-medium">{paper?.paperCode ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{paper?.paperName ?? 'Paper'}</p>
                    </td>
                    <td className="px-3 py-2">{mark.internalMarks ?? '—'}</td>
                    <td className="px-3 py-2">{mark.externalMarks ?? '—'}</td>
                    <td className="px-3 py-2">{mark.practicalMarks ?? '—'}</td>
                    <td className="px-3 py-2 font-semibold">
                      {mark.totalMarks ?? '—'} / {mark.maxMarks ?? '—'}
                    </td>
                    <td className="px-3 py-2">{mark.grade ?? '—'}</td>
                    <td className="px-3 py-2">{mark.resultStatus ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!marks.length ? (
            <p className="p-4 text-sm text-muted-foreground">
              No published result is available yet.
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {summaries.map((summary: any) => (
            <div key={summary.id} className="rounded-2xl border border-border/60 p-4">
              <p className="text-xs text-muted-foreground">Overall Result</p>
              <p className="text-xl font-bold">{summary.resultStatus}</p>
              <p className="text-sm text-muted-foreground">
                Percentage {summary.percentage}% · SGPA {summary.sgpa ?? '—'} · Total{' '}
                {summary.totalMarks}/{summary.maxMarks}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-background p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
        <span className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</span>
      </div>
    </div>
  );
}
