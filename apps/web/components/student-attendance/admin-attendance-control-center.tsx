'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  CalendarDays,
  FileWarning,
  Loader2,
  Lock,
  RefreshCcw,
  ShieldCheck,
  Snowflake,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import {
  fetchAttendancePolicy,
  fetchStudentAttendanceDashboard,
  fetchStudentAttendanceReport,
  fetchStudentAttendanceSessions,
  fetchStudentAttendanceSummaries,
  generateStudentAttendanceSessions,
  recalculateStudentAttendanceEligibility,
  updateStudentAttendanceSessionState,
  type StudentAttendanceSession,
} from '@/services/student-attendance';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { institutionDateKey } from '@/lib/institution-date';

export function AdminAttendanceControlCenter() {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => institutionDateKey());
  const [reportType, setReportType] = useState('unmarked');
  const [message, setMessage] = useState('');

  const dashboard = useQuery({
    queryKey: ['student-attendance', 'dashboard'],
    queryFn: fetchStudentAttendanceDashboard,
  });
  const sessions = useQuery({
    queryKey: ['student-attendance', 'sessions', date],
    queryFn: () => fetchStudentAttendanceSessions({ date }),
  });
  const summaries = useQuery({
    queryKey: ['student-attendance', 'summaries'],
    queryFn: () => fetchStudentAttendanceSummaries(),
  });
  const report = useQuery({
    queryKey: ['student-attendance', 'report', reportType, date],
    queryFn: () => {
      if (reportType === 'monthly') {
        const d = new Date(date);
        return fetchStudentAttendanceReport('monthly', {
          month: d.getMonth() + 1,
          year: d.getFullYear(),
        });
      }
      if (reportType === 'cumulative' || reportType === 'defaulters' || reportType === 'shortage') {
        const d = new Date(date);
        const from = `${d.getFullYear()}-01-01`;
        return fetchStudentAttendanceReport(reportType, { from, to: date });
      }
      return fetchStudentAttendanceReport(reportType, { date });
    },
  });
  const policyQ = useQuery({
    queryKey: ['student-attendance', 'policy'],
    queryFn: fetchAttendancePolicy,
  });

  const refreshAll = async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['student-attendance'] })]);
  };

  const generateMut = useMutation({
    mutationFn: () => generateStudentAttendanceSessions({ date }),
    onSuccess: async (result: {
      created?: number;
      removedDuplicates?: number;
      deduped?: number;
      countable?: number;
      attendanceMode?: string;
    }) => {
      const removed = result.removedDuplicates ?? 0;
      const created = result.created ?? 0;
      const mode = result.attendanceMode ? ` (${result.attendanceMode})` : '';
      setMessage(
        removed > 0
          ? `Opened ${created} sessions from published timetables${mode}. Removed ${removed} duplicate session(s).`
          : `Generated/opened ${created} sessions from published timetables${mode}.`,
      );
      await refreshAll();
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Could not generate sessions')),
  });

  const eligibilityMut = useMutation({
    mutationFn: () => recalculateStudentAttendanceEligibility({}),
    onSuccess: async (rows: any[]) => {
      setMessage(`Eligibility recalculated for ${rows.length} subject records.`);
      await refreshAll();
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Could not recalculate eligibility')),
  });

  const stats = dashboard.data ?? {};
  const sessionRows = sessions.data ?? [];
  const markedCount = sessionRows.filter((row) =>
    ['MARKED', 'LOCKED', 'FROZEN'].includes(String(row.status ?? '').toUpperCase()),
  ).length;
  const unmarkedCount = sessionRows.filter(
    (row) => String(row.status ?? '').toUpperCase() === 'OPEN',
  ).length;
  const shortageCount = stats.shortageStudents ?? 0;
  const modeLabel = (() => {
    const mode = policyQ.data?.attendanceMode ?? stats.attendanceMode;
    if (mode === 'ONCE_PER_DAY') return 'Once Per Day (First Period)';
    if (mode === 'MORNING_AFTERNOON') return 'Morning & Afternoon Sessions';
    if (mode === 'PERIOD_WISE' || mode === 'EVERY_PERIOD') return 'Period-wise';
    if (mode === 'FIRST_LAST') return 'First & Last Period';
    return mode ?? '—';
  })();
  const sessionLabel =
    stats.aggregationUnit === 'DAY'
      ? 'Today Classes'
      : stats.aggregationUnit === 'SESSION'
        ? 'Today Sessions (AM/PM)'
        : 'Today Sessions';
  const sessionCountLabel =
    date === institutionDateKey() ? sessionLabel : sessionLabel.replace(/^Today /, '');
  const lowSummaries = useMemo(
    () => (summaries.data ?? []).filter((row: any) => Number(row.percentage ?? 0) < 75).slice(0, 8),
    [summaries.data],
  );

  return (
    <div className="space-y-5">
      {dashboard.isError || sessions.isError ? (
        <QueryErrorPanel
          title="Unable to load attendance control center"
          error={dashboard.error ?? sessions.error}
          onRetry={() => {
            void dashboard.refetch();
            void sessions.refetch();
          }}
          isRetrying={dashboard.isFetching || sessions.isFetching}
        />
      ) : null}
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              FYUGP Student Attendance
            </p>
            <h1 className="mt-1 text-2xl font-bold">Admin Control Center</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Generate timetable-linked sessions, monitor marking compliance, freeze/lock periods,
              calculate eligibility, and track defaulters.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            />
            <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
              {generateMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarDays className="mr-2 h-4 w-4" />
              )}
              Generate From Timetable
            </Button>
            <Button
              variant="outline"
              onClick={() => eligibilityMut.mutate()}
              disabled={eligibilityMut.isPending}
            >
              {eligibilityMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Recalculate Eligibility
            </Button>
          </div>
        </div>
        {message ? (
          <p className="mt-3 rounded-xl bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            {message}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border/50 bg-background/60 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Attendance collection mode
            </p>
            <p className="text-sm text-muted-foreground">
              Current: <span className="font-medium text-foreground">{modeLabel}</span>
              {stats.unitLabels?.percentageHint ? ` · ${stats.unitLabels.percentageHint}` : ''}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/settings/attendance">Attendance Settings</Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <KpiCard
          label={sessionCountLabel}
          value={sessionRows.length}
          icon={<CalendarDays className="h-5 w-5" />}
        />
        <KpiCard label="Marked" value={markedCount} icon={<ShieldCheck className="h-5 w-5" />} />
        <KpiCard
          label="Unmarked"
          value={unmarkedCount}
          icon={<FileWarning className="h-5 w-5" />}
        />
        <KpiCard
          label="Shortage/Defaulters"
          value={shortageCount}
          icon={<BarChart3 className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Daily Session Register</h2>
              <p className="text-xs text-muted-foreground">
                Lock, freeze, reopen, and monitor attendance sessions.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => sessions.refetch()}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
          <div className="overflow-auto rounded-2xl border border-border/60">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Counts</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(sessions.data ?? []).map((session) => (
                  <SessionAdminRow key={session.id} session={session} onDone={refreshAll} />
                ))}
                {!sessions.isLoading && !(sessions.data ?? []).length ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-muted-foreground" colSpan={5}>
                      No sessions for selected date.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">Reports & Eligibility</h2>
              <p className="text-xs text-muted-foreground">
                Shortage, defaulters, unmarked classes and summaries.
              </p>
            </div>
            <select
              value={reportType}
              onChange={(event) => setReportType(event.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="unmarked">Unmarked Classes</option>
              <option value="monthly">Monthly Report</option>
              <option value="cumulative">Cumulative Report</option>
              <option value="shortage">Shortage List</option>
              <option value="defaulters">Defaulters</option>
              <option value="daily">Daily Attendance</option>
              <option value="summary">Summary</option>
            </select>
          </div>
          <div className="space-y-2">
            {lowSummaries.map((summary: any) => (
              <div key={summary.id} className="rounded-2xl border border-border/60 p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">Student {summary.studentId.slice(0, 8)}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      Number(summary.percentage) < 65
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-800',
                    )}
                  >
                    {Number(summary.percentage).toFixed(2)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Present {summary.presentCount}/{summary.totalSessions} · Sem{' '}
                  {summary.semesterNo ?? '—'}
                </p>
              </div>
            ))}
            {!lowSummaries.length ? (
              <p className="text-sm text-muted-foreground">No shortage records yet.</p>
            ) : null}
          </div>
          <pre className="mt-4 max-h-56 overflow-auto rounded-2xl bg-muted/40 p-3 text-[11px] text-muted-foreground">
            {JSON.stringify(report.data ?? [], null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}

function SessionAdminRow({
  session,
  onDone,
}: {
  session: StudentAttendanceSession;
  onDone: () => void;
}) {
  const [message, setMessage] = useState('');
  const mut = useMutation({
    mutationFn: (action: 'lock' | 'freeze' | 'reopen') =>
      updateStudentAttendanceSessionState(session.id, action),
    onSuccess: async () => {
      setMessage('Updated');
      await onDone();
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Update failed')),
  });
  return (
    <tr className="border-t border-border/60">
      <td className="px-3 py-2">
        <p className="font-medium">{session.displayTitle ?? session.course?.title ?? 'Class'}</p>
        <p className="text-xs text-muted-foreground">
          {session.course?.code ?? '—'} · Section {session.section?.sectionCode ?? '—'} ·{' '}
          {session.sessionType}
          {session.location
            ? ` · ${session.location.roomCode ?? ''} ${session.location.roomName ?? ''}`
            : ''}
        </p>
      </td>
      <td className="px-3 py-2 text-xs">Period {session.periodNo ?? '—'}</td>
      <td className="px-3 py-2">
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{session.status}</span>
      </td>
      <td className="px-3 py-2 text-xs">
        P {session.counts?.present ?? 0} · A {session.counts?.absent ?? 0} · Total{' '}
        {session.counts?.total ?? 0}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => mut.mutate('lock')}
            disabled={mut.isPending}
          >
            <Lock className="mr-1 h-3 w-3" />
            Lock
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => mut.mutate('freeze')}
            disabled={mut.isPending}
          >
            <Snowflake className="mr-1 h-3 w-3" />
            Freeze
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => mut.mutate('reopen')}
            disabled={mut.isPending}
          >
            Reopen
          </Button>
        </div>
        {message ? <p className="mt-1 text-[10px] text-muted-foreground">{message}</p> : null}
      </td>
    </tr>
  );
}

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
        </div>
        <span className="rounded-2xl bg-primary/10 p-3 text-primary">{icon}</span>
      </div>
    </div>
  );
}
