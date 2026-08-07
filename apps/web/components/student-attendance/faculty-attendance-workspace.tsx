'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock3,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  UserX,
  Users,
} from 'lucide-react';

import { AttendanceStatusButtonBar } from '@/components/student-attendance/attendance-status-buttons';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import {
  ATTENDANCE_STATUS_MAP,
  isExtendedAttendanceStatus,
  summarizeAttendanceStatuses,
  type AttendanceStatusCode,
} from '@/components/student-attendance/attendance-status-config';
import {
  fetchAttendancePolicy,
  fetchFacultyTodayAttendance,
  fetchStudentAttendanceRoster,
  markStudentAttendance,
  type StudentAttendanceRoster,
  type StudentAttendanceRosterRow,
  type StudentAttendanceSession,
} from '@/services/student-attendance';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type DraftEntry = { status: string; remarks?: string };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function FacultyAttendanceWorkspace() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get('section');
  const sessionParam = searchParams.get('sessionId');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Record<string, DraftEntry>>({});
  const [message, setMessage] = useState('');
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const policyQ = useQuery({
    queryKey: ['student-attendance', 'policy'],
    queryFn: fetchAttendancePolicy,
  });

  const sessions = useQuery({
    queryKey: ['student-attendance', 'faculty-today'],
    queryFn: fetchFacultyTodayAttendance,
  });

  useEffect(() => {
    const list = sessions.data ?? [];
    if (!list.length) return;

    if (sessionParam) {
      const match = list.find((s) => s.id === sessionParam);
      if (match) {
        setSelectedId(match.id);
        return;
      }
    }

    if (sectionParam) {
      const match = list.find((s) => s.offeringSectionId === sectionParam);
      if (match) {
        setSelectedId(match.id);
      }
    }
  }, [sessions.data, sessionParam, sectionParam]);

  const selected = selectedId ?? sessions.data?.[0]?.id ?? null;
  const roster = useQuery({
    queryKey: ['student-attendance', 'roster', selected],
    queryFn: () => fetchStudentAttendanceRoster(selected as string),
    enabled: Boolean(selected),
  });

  const students = roster.data?.students ?? [];

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return students.filter((student) => {
      if (!needle) return true;
      return [
        student.fullName,
        student.rollNumber,
        student.enrollmentNumber,
        student.admissionNumber,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [students, search]);

  const summary = useMemo(() => summarizeAttendanceStatuses(students, draft), [students, draft]);

  const effectiveStatus = useCallback(
    (student: StudentAttendanceRosterRow) => draft[student.id]?.status ?? student.status ?? 'P',
    [draft],
  );

  const effectiveRemarks = useCallback(
    (student: StudentAttendanceRosterRow) => draft[student.id]?.remarks ?? student.remarks ?? '',
    [draft],
  );

  const patchRosterStudent = useCallback(
    (studentId: string, patch: Partial<StudentAttendanceRosterRow>) => {
      if (!selected) return;
      qc.setQueryData<StudentAttendanceRoster>(
        ['student-attendance', 'roster', selected],
        (current) => {
          if (!current) return current;
          return {
            ...current,
            students: current.students.map((student) =>
              student.id === studentId ? { ...student, ...patch } : student,
            ),
          };
        },
      );
    },
    [qc, selected],
  );

  const saveEntry = useMutation({
    mutationFn: async ({
      studentId,
      status,
      remarks,
      lockAfterSave = false,
    }: {
      studentId: string;
      status: string;
      remarks?: string;
      lockAfterSave?: boolean;
    }) => {
      if (!selected) return null;
      return markStudentAttendance(selected, {
        mode: 'MANUAL',
        lockAfterSave,
        entries: [{ studentId, status, remarks }],
      });
    },
    onMutate: ({ studentId }) => {
      setSaveStates((prev) => ({ ...prev, [studentId]: 'saving' }));
    },
    onSuccess: (data, { studentId, status, remarks }) => {
      patchRosterStudent(studentId, { status, remarks });
      setDraft((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      setSaveStates((prev) => ({ ...prev, [studentId]: 'saved' }));
      window.setTimeout(() => {
        setSaveStates((prev) =>
          prev[studentId] === 'saved' ? { ...prev, [studentId]: 'idle' } : prev,
        );
      }, 1800);
      if (data?.session) {
        qc.setQueryData(['student-attendance', 'roster', selected], data);
      }
      void qc.invalidateQueries({ queryKey: ['student-attendance', 'faculty-today'] });
    },
    onError: (error, { studentId }) => {
      setSaveStates((prev) => ({ ...prev, [studentId]: 'error' }));
      setMessage(apiErrorMessage(error, 'Could not save attendance'));
    },
  });

  const scheduleAutoSave = useCallback(
    (studentId: string, status: string, remarks?: string) => {
      if (saveTimers.current[studentId]) {
        clearTimeout(saveTimers.current[studentId]);
      }
      saveTimers.current[studentId] = setTimeout(() => {
        saveEntry.mutate({ studentId, status, remarks });
      }, 350);
    },
    [saveEntry],
  );

  const updateStudent = useCallback(
    (studentId: string, status: string, remarks?: string) => {
      setDraft((prev) => ({
        ...prev,
        [studentId]: { status, remarks: remarks ?? prev[studentId]?.remarks },
      }));
      scheduleAutoSave(studentId, status, remarks);
    },
    [scheduleAutoSave],
  );

  const updateRemarks = useCallback(
    (studentId: string, status: string, remarks: string) => {
      setDraft((prev) => ({
        ...prev,
        [studentId]: { status, remarks },
      }));
      scheduleAutoSave(studentId, status, remarks);
    },
    [scheduleAutoSave],
  );

  const bulkSaveMut = useMutation({
    mutationFn: async ({
      entries,
      lockAfterSave,
    }: {
      entries: Array<{ studentId: string; status: string; remarks?: string }>;
      lockAfterSave: boolean;
    }) => {
      if (!selected) return null;
      return markStudentAttendance(selected, {
        mode: 'ABSENTEES_ONLY',
        lockAfterSave,
        entries,
      });
    },
    onSuccess: async () => {
      setMessage('Attendance saved successfully.');
      setDraft({});
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['student-attendance', 'faculty-today'] }),
        qc.invalidateQueries({ queryKey: ['student-attendance', 'roster', selected] }),
      ]);
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Could not save attendance')),
  });

  const buildAllEntries = useCallback(
    (status: string) =>
      students.map((student) => ({
        studentId: student.id,
        status,
        remarks: draft[student.id]?.remarks ?? student.remarks,
      })),
    [students, draft],
  );

  const markAllPresent = () => {
    const next: Record<string, DraftEntry> = {};
    students.forEach((student) => {
      next[student.id] = { status: 'P', remarks: draft[student.id]?.remarks };
    });
    setDraft(next);
    bulkSaveMut.mutate({ entries: buildAllEntries('P'), lockAfterSave: false });
  };

  const markAllAbsent = () => {
    const next: Record<string, DraftEntry> = {};
    students.forEach((student) => {
      next[student.id] = { status: 'A', remarks: draft[student.id]?.remarks };
    });
    setDraft(next);
    bulkSaveMut.mutate({ entries: buildAllEntries('A'), lockAfterSave: false });
  };

  const resetDraft = () => {
    Object.values(saveTimers.current).forEach(clearTimeout);
    saveTimers.current = {};
    setDraft({});
    setSaveStates({});
    setMessage('');
  };

  const isLocked =
    roster.data?.session.status === 'LOCKED' || roster.data?.session.status === 'FROZEN';

  const modeBanner = (() => {
    const mode = policyQ.data?.attendanceMode ?? roster.data?.session?.attendanceMode;
    if (mode === 'ONCE_PER_DAY') {
      return 'Daily attendance — mark once in the first period. Status applies for the whole working day.';
    }
    if (mode === 'MORNING_AFTERNOON') {
      return 'Morning & afternoon attendance — mark each session (AM / PM) separately.';
    }
    if (mode === 'PERIOD_WISE' || mode === 'EVERY_PERIOD') {
      return 'Period-wise attendance — mark every scheduled class period.';
    }
    if (mode === 'FIRST_LAST') {
      return 'First & last period mode — only first and last teaching periods require marking.';
    }
    return null;
  })();

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Attendance Entry
            </p>
            <h1 className="mt-1 text-2xl font-bold">Today&apos;s Classes</h1>
            <p className="text-sm text-muted-foreground">
              Mark all present, then tap only exceptions. Changes save automatically.
            </p>
            {modeBanner ? (
              <p className="mt-2 rounded-xl border border-border/50 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                {modeBanner}
              </p>
            ) : null}
          </div>
          <Button onClick={() => sessions.refetch()} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </section>

      {sessions.isError ? (
        <QueryErrorPanel
          title="Unable to load today's attendance sessions"
          error={sessions.error}
          onRetry={() => void sessions.refetch()}
          isRetrying={sessions.isFetching}
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <aside className="space-y-2">
          {sessions.isLoading ? <LoadingCard label="Loading today's timetable..." /> : null}
          {(sessions.data ?? []).map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              active={selected === session.id}
              onClick={() => {
                setSelectedId(session.id);
                resetDraft();
              }}
            />
          ))}
          {!sessions.isLoading && !(sessions.data ?? []).length ? (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No attendance sessions generated for today. Ask admin to generate sessions from
              timetable.
            </div>
          ) : null}
        </aside>

        <main className="min-w-0 rounded-3xl border border-border/60 bg-card shadow-sm">
          {!selected ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Select a class to begin.
            </div>
          ) : roster.isError ? (
            <div className="p-4">
              <QueryErrorPanel
                title="Unable to load class roster"
                error={roster.error}
                onRetry={() => void roster.refetch()}
                isRetrying={roster.isFetching}
              />
            </div>
          ) : roster.isLoading ? (
            <LoadingCard label="Loading class roster..." />
          ) : roster.data ? (
            <>
              <div className="sticky top-0 z-10 rounded-t-3xl border-b border-border/60 bg-card/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold">
                      {roster.data.session.displayTitle ??
                        roster.data.session.subjectGroup?.title ??
                        roster.data.session.course?.title ??
                        'Class roster'}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {roster.data.session.displayHeader?.subtitle
                        ? `${roster.data.session.displayHeader.subtitle}${
                            roster.data.session.displayHeader.details
                              ? ` · ${roster.data.session.displayHeader.details}`
                              : ''
                          }`
                        : `${
                            roster.data.session.paperCourse?.code ??
                            roster.data.session.subjectGroup?.code ??
                            roster.data.session.course?.code ??
                            '—'
                          } · Section ${roster.data.session.section?.sectionCode ?? '—'} · Period ${
                            roster.data.session.periodNo ?? '—'
                          } · ${roster.data.session.sessionType}${
                            roster.data.session.location
                              ? ` · ${roster.data.session.location.roomCode ?? ''} ${roster.data.session.location.roomName ?? ''}`
                              : ''
                          }`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={markAllPresent}
                      disabled={bulkSaveMut.isPending || isLocked}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {bulkSaveMut.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Mark All Present
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={markAllAbsent}
                      disabled={bulkSaveMut.isPending || isLocked}
                    >
                      <UserX className="mr-2 h-4 w-4" />
                      All Absent
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetDraft}
                      disabled={!Object.keys(draft).length}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Reset
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <SummaryChip
                    label="Present"
                    value={summary.present}
                    className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                  />
                  <SummaryChip
                    label="Absent"
                    value={summary.absent}
                    className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200"
                  />
                  <SummaryChip
                    label="Leave"
                    value={summary.leave}
                    className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  />
                  <SummaryChip
                    label="OD"
                    value={summary.od}
                    className="bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200"
                  />
                  {summary.other > 0 ? (
                    <SummaryChip
                      label="Other"
                      value={summary.other}
                      className="bg-muted text-muted-foreground"
                    />
                  ) : null}
                  <span className="ml-auto self-center text-xs text-muted-foreground">
                    {summary.total} students
                    {isLocked ? ' · Locked' : ''}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border/60 px-3 py-2">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search name or roll number..."
                      className="h-8 flex-1 bg-transparent text-sm outline-none"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      bulkSaveMut.mutate({
                        entries: students.map((student) => ({
                          studentId: student.id,
                          status: effectiveStatus(student),
                          remarks: effectiveRemarks(student) || undefined,
                        })),
                        lockAfterSave: true,
                      })
                    }
                    disabled={bulkSaveMut.isPending || isLocked}
                  >
                    {bulkSaveMut.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}
                    Save & Lock
                  </Button>
                </div>

                {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
              </div>

              <div className="max-h-[calc(100vh-14rem)] divide-y divide-border/60 overflow-y-auto">
                {rows.map((student, index) => (
                  <StudentAttendanceRow
                    key={student.id}
                    student={student}
                    index={index}
                    status={effectiveStatus(student)}
                    remarks={effectiveRemarks(student)}
                    saveState={saveStates[student.id] ?? 'idle'}
                    disabled={isLocked || bulkSaveMut.isPending}
                    onStatusChange={(status) =>
                      updateStudent(student.id, status, effectiveRemarks(student) || undefined)
                    }
                    onRemarksChange={(remarks) =>
                      updateRemarks(student.id, effectiveStatus(student), remarks)
                    }
                  />
                ))}
              </div>

              {!rows.length ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {students.length
                    ? 'No students match your search.'
                    : 'No students found for this class. Ensure Sem 3 Garo students are registered for this paper (e.g. GAR-200), or link a subject section on the timetable slot.'}
                </div>
              ) : null}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        className,
      )}
    >
      {label}
      <span className="tabular-nums">{value}</span>
    </span>
  );
}

function sessionDisplay(session: StudentAttendanceSession) {
  const title =
    session.displayTitle ??
    session.subjectGroup?.title ??
    session.course?.title ??
    'Attendance session';
  const groupCode = session.subjectGroup?.code ?? session.course?.code ?? 'Class';
  const paperCode = session.paperCourse?.code;
  return { title, groupCode, paperCode };
}

function SessionCard({
  session,
  active,
  onClick,
}: {
  session: StudentAttendanceSession;
  active: boolean;
  onClick: () => void;
}) {
  const label = sessionDisplay(session);
  const rosterSize = session.rosterSize ?? null;
  const markedCount = session.counts?.total ?? 0;
  const absentCount = session.counts?.absent ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-2xl border p-3 text-left transition',
        active
          ? 'border-primary bg-primary/10 shadow-sm'
          : 'border-border/60 bg-card hover:border-primary/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{label.title}</p>
          <p className="truncate text-[11px] font-medium text-primary">
            {label.paperCode ? `${label.paperCode} · ` : ''}
            Period {session.periodNo ?? '—'}
            {label.paperCode ? '' : ` · ${label.groupCode}`}
          </p>
          <p className="text-xs text-muted-foreground">
            Section {session.section?.sectionCode ?? '—'} · {session.sessionType}
            {session.location ? ` · ${session.location.roomCode ?? ''}` : ''}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
            session.status === 'LOCKED'
              ? 'bg-amber-100 text-amber-800'
              : session.status === 'MARKED'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-muted text-muted-foreground',
          )}
        >
          {session.status}
        </span>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock3 className="h-3 w-3" />
        {session.timetableLinked ? 'Timetable linked' : 'Legacy session'}
        {session.timetablePlanName ? ` · ${session.timetablePlanName}` : ''}
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Users className="h-3 w-3" />
        {rosterSize != null ? `${markedCount}/${rosterSize} marked` : `${markedCount} marked`}
        {absentCount > 0 ? ` · ${absentCount} absent` : ''}
      </p>
    </button>
  );
}

function StudentAttendanceRow({
  student,
  index,
  status,
  remarks,
  saveState,
  disabled,
  onStatusChange,
  onRemarksChange,
}: {
  student: StudentAttendanceRosterRow;
  index: number;
  status: string;
  remarks: string;
  saveState: SaveState;
  disabled: boolean;
  onStatusChange: (status: string) => void;
  onRemarksChange: (remarks: string) => void;
}) {
  const [remarkOpen, setRemarkOpen] = useState(Boolean(remarks));
  const extendedActive = isExtendedAttendanceStatus(status);
  const statusMeta = ATTENDANCE_STATUS_MAP[status as AttendanceStatusCode];
  const rollLabel =
    student.rollNumber ?? student.admissionNumber ?? student.enrollmentNumber ?? '—';

  return (
    <div
      className={cn(
        'px-3 py-2 transition-colors sm:px-4',
        index % 2 === 0 ? 'bg-card' : 'bg-muted/15',
        status === 'A' && 'bg-rose-50/50 dark:bg-rose-950/15',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <StudentAvatar name={student.fullName} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[13px] font-semibold leading-tight">{student.fullName}</p>
              <SaveIndicator state={saveState} />
            </div>
            {extendedActive && statusMeta ? (
              <p className="truncate text-[10px] font-medium text-primary">{statusMeta.label}</p>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">Roll: {rollLabel}</span>
      </div>

      <div className="mt-1.5 flex w-full justify-end overflow-x-auto pb-0.5">
        <AttendanceStatusButtonBar value={status} disabled={disabled} onChange={onStatusChange} />
      </div>

      <div className="mt-1 pl-10">
        {remarkOpen ? (
          <input
            value={remarks}
            disabled={disabled}
            onChange={(event) => onRemarksChange(event.target.value)}
            placeholder="Optional remark..."
            className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs outline-none focus:border-primary/50"
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setRemarkOpen(true)}
            className="text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
          >
            + Add remark
          </button>
        )}
      </div>
    </div>
  );
}

function StudentAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary"
      aria-hidden
    >
      {initials || '?'}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Saving
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
        <Save className="h-3 w-3" />
        Saved
      </span>
    );
  }
  return <span className="text-[10px] font-medium text-rose-600">Save failed</span>;
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
