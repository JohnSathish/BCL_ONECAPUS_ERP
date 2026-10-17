'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Loader2 } from 'lucide-react';

import { FacultyAttendanceWorkspace } from '@/components/student-attendance/faculty-attendance-workspace';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { institutionDateKey } from '@/lib/institution-date';
import { fetchAcademicDepartments } from '@/services/organization';
import {
  fetchAttendanceCalendarDay,
  fetchStudentAttendanceSessions,
  generateStudentAttendanceSessions,
} from '@/services/student-attendance';
import { apiErrorMessage } from '@/utils/api-error';

export function AdminAttendanceMarkPage() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [date, setDate] = useState(() => searchParams.get('date') || institutionDateKey());
  const [departmentId, setDepartmentId] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
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
  const calendarDay = useQuery({
    queryKey: ['student-attendance', 'calendar-day', date],
    queryFn: () => fetchAttendanceCalendarDay(date),
  });
  const dayClosed = Boolean(calendarDay.data && !calendarDay.data.markingAllowed);

  const generateMut = useMutation({
    mutationFn: () => generateStudentAttendanceSessions({ date }),
    onSuccess: async (result: {
      created?: number;
      attendanceMode?: string;
      skipped?: boolean;
      reason?: string;
    }) => {
      if (result.skipped) {
        setMessage(result.reason || 'This date is closed on the academic calendar.');
      } else {
        const created = result.created ?? 0;
        const mode = result.attendanceMode ? ` (${result.attendanceMode})` : '';
        setMessage(`Opened ${created} classes from the published timetable${mode}.`);
      }
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
  const semesterOptions = useMemo(() => {
    const values = new Set<number>();
    for (const row of visibleSessions) {
      if (row.semesterNo != null) values.add(row.semesterNo);
    }
    return [...values].sort((a, b) => a - b);
  }, [visibleSessions]);
  const periodOptions = useMemo(() => {
    const values = new Set<string>();
    for (const row of visibleSessions) {
      if (semesterFilter && String(row.semesterNo ?? '') !== semesterFilter) continue;
      if (typeFilter && row.sessionType !== typeFilter) continue;
      if (row.periodNo != null) values.add(String(row.periodNo));
    }
    return [...values].sort((a, b) => Number(a) - Number(b));
  }, [semesterFilter, typeFilter, visibleSessions]);
  const typeOptions = useMemo(() => {
    const values = new Set<string>();
    for (const row of visibleSessions) {
      if (row.sessionType) values.add(row.sessionType);
    }
    return [...values].sort();
  }, [visibleSessions]);
  const filteredSessions = useMemo(
    () =>
      visibleSessions.filter((row) => {
        if (semesterFilter && String(row.semesterNo ?? '') !== semesterFilter) return false;
        if (typeFilter && row.sessionType !== typeFilter) return false;
        if (periodFilter && String(row.periodNo ?? '') !== periodFilter) return false;
        return true;
      }),
    [periodFilter, semesterFilter, typeFilter, visibleSessions],
  );

  useEffect(() => {
    if (!filteredSessions.length) {
      setSelectedId(null);
      return;
    }
    if (selectedId && filteredSessions.some((row) => row.id === selectedId)) return;
    const requested = searchParams.get('session');
    const preferred =
      filteredSessions.find((row) => row.id === requested) ??
      filteredSessions.find((row) => String(row.status).toUpperCase() === 'OPEN') ??
      filteredSessions[0];
    setSelectedId(preferred?.id ?? null);
  }, [filteredSessions, selectedId, searchParams]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Choose the semester, then the class. Semester 1, 3, and 5 are listed when that day’s
          timetable has those classes.
          {calendarDay.data
            ? ` This month has ${calendarDay.data.month.workingDays} working days on the academic calendar.`
            : ''}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/academics/attendance">Control Center</Link>
        </Button>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSelectedId(null);
              }}
              className={fieldClass}
              aria-label="Attendance date"
            />
          </Field>
          <Field label="Department">
            <select
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setSelectedId(null);
              }}
              className={fieldClass}
              aria-label="Department"
            >
              <option value="">All teaching departments</option>
              {departmentOptions.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Semester">
            <select
              value={semesterFilter}
              onChange={(event) => {
                setSemesterFilter(event.target.value);
                setSelectedId(null);
              }}
              className={fieldClass}
              aria-label="Semester"
            >
              <option value="">All semesters</option>
              {semesterOptions.map((semester) => (
                <option key={semester} value={String(semester)}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class / Subject">
            <select
              value={selectedId ?? ''}
              onChange={(event) => setSelectedId(event.target.value || null)}
              className={fieldClass}
              aria-label="Class"
            >
              <option value="">Select a class</option>
              {filteredSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.semesterNo ? `Sem ${session.semesterNo} · ` : ''}
                  {session.displayTitle ?? session.course?.title ?? 'Class'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Period">
            <select
              value={periodFilter}
              onChange={(event) => {
                setPeriodFilter(event.target.value);
                setSelectedId(null);
              }}
              className={fieldClass}
              aria-label="Period"
            >
              <option value="">All periods</option>
              {periodOptions.map((period) => (
                <option key={period} value={period}>
                  Period {period}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Class type">
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setSelectedId(null);
              }}
              className={fieldClass}
              aria-label="Class type"
            >
              <option value="">All types</option>
              {typeOptions.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <Button
              className="w-full"
              onClick={() => generateMut.mutate()}
              disabled={generateMut.isPending || dayClosed}
            >
              {generateMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarDays className="mr-2 h-4 w-4" />
              )}
              Generate From Timetable
            </Button>
          </div>
        </div>
        {message ? <p className="mt-3 text-xs text-muted-foreground">{message}</p> : null}
      </section>

      {calendarDay.data && !calendarDay.data.markingAllowed ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          {calendarDay.data.reason}
        </div>
      ) : null}
      {calendarDay.data &&
      !calendarDay.data.isWorkingDay &&
      calendarDay.data.createsAttendanceSession ? (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
          Special working day
          {calendarDay.data.events[0]?.title ? `: ${calendarDay.data.events[0].title}` : ''}.
          Classes follow the academic calendar.
        </div>
      ) : null}
      {calendarDay.data &&
      !calendarDay.data.templateRuns &&
      calendarDay.data.relocatedClasses > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {calendarDay.data.relocatedClasses} rescheduled class
          {calendarDay.data.relocatedClasses === 1 ? '' : 'es'} can be marked on this date.
        </div>
      ) : null}

      {sessions.isError ? (
        <QueryErrorPanel
          title="Unable to load classes"
          error={sessions.error}
          onRetry={() => void sessions.refetch()}
          isRetrying={sessions.isFetching}
        />
      ) : null}

      {!sessions.isLoading && !filteredSessions.length ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {(sessions.data ?? []).length
            ? 'No classes match this semester, department, period, or class type.'
            : 'No classes for this date yet. Generate them from the published timetable.'}
        </div>
      ) : null}

      {selectedId && !dayClosed ? (
        <FacultyAttendanceWorkspace key={selectedId} sessionId={selectedId} layout="register" />
      ) : null}
    </div>
  );
}

const fieldClass = 'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
