'use client';

import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Loader2, Lock, RotateCcw, Search, UserX } from 'lucide-react';

import { compareAttendanceRoll } from '@/components/student-attendance/attendance-roll-order';
import { AttendanceStatusButtonBar } from '@/components/student-attendance/attendance-status-buttons';
import {
  ATTENDANCE_STATUS_MAP,
  type AttendanceSummaryCounts,
} from '@/components/student-attendance/attendance-status-config';
import { Button } from '@/components/ui/button';
import type {
  StudentAttendanceRosterRow,
  StudentAttendanceSession,
} from '@/services/student-attendance';
import { cn } from '@/utils/cn';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const STATUS_FILTERS = [
  { value: 'all', label: 'All Students' },
  { value: 'P', label: 'Present' },
  { value: 'A', label: 'Absent' },
  { value: 'L', label: 'Leave' },
  { value: 'OD', label: 'Official Duty' },
  { value: 'other', label: 'Other' },
] as const;

export function OfficeAttendanceRegister({
  session,
  students,
  summary,
  isLocked,
  saving,
  message,
  modeBanner,
  lastSavedAt,
  effectiveStatus,
  effectiveRemarks,
  saveStateFor,
  onStatusChange,
  onRemarksChange,
  onMarkAllPresent,
  onMarkAllAbsent,
  onReset,
  onLock,
}: {
  session: StudentAttendanceSession;
  students: StudentAttendanceRosterRow[];
  summary: AttendanceSummaryCounts;
  isLocked: boolean;
  saving: boolean;
  message: string;
  modeBanner: string | null;
  lastSavedAt: Date | null;
  effectiveStatus: (student: StudentAttendanceRosterRow) => string;
  effectiveRemarks: (student: StudentAttendanceRosterRow) => string;
  saveStateFor: (studentId: string) => SaveState;
  onStatusChange: (studentId: string, status: string) => void;
  onRemarksChange: (studentId: string, remarks: string) => void;
  onMarkAllPresent: () => void;
  onMarkAllAbsent: () => void;
  onReset: () => void;
  onLock: () => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const title =
    session.displayTitle ?? session.subjectGroup?.title ?? session.course?.title ?? 'Class';
  const timeLabel = [formatClock(session.startTime), formatClock(session.endTime)]
    .filter(Boolean)
    .join(' – ');
  const periodLabel = [
    session.semesterNo ? `Semester ${session.semesterNo}` : null,
    session.periodNo ? `Period ${session.periodNo}` : null,
    session.sessionType ? titleCase(session.sessionType) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const marked = summary.total - summary.unmarked;
  const completion = summary.total ? Math.round((marked / summary.total) * 100) : 0;

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return students
      .filter((student) => {
        const status = effectiveStatus(student);
        const group = ATTENDANCE_STATUS_MAP[status as keyof typeof ATTENDANCE_STATUS_MAP]?.group;
        if (statusFilter === 'other') {
          if (group !== 'other') return false;
        } else if (statusFilter === 'L') {
          if (group !== 'leave') return false;
        } else if (statusFilter === 'OD') {
          if (group !== 'od') return false;
        } else if (statusFilter !== 'all' && status !== statusFilter) {
          return false;
        }
        if (!needle) return true;
        return [
          student.fullName,
          student.rollNumber,
          student.enrollmentNumber,
          student.admissionNumber,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle));
      })
      .sort(compareAttendanceRoll);
  }, [effectiveStatus, search, statusFilter, students]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">{title}</h2>
              <p className="text-sm text-muted-foreground">
                {[session.department?.name, periodLabel].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-muted-foreground">
                {[
                  session.faculty?.fullName ? `Faculty: ${session.faculty.fullName}` : null,
                  timeLabel || null,
                  session.section?.sectionCode ? `Section ${session.section.sectionCode}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {modeBanner ? (
                <p className="mt-1 text-xs text-muted-foreground">{modeBanner}</p>
              ) : null}
            </div>
          </div>
          <p className="text-sm font-medium text-muted-foreground">{summary.total} Students</p>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Present" value={summary.present} total={summary.total} tone="emerald" />
        <StatCard label="Absent" value={summary.absent} total={summary.total} tone="rose" />
        <StatCard label="Leave" value={summary.leave} total={summary.total} tone="amber" />
        <StatCard label="Official Duty" value={summary.od} total={summary.total} tone="sky" />
        <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <p className="text-sm font-medium">Attendance completion</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {marked} / {summary.total} marked
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${completion}%` }}
            />
          </div>
          <p className="mt-1 text-right text-xs font-semibold text-emerald-700">{completion}%</p>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
          <Button type="button" size="sm" onClick={onMarkAllPresent} disabled={saving || isLocked}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Mark All Present
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onMarkAllAbsent}
            disabled={saving || isLocked}
          >
            <UserX className="mr-2 h-4 w-4" />
            Mark All Absent
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onReset} disabled={saving}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-border/70 px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or roll number..."
              className="h-9 w-full bg-transparent text-sm outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Roll Number</th>
                <th className="px-3 py-2 font-medium">Student Name</th>
                <th className="px-3 py-2 font-medium">Attendance Status</th>
                <th className="px-3 py-2 font-medium">Remark</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((student, index) => {
                const status = effectiveStatus(student);
                const saveState = saveStateFor(student.id);
                return (
                  <tr key={student.id} className="border-t border-border/60">
                    <td className="px-3 py-2 text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-2 font-medium">
                      {student.rollNumber ??
                        student.admissionNumber ??
                        student.enrollmentNumber ??
                        '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span>{student.fullName}</span>
                        <SaveDot state={saveState} />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <AttendanceStatusButtonBar
                        value={status}
                        disabled={isLocked || saving}
                        onChange={(next) => onStatusChange(student.id, next)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={effectiveRemarks(student)}
                        disabled={isLocked || saving}
                        onChange={(event) => onRemarksChange(student.id, event.target.value)}
                        placeholder="Add remark..."
                        className="h-8 w-full min-w-36 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary/50"
                      />
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">
                    {students.length
                      ? 'No students match this search.'
                      : 'No students are registered for this class.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-3 py-3">
          <p className="text-xs text-muted-foreground">
            {summary.total} students · {marked} marked · {summary.unmarked} unmarked
            {isLocked ? ' · Locked' : ''}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {lastSavedAt
                ? `Last saved ${lastSavedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                : 'Changes save automatically'}
            </p>
            {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
            <Button
              type="button"
              size="sm"
              onClick={onLock}
              disabled={saving || isLocked || !students.length}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              Lock Attendance
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: 'emerald' | 'rose' | 'amber' | 'sky';
}) {
  const toneClass = {
    emerald:
      'bg-emerald-50 text-emerald-800 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900',
    rose: 'bg-rose-50 text-rose-800 border-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900',
    amber:
      'bg-amber-50 text-amber-900 border-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900',
    sky: 'bg-sky-50 text-sky-900 border-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900',
  }[tone];
  const share = total ? `${((value / total) * 100).toFixed(1)}%` : '0%';
  return (
    <section className={cn('rounded-2xl border p-4 shadow-sm', toneClass)}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs opacity-80">{share}</p>
    </section>
  );
}

function SaveDot({ state }: { state: SaveState }) {
  if (state === 'saving') return <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />;
  if (state === 'saved')
    return <span className="text-[10px] font-medium text-emerald-600">Saved</span>;
  if (state === 'error')
    return <span className="text-[10px] font-medium text-rose-600">Failed</span>;
  return null;
}

function formatClock(value?: string | null) {
  if (!value) return '';
  const match = value.match(/(\d{2}):(\d{2})/);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

function titleCase(value: string) {
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
