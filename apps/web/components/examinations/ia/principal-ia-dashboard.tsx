'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardList, TrendingUp, Users } from 'lucide-react';
import { fetchIaPrincipalDashboard } from '@/services/examinations-ia';

export function PrincipalIaDashboard() {
  const dashboard = useQuery({
    queryKey: ['ia', 'principal-dashboard'],
    queryFn: fetchIaPrincipalDashboard,
  });
  const d = dashboard.data ?? {};

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Principal Desk</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold">
          <ClipboardList className="h-6 w-6 text-primary" />
          Examination Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          At-a-glance IA mark entry, defaulters, and department performance.
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total Students" value={d.totalStudents ?? 0} icon={Users} />
        <Stat label="Pending Mark Entry" value={d.pendingMarkEntry ?? 0} icon={ClipboardList} />
        <Stat
          label="Faculty Pending Eval"
          value={d.facultyPendingEvaluation ?? 0}
          icon={ClipboardList}
        />
        <Stat label="Pending Approvals" value={d.pendingApprovals ?? 0} icon={TrendingUp} />
        <Stat label="High Failure Subjects" value={d.highFailureSubjects ?? 0} icon={TrendingUp} />
        <Stat label="Attendance Defaulters" value={d.attendanceDefaulters ?? 0} icon={Users} />
      </div>

      {(d.topPerformers ?? []).length > 0 && (
        <section className="rounded-2xl border border-border/60 bg-card p-4">
          <h2 className="mb-3 text-sm font-semibold">Top Performers</h2>
          <ul className="divide-y text-sm">
            {(
              d.topPerformers as Array<{
                studentId: string;
                percentage: number;
                totalMarks: number;
              }>
            ).map((p) => (
              <li key={p.studentId} className="flex justify-between py-2">
                <span className="text-muted-foreground">{p.studentId.slice(0, 8)}…</span>
                <strong>
                  {p.totalMarks} marks ({p.percentage.toFixed(1)}%)
                </strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
