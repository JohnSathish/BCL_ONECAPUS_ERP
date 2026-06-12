'use client';

import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, Loader2 } from 'lucide-react';

import { fetchMyStudentAttendance } from '@/services/student-attendance';
import { cn } from '@/utils/cn';

export function StudentAttendancePortal() {
  const attendance = useQuery({
    queryKey: ['student-attendance', 'portal-me'],
    queryFn: fetchMyStudentAttendance,
  });

  if (attendance.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-3xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading attendance summary...
      </div>
    );
  }

  const data = attendance.data ?? { subjects: [], overall: null, alerts: [] };
  const overall = data.overall == null ? null : Number(data.overall);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">My Attendance</p>
        <h1 className="mt-1 text-2xl font-bold">Attendance & Eligibility</h1>
        <p className="text-sm text-muted-foreground">
          Track subject-wise attendance, overall percentage, and shortage warnings for the current
          semester.
        </p>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <PortalKpi
          label="Overall"
          value={overall == null ? '—' : `${overall.toFixed(2)}%`}
          tone={overall == null || overall >= 75 ? 'success' : overall >= 65 ? 'warning' : 'danger'}
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <PortalKpi
          label="Subjects"
          value={data.subjects.length}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <PortalKpi
          label="Shortage Alerts"
          value={data.alerts.length}
          tone={data.alerts.length ? 'warning' : 'success'}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      {data.alerts.length ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <h2 className="font-semibold">Attendance alerts</h2>
          <ul className="mt-2 space-y-1">
            {data.alerts.map((alert: any, index: number) => (
              <li key={`${alert.courseId}-${index}`}>
                {alert.message}: {Number(alert.percentage).toFixed(2)}%
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Subject Register</h2>
        <div className="mt-3 grid gap-2">
          {data.subjects.map((subject: any) => {
            const pct = Number(subject.percentage ?? 0);
            return (
              <div key={subject.id} className="rounded-2xl border border-border/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      Subject {subject.courseId?.slice(0, 8) ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Present {subject.presentCount}/{subject.totalSessions} · Absent{' '}
                      {subject.absentCount}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-1 text-xs font-semibold',
                      pct >= 75
                        ? 'bg-emerald-100 text-emerald-700'
                        : pct >= 65
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-700',
                    )}
                  >
                    {pct.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      pct >= 75 ? 'bg-emerald-500' : pct >= 65 ? 'bg-amber-500' : 'bg-rose-500',
                    )}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
          {!data.subjects.length ? (
            <p className="text-sm text-muted-foreground">
              No attendance records are available yet.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PortalKpi({
  label,
  value,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <span
          className={cn(
            'rounded-2xl p-3',
            tone === 'success' && 'bg-emerald-100 text-emerald-700',
            tone === 'warning' && 'bg-amber-100 text-amber-800',
            tone === 'danger' && 'bg-rose-100 text-rose-700',
            tone === 'default' && 'bg-primary/10 text-primary',
          )}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}
