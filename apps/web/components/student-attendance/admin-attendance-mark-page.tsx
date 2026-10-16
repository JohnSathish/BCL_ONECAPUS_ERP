'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Loader2 } from 'lucide-react';

import { FacultyAttendanceWorkspace } from '@/components/student-attendance/faculty-attendance-workspace';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { institutionDateKey } from '@/lib/institution-date';
import { fetchAcademicDepartments } from '@/services/organization';
import {
  fetchStudentAttendanceSessions,
  generateStudentAttendanceSessions,
  type StudentAttendanceSession,
} from '@/services/student-attendance';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

export function AdminAttendanceMarkPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [date, setDate] = useState(() => searchParams.get('date') || institutionDateKey());
  const [departmentId, setDepartmentId] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('session'));
  const [message, setMessage] = useState('');

  const departments = useQuery({
    queryKey: ['org', 'departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
  });
  const sessions = useQuery({
    queryKey: ['student-attendance', 'sessions', date],
    queryFn: () => fetchStudentAttendanceSessions({ date }),
  });

  const generateMut = useMutation({
    mutationFn: () => generateStudentAttendanceSessions({ date }),
    onSuccess: async (result: { created?: number; attendanceMode?: string }) => {
      const created = result.created ?? 0;
      const mode = result.attendanceMode ? ` (${result.attendanceMode})` : '';
      setMessage(`Opened ${created} classes from the published timetable${mode}.`);
      await qc.invalidateQueries({ queryKey: ['student-attendance'] });
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Could not generate classes')),
  });

  const departmentOptions = useMemo(
    () => [...(departments.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [departments.data],
  );
  const visibleSessions = useMemo(() => {
    const rows = departmentId
      ? (sessions.data ?? []).filter((row) => row.department?.id === departmentId)
      : (sessions.data ?? []);
    return [...rows].sort((a, b) => {
      const department = (a.department?.name ?? 'Other').localeCompare(
        b.department?.name ?? 'Other',
      );
      if (department !== 0) return department;
      return (a.displayTitle ?? a.course?.title ?? '').localeCompare(
        b.displayTitle ?? b.course?.title ?? '',
      );
    });
  }, [departmentId, sessions.data]);

  useEffect(() => {
    if (!visibleSessions.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && visibleSessions.some((row) => row.id === selectedId)) return;
    const requested = searchParams.get('session');
    const preferred =
      visibleSessions.find((row) => row.id === requested) ??
      visibleSessions.find((row) => String(row.status).toUpperCase() === 'OPEN') ??
      visibleSessions[0];
    setSelectedId(preferred?.id ?? null);
  }, [visibleSessions, selectedId, searchParams]);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              FYUGP Student Attendance
            </p>
            <h1 className="mt-1 text-2xl font-bold">Mark Attendance</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Choose the date and teaching department, then open the class and enter the roll from
              the attendance register. Once-per-day mode uses the first period only.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/academics/attendance">Control Center</Link>
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setSelectedId(null);
            }}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            aria-label="Attendance date"
          />
          <select
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value);
              setSelectedId(null);
            }}
            className="h-9 min-w-48 rounded-lg border border-border bg-background px-2 text-sm"
            aria-label="Department"
          >
            <option value="">All teaching departments</option>
            {departmentOptions.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <Button onClick={() => generateMut.mutate()} disabled={generateMut.isPending}>
            {generateMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CalendarDays className="mr-2 h-4 w-4" />
            )}
            Generate From Timetable
          </Button>
        </div>
        {message ? (
          <p className="mt-3 rounded-xl bg-background/70 px-3 py-2 text-xs text-muted-foreground">
            {message}
          </p>
        ) : null}
      </section>

      {sessions.isError ? (
        <QueryErrorPanel
          title="Unable to load classes"
          error={sessions.error}
          onRetry={() => void sessions.refetch()}
          isRetrying={sessions.isFetching}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-3xl border border-border/60 bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <h2 className="text-sm font-semibold">Classes</h2>
            <span className="text-xs text-muted-foreground">{visibleSessions.length}</span>
          </div>
          <div className="max-h-[70vh] space-y-2 overflow-auto">
            {sessions.isLoading ? (
              <p className="px-2 py-6 text-sm text-muted-foreground">Loading classes…</p>
            ) : null}
            {visibleSessions.map((session) => (
              <ClassButton
                key={session.id}
                session={session}
                active={selectedId === session.id}
                onClick={() => setSelectedId(session.id)}
              />
            ))}
            {!sessions.isLoading && !visibleSessions.length ? (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                {(sessions.data ?? []).length
                  ? 'No classes for this department on the selected date.'
                  : 'No classes for this date yet. Generate them from the published timetable, then pick a department and class.'}
              </div>
            ) : null}
          </div>
        </aside>

        <div className="min-w-0">
          {selectedId ? (
            <FacultyAttendanceWorkspace key={selectedId} sessionId={selectedId} />
          ) : (
            <div className="flex min-h-64 items-center justify-center rounded-3xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <div>
                <ClipboardList className="mx-auto mb-2 h-6 w-6" />
                Select a class to enter the roll.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClassButton({
  session,
  active,
  onClick,
}: {
  session: StudentAttendanceSession;
  active: boolean;
  onClick: () => void;
}) {
  const status = String(session.status ?? '').toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border px-3 py-2 text-left transition',
        active ? 'border-primary bg-primary/10' : 'border-border/60 hover:bg-muted/50',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">
          {session.displayTitle ?? session.course?.title ?? 'Class'}
        </p>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            status === 'OPEN' && 'bg-amber-100 text-amber-800',
            status === 'MARKED' && 'bg-emerald-100 text-emerald-800',
            (status === 'LOCKED' || status === 'FROZEN') && 'bg-muted text-muted-foreground',
          )}
        >
          {status || '—'}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {session.department?.name ?? 'No department'} · Period {session.periodNo ?? '—'} · Section{' '}
        {session.section?.sectionCode ?? '—'}
      </p>
    </button>
  );
}
