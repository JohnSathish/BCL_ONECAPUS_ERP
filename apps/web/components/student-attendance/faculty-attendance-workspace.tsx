'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock3, Loader2, Save, Search, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  fetchFacultyTodayAttendance,
  fetchStudentAttendanceRoster,
  markStudentAttendance,
  type StudentAttendanceRosterRow,
  type StudentAttendanceSession,
} from '@/services/student-attendance';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const STATUS_OPTIONS = ['P', 'A', 'L', 'OD', 'ML', 'SPORTS', 'NSS', 'NCC', 'EXEMPTED'];

export function FacultyAttendanceWorkspace() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get('section');
  const sessionParam = searchParams.get('sessionId');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Record<string, { status: string; remarks?: string }>>({});
  const [message, setMessage] = useState('');

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

  const rows = useMemo(() => {
    const source = roster.data?.students ?? [];
    const needle = search.trim().toLowerCase();
    return source.filter((student) => {
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
  }, [roster.data, search]);

  const saveMut = useMutation({
    mutationFn: async ({ lockAfterSave }: { lockAfterSave: boolean }) => {
      if (!selected || !roster.data) return null;
      const entries = roster.data.students.map((student) => ({
        studentId: student.id,
        status: draft[student.id]?.status ?? student.status ?? 'P',
        remarks: draft[student.id]?.remarks ?? student.remarks,
      }));
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

  const markAllPresent = () => {
    const next: Record<string, { status: string; remarks?: string }> = {};
    (roster.data?.students ?? []).forEach((student) => {
      next[student.id] = { status: 'P', remarks: draft[student.id]?.remarks };
    });
    setDraft(next);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Student Attendance
            </p>
            <h1 className="mt-1 text-2xl font-bold">Today’s Classes</h1>
            <p className="text-sm text-muted-foreground">
              Open a scheduled class, mark all present, then change only absentees or special
              statuses.
            </p>
          </div>
          <Button onClick={() => sessions.refetch()} variant="outline" size="sm">
            Refresh
          </Button>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-2">
          {sessions.isLoading ? <LoadingCard label="Loading today’s timetable..." /> : null}
          {(sessions.data ?? []).map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              active={selected === session.id}
              onClick={() => {
                setSelectedId(session.id);
                setDraft({});
                setMessage('');
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

        <main className="min-w-0 rounded-3xl border border-border/60 bg-card p-4 shadow-sm">
          {!selected ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Select a class to begin.
            </div>
          ) : roster.isLoading ? (
            <LoadingCard label="Loading class roster..." />
          ) : roster.data ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {roster.data.session.course?.code} · {roster.data.session.course?.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Section {roster.data.session.section?.sectionCode ?? '—'} · Period{' '}
                    {roster.data.session.periodNo ?? '—'} · {roster.data.session.sessionType}
                    {roster.data.session.location
                      ? ` · ${roster.data.session.location.roomCode ?? ''} ${roster.data.session.location.roomName ?? ''}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={markAllPresent}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Quick Present
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveMut.mutate({ lockAfterSave: false })}
                    disabled={saveMut.isPending}
                  >
                    {saveMut.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Attendance
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => saveMut.mutate({ lockAfterSave: true })}
                    disabled={saveMut.isPending}
                  >
                    Save & Lock
                  </Button>
                </div>
              </div>
              {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search roll number, admission number, or name..."
                  className="h-8 flex-1 bg-transparent text-sm outline-none"
                />
              </div>
              <div className="mt-4 max-h-[620px] overflow-auto rounded-2xl border border-border/60">
                {rows.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    value={draft[student.id]?.status ?? student.status ?? 'P'}
                    remarks={draft[student.id]?.remarks ?? student.remarks ?? ''}
                    onChange={(status, remarks) =>
                      setDraft((prev) => ({ ...prev, [student.id]: { status, remarks } }))
                    }
                  />
                ))}
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
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
          <p className="truncate text-sm font-semibold">
            {session.course?.code ?? 'Class'} · {session.course?.title ?? 'Attendance'}
          </p>
          <p className="text-xs text-muted-foreground">
            Section {session.section?.sectionCode ?? '—'} · {session.sessionType}
            {session.location ? ` · ${session.location.roomCode ?? ''}` : ''}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px]">{session.status}</span>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock3 className="h-3 w-3" />
        Period {session.periodNo ?? '—'}
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Users className="h-3 w-3" />
        {session.counts?.total ?? 0} marked · {session.counts?.absent ?? 0} absent
      </p>
    </button>
  );
}

function StudentRow({
  student,
  value,
  remarks,
  onChange,
}: {
  student: StudentAttendanceRosterRow;
  value: string;
  remarks: string;
  onChange: (status: string, remarks?: string) => void;
}) {
  return (
    <div className="grid gap-2 border-b border-border/60 px-3 py-2 last:border-0 md:grid-cols-[1fr_220px_220px] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{student.fullName}</p>
        <p className="text-[11px] text-muted-foreground">
          Roll {student.rollNumber ?? '—'} · Adm{' '}
          {student.admissionNumber ?? student.enrollmentNumber ?? '—'}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status, remarks)}
            className={cn(
              'rounded-full border px-2 py-1 text-[11px] font-semibold',
              value === status
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-muted-foreground',
            )}
          >
            {status}
          </button>
        ))}
      </div>
      <input
        value={remarks}
        onChange={(event) => onChange(value, event.target.value)}
        placeholder="Remarks"
        className="h-9 rounded-lg border border-border bg-background px-2 text-xs outline-none"
      />
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
