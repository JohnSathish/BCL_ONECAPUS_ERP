'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Filter,
  Search,
  Trophy,
  UserX,
  Users,
} from 'lucide-react';
import { useExamHeaderAside } from '@/components/examinations/ia/ia-examination-shell';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { fetchIaAdmitSessions, fetchIaAnalytics } from '@/services/examinations-ia';
import { cn } from '@/utils/cn';

type Performer = {
  studentId: string;
  rollNumber?: string | null;
  fullName?: string | null;
  programme?: string | null;
  percentage: number;
};

type SubjectBar = {
  paperId: string;
  paperCode: string;
  paperName: string;
  average: number;
  students: number;
};

type Report = {
  passMark?: number;
  attendanceTarget?: number;
  totalStudents?: number;
  appeared?: number;
  absent?: number;
  notEntered?: number;
  subjects?: number;
  averageScore?: number | null;
  passPercent?: number | null;
  appearancePercent?: number | null;
  programmes?: Array<{ id: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  semesters?: number[];
  shifts?: Array<{ id: string; name: string }>;
  subjectPerformance?: SubjectBar[];
  programmeAverages?: Array<{ name: string; average: number; students: number }>;
  topPerformers?: Performer[];
  lowestPerformers?: Performer[];
  departmentPerformance?: Array<{
    name: string;
    students: number;
    average: number | null;
    passPercent: number | null;
  }>;
  insights?: {
    appearancePercent?: number | null;
    attendanceTarget?: number;
    highestSubject?: SubjectBar | null;
    subjectsBelow60?: number;
    absent?: number;
  };
};

type Filters = {
  sessionId: string;
  programmeCode: string;
  departmentId: string;
  semesterNo: string;
  shiftId: string;
};

const EMPTY: Filters = {
  sessionId: '',
  programmeCode: '',
  departmentId: '',
  semesterNo: '',
  shiftId: '',
};

const BAR_COLORS = [
  'bg-blue-500',
  'bg-teal-500',
  'bg-emerald-500',
  'bg-amber-400',
  'bg-orange-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-sky-500',
];

export function IaAnalyticsWorkspace() {
  const [yearId, setYearId] = useState('all');
  const yearTouched = useRef(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [ready, setReady] = useState(false);
  const [showDepartments, setShowDepartments] = useState(false);
  const [performerList, setPerformerList] = useState<'top' | 'low' | null>(null);

  const sessions = useQuery({ queryKey: ['ia', 'admit-sessions'], queryFn: fetchIaAdmitSessions });
  const sessionRows: Array<{
    id: string;
    name: string;
    status?: string;
    academicYearId?: string | null;
    academicYearName?: string | null;
  }> = sessions.data ?? [];

  const yearOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of sessionRows) {
      if (session.academicYearId)
        map.set(session.academicYearId, session.academicYearName || session.academicYearId);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [sessionRows]);

  useEffect(() => {
    if (yearTouched.current || yearId !== 'all' || !sessionRows.length) return;
    const preferred =
      sessionRows.find((session) => session.status === 'SCHEDULED') ?? sessionRows[0];
    if (preferred?.academicYearId) setYearId(preferred.academicYearId);
  }, [sessionRows, yearId]);

  useEffect(() => {
    if (sessions.isLoading || ready) return;
    const preferred =
      sessionRows.find((session) => session.status === 'SCHEDULED') ?? sessionRows[0];
    if (preferred) {
      setDraft((current) => ({ ...current, sessionId: preferred.id }));
      setApplied((current) => ({ ...current, sessionId: preferred.id }));
    }
    setReady(true);
  }, [sessions.isLoading, sessionRows, ready]);

  const yearSessions = sessionRows.filter(
    (session) =>
      yearId === 'all' || session.academicYearId === yearId || session.id === draft.sessionId,
  );

  const report = useQuery({
    queryKey: ['ia', 'analytics', applied],
    queryFn: () =>
      fetchIaAnalytics({
        sessionId: applied.sessionId || undefined,
        programmeCode: applied.programmeCode || undefined,
        departmentId: applied.departmentId || undefined,
        semesterNo: applied.semesterNo ? Number(applied.semesterNo) : undefined,
        shiftId: applied.shiftId || undefined,
      }),
    enabled: ready,
  });
  const data = report.data as Report | undefined;
  const total = data?.totalStudents ?? 0;
  const appeared = data?.appeared ?? 0;
  const absent = data?.absent ?? 0;
  const notEntered = data?.notEntered ?? 0;
  const appearance = data?.appearancePercent;
  const departments = data?.departmentPerformance ?? [];
  const visibleDepartments = showDepartments ? departments : departments.slice(0, 6);

  const setHeaderAside = useExamHeaderAside();
  const yearControl = useMemo(
    () => (
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
        <CalendarDays className="h-4 w-4 text-blue-600" />
        Academic Year
        <select
          value={yearId}
          onChange={(event) => {
            yearTouched.current = true;
            setYearId(event.target.value);
          }}
          className="bg-transparent text-sm font-semibold text-slate-800 outline-none"
        >
          <option value="all">All</option>
          {yearOptions.map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </select>
      </label>
    ),
    [yearId, yearOptions],
  );
  useLayoutEffect(() => {
    if (!setHeaderAside) return;
    setHeaderAside(yearControl);
    return () => setHeaderAside(null);
  }, [setHeaderAside, yearControl]);

  if (report.isError) {
    return (
      <QueryErrorPanel
        title="Unable to load analytics"
        error={report.error}
        onRetry={() => void report.refetch()}
        isRetrying={report.isFetching}
      />
    );
  }

  const highest = data?.insights?.highestSubject;
  const target = data?.attendanceTarget ?? 75;
  const below = data?.insights?.subjectsBelow60 ?? 0;

  return (
    <div className="space-y-4">
      {setHeaderAside ? null : <div className="flex justify-end">{yearControl}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Filter className="h-4 w-4 text-blue-600" /> Analytics Filters
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Select an examination, programme, department, semester, and shift.
        </p>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Field label="IA Examination">
            <select
              className={selectClass}
              value={draft.sessionId}
              onChange={(event) => setDraft({ ...draft, sessionId: event.target.value })}
            >
              <option value="">All examinations</option>
              {yearSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Programme / Stream">
            <select
              className={selectClass}
              value={draft.programmeCode}
              onChange={(event) => setDraft({ ...draft, programmeCode: event.target.value })}
            >
              <option value="">All Programmes</option>
              {(data?.programmes ?? []).map((programme) => (
                <option key={programme.id} value={programme.id}>
                  {programme.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select
              className={selectClass}
              value={draft.departmentId}
              onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })}
            >
              <option value="">All Departments</option>
              {(data?.departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Semester">
            <select
              className={selectClass}
              value={draft.semesterNo}
              onChange={(event) => setDraft({ ...draft, semesterNo: event.target.value })}
            >
              <option value="">All Semesters</option>
              {(data?.semesters ?? []).map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Shift">
            <select
              className={selectClass}
              value={draft.shiftId}
              onChange={(event) => setDraft({ ...draft, shiftId: event.target.value })}
            >
              <option value="">All Shifts</option>
              {(data?.shifts ?? []).map((shift) => (
                <option key={shift.id} value={shift.id}>
                  {shift.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setApplied(draft)}
              className="inline-flex h-10 w-full items-center justify-center gap-1 rounded-xl bg-blue-600 text-sm font-semibold text-white"
            >
              <Search className="h-4 w-4" /> Apply Filter
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat
          icon={<Users className="h-5 w-5" />}
          tone="blue"
          label="Total Students"
          value={total}
          hint="Registered for this selection"
        />
        <Stat
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="green"
          label="Students Appeared"
          value={appeared}
          hint={appearance != null ? `${appearance}% have marks` : 'No marks entered'}
        />
        <Stat
          icon={<UserX className="h-5 w-5" />}
          tone="rose"
          label="Students Absent"
          value={absent}
          hint={total ? `${round1((absent / total) * 100)}% marked absent` : 'Marked absent'}
        />
        <Stat
          icon={<BookOpen className="h-5 w-5" />}
          tone="sky"
          label="Total Subjects"
          value={data?.subjects ?? 0}
          hint="Scheduled papers"
        />
        <Stat
          icon={<BarChart3 className="h-5 w-5" />}
          tone="violet"
          label="Average IA Score"
          value={data?.averageScore ?? null}
          suffix="%"
          hint="Mean of students with marks"
        />
        <Stat
          icon={<Trophy className="h-5 w-5" />}
          tone="amber"
          label="Pass Percentage"
          value={data?.passPercent ?? null}
          suffix="%"
          hint={`At or above ${data?.passMark ?? 40}%`}
        />
      </section>

      {report.isLoading ? <p className="text-sm text-slate-500">Loading analytics…</p> : null}

      <section className="grid gap-3 xl:grid-cols-3">
        <Panel title="Attendance Overview" icon={<Users className="h-4 w-4 text-blue-600" />}>
          <div className="flex items-center gap-5">
            <Donut appeared={appeared} absent={absent} notEntered={notEntered} total={total} />
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Present{' '}
                {appeared.toLocaleString('en-IN')}
                {total ? ` (${round1((appeared / total) * 100)}%)` : ''}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Absent{' '}
                {absent.toLocaleString('en-IN')}
                {total ? ` (${round1((absent / total) * 100)}%)` : ''}
              </li>
              {notEntered ? (
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> Not entered{' '}
                  {notEntered.toLocaleString('en-IN')}
                </li>
              ) : null}
            </ul>
          </div>
        </Panel>

        <Panel
          title="Subject-wise Performance"
          icon={<BarChart3 className="h-4 w-4 text-blue-600" />}
          extra={<span className="text-[11px] text-slate-400">Top subjects</span>}
        >
          {(data?.subjectPerformance ?? []).length ? (
            <ul className="space-y-2">
              {data?.subjectPerformance?.map((subject) => (
                <li
                  key={subject.paperId}
                  className="grid grid-cols-[88px_1fr_36px] items-center gap-2 text-xs"
                >
                  <span className="truncate font-medium text-slate-700" title={subject.paperName}>
                    {subject.paperCode}
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={cn('block h-2 rounded-full', barTone(subject.average))}
                      style={{ width: `${Math.min(subject.average, 100)}%` }}
                    />
                  </span>
                  <span className="text-right font-semibold text-slate-700">
                    {subject.average.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-sm text-slate-500">No subject scores for this selection.</p>
          )}
        </Panel>

        <Panel
          title="Programme-wise Average IA"
          icon={<BarChart3 className="h-4 w-4 text-blue-600" />}
        >
          {(data?.programmeAverages ?? []).length ? (
            <div className="flex h-44 items-end gap-2">
              {data?.programmeAverages?.map((programme, index) => (
                <div
                  key={programme.name}
                  className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className="text-[11px] font-semibold text-slate-700">
                    {programme.average.toFixed(0)}
                  </span>
                  <div className="flex h-32 w-full items-end justify-center">
                    <div
                      className={cn('w-8 rounded-t-md', BAR_COLORS[index % BAR_COLORS.length])}
                      style={{ height: `${Math.max(programme.average, 4)}%` }}
                      title={programme.name}
                    />
                  </div>
                  <p
                    className="w-full truncate text-center text-[10px] text-slate-500"
                    title={programme.name}
                  >
                    {programme.name}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-sm text-slate-500">No programme scores for this selection.</p>
          )}
        </Panel>
      </section>

      <section className="grid gap-3 xl:grid-cols-3">
        <PerformerTable
          title="Top Performers"
          rows={(data?.topPerformers ?? []).slice(0, 5)}
          onViewAll={() => setPerformerList('top')}
        />
        <PerformerTable
          title="Lowest Performers"
          rows={(data?.lowestPerformers ?? []).slice(0, 5)}
          tone="low"
          onViewAll={() => setPerformerList('low')}
        />
        <Panel
          title="Department-wise Performance"
          icon={<BookOpen className="h-4 w-4 text-blue-600" />}
          extra={
            departments.length > 6 ? (
              <button
                type="button"
                className="text-xs font-medium text-blue-600"
                onClick={() => setShowDepartments((value) => !value)}
              >
                {showDepartments ? 'Show less' : 'View all'}
              </button>
            ) : null
          }
        >
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="py-1 pr-2">#</th>
                <th className="py-1 pr-2">Department</th>
                <th className="py-1 pr-2">Students</th>
                <th className="py-1 pr-2">Avg IA %</th>
                <th className="py-1">Pass %</th>
              </tr>
            </thead>
            <tbody>
              {visibleDepartments.map((row, index) => (
                <tr key={row.name} className="border-t border-slate-100">
                  <td className="py-1.5 pr-2 text-slate-400">{index + 1}</td>
                  <td className="py-1.5 pr-2 text-slate-800">{row.name}</td>
                  <td className="py-1.5 pr-2">{row.students.toLocaleString('en-IN')}</td>
                  <td className="py-1.5 pr-2">
                    {row.average != null ? row.average.toFixed(1) : '—'}
                  </td>
                  <td className="py-1.5">
                    {row.passPercent != null ? row.passPercent.toFixed(1) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!visibleDepartments.length ? (
            <p className="py-6 text-sm text-slate-500">No departments in this selection.</p>
          ) : null}
        </Panel>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Insight
          tone="green"
          icon={<CheckCircle2 className="h-4 w-4" />}
          title={appearance != null && appearance >= target ? 'Good Appearance' : 'Appearance'}
        >
          {appearance != null
            ? `${appearance}% of registered students have marks entered${appearance >= target ? `, above the ${target}% mark` : `, below the ${target}% mark`}.`
            : 'No registered students in this selection.'}
        </Insight>
        <Insight
          tone="blue"
          icon={<BarChart3 className="h-4 w-4" />}
          title="Highest Performing Subject"
        >
          {highest
            ? `${highest.paperCode} (${highest.paperName}) averages ${highest.average.toFixed(1)}%.`
            : 'No subject scores yet.'}
        </Insight>
        <Insight tone="rose" icon={<AlertTriangle className="h-4 w-4" />} title="Needs Attention">
          {below
            ? `${below} subject${below === 1 ? '' : 's'} average below 60%.`
            : 'No subject with marks averages below 60%.'}
        </Insight>
        <Insight tone="amber" icon={<Users className="h-4 w-4" />} title="Students at Risk">
          {absent
            ? `${absent.toLocaleString('en-IN')} student${absent === 1 ? '' : 's'} marked absent.`
            : 'No students are marked absent.'}
        </Insight>
      </section>

      {performerList ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setPerformerList(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {performerList === 'top' ? 'Top performers' : 'Lowest performers'}
              </h3>
              <button
                type="button"
                className="text-xs text-slate-500"
                onClick={() => setPerformerList(null)}
              >
                Close
              </button>
            </div>
            <PerformerRows
              rows={
                performerList === 'top'
                  ? (data?.topPerformers ?? [])
                  : (data?.lowestPerformers ?? [])
              }
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

const selectClass =
  'mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      {children}
    </label>
  );
}

function Stat({
  icon,
  tone,
  label,
  value,
  hint,
  suffix,
}: {
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'rose' | 'sky' | 'violet' | 'amber';
  label: string;
  value: number | null;
  hint: string;
  suffix?: string;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-500',
    sky: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
  };
  return (
    <article className={cn('rounded-2xl border border-white p-3 shadow-sm', tones[tone])}>
      <div className="flex items-center gap-2">
        <span className="rounded-xl bg-white/80 p-2">{icon}</span>
        <div>
          <p className="text-[11px] text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">
            {value == null ? '—' : `${value.toLocaleString('en-IN')}${suffix ?? ''}`}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">{hint}</p>
    </article>
  );
}

function Panel({
  title,
  icon,
  extra,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          {icon}
          {title}
        </h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Donut({
  appeared,
  absent,
  notEntered,
  total,
}: {
  appeared: number;
  absent: number;
  notEntered: number;
  total: number;
}) {
  const appearedDeg = total ? (appeared / total) * 360 : 0;
  const absentDeg = total ? (absent / total) * 360 : 0;
  return (
    <div
      className="relative h-36 w-36 shrink-0 rounded-full"
      style={{
        background: total
          ? `conic-gradient(#22c55e 0deg ${appearedDeg}deg, #f43f5e ${appearedDeg}deg ${appearedDeg + absentDeg}deg, #cbd5e1 ${appearedDeg + absentDeg}deg 360deg)`
          : '#e2e8f0',
      }}
    >
      <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white text-center">
        <p className="text-lg font-bold text-slate-900">{total.toLocaleString('en-IN')}</p>
        <p className="text-[10px] text-slate-400">Total Students</p>
      </div>
    </div>
  );
}

function PerformerTable({
  title,
  rows,
  tone,
  onViewAll,
}: {
  title: string;
  rows: Performer[];
  tone?: 'low';
  onViewAll: () => void;
}) {
  return (
    <Panel
      title={title}
      icon={
        tone === 'low' ? (
          <AlertTriangle className="h-4 w-4 text-rose-500" />
        ) : (
          <Trophy className="h-4 w-4 text-blue-600" />
        )
      }
      extra={
        <button type="button" className="text-xs font-medium text-blue-600" onClick={onViewAll}>
          View all
        </button>
      }
    >
      <PerformerRows rows={rows} />
    </Panel>
  );
}

function PerformerRows({ rows }: { rows: Performer[] }) {
  if (!rows.length)
    return <p className="py-6 text-sm text-slate-500">No scored students in this selection.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-[11px] uppercase tracking-wide text-slate-400">
        <tr>
          <th className="py-1 pr-2">#</th>
          <th className="py-1 pr-2">Roll No</th>
          <th className="py-1 pr-2">Name</th>
          <th className="py-1 pr-2">Programme</th>
          <th className="py-1">IA %</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.studentId} className="border-t border-slate-100">
            <td className="py-1.5 pr-2 text-slate-400">{index + 1}</td>
            <td className="py-1.5 pr-2 font-medium">{row.rollNumber || '—'}</td>
            <td className="py-1.5 pr-2">{row.fullName || '—'}</td>
            <td className="py-1.5 pr-2 text-slate-600">{row.programme || '—'}</td>
            <td
              className={cn(
                'py-1.5 font-semibold',
                row.percentage >= 60
                  ? 'text-emerald-600'
                  : row.percentage >= 40
                    ? 'text-amber-600'
                    : 'text-rose-600',
              )}
            >
              {row.percentage.toFixed(0)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Insight({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'green' | 'blue' | 'rose' | 'amber';
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700',
    blue: 'bg-blue-50 text-blue-700',
    rose: 'bg-rose-50 text-rose-600',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <article className={cn('rounded-2xl p-4 text-sm shadow-sm', tones[tone])}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      <p className="mt-1 text-xs opacity-80">{children}</p>
    </article>
  );
}

function barTone(average: number) {
  if (average >= 75) return 'bg-emerald-500';
  if (average >= 60) return 'bg-lime-500';
  if (average >= 40) return 'bg-amber-400';
  return 'bg-rose-500';
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
