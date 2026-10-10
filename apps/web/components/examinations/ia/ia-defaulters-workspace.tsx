'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  Filter,
  IndianRupee,
  Mail,
  Printer,
  RotateCcw,
  Search,
  Send,
  Users,
  X,
} from 'lucide-react';
import { useExamHeaderAside } from '@/components/examinations/ia/ia-examination-shell';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { fetchIaAdmitSessions, fetchIaDefaulters } from '@/services/examinations-ia';
import { cn } from '@/utils/cn';

type Issue = 'academic' | 'attendance' | 'fee' | 'library';

type DefaulterRow = {
  studentId: string;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
  fullName?: string | null;
  email?: string | null;
  programme?: string | null;
  programmeCode?: string | null;
  department?: string | null;
  departmentId?: string | null;
  semesterNo?: number | null;
  iaPercent?: number | null;
  attendancePercent?: number | null;
  feeStatus?: 'PAID' | 'PENDING';
  feeDue?: number;
  libraryStatus?: 'CLEAR' | 'PENDING';
  libraryIssues?: number;
  issues: Issue[];
  reasons: string[];
  totalIssues: number;
};

type Report = {
  minAttendancePercent?: number;
  iaPassMarkPercent?: number;
  totalStudents?: number;
  total?: number;
  attendanceDefaulters?: number;
  feeDefaulters?: number;
  libraryDefaulters?: number;
  academicDefaulters?: number;
  multipleIssues?: number;
  cleared?: number;
  programmes?: Array<{ code: string; name: string }>;
  departments?: Array<{ id: string; name: string }>;
  semesters?: number[];
  items?: DefaulterRow[];
};

type AdmitSession = {
  id: string;
  name: string;
  status?: string;
  academicYearId?: string | null;
  academicYearName?: string | null;
};

type Filters = {
  sessionId: string;
  programmeCode: string;
  departmentId: string;
  semesterNo: string;
  issue: 'all' | Issue | 'multiple';
  status: 'all' | 'defaulter' | 'cleared';
};

const EMPTY_FILTERS: Filters = {
  sessionId: '',
  programmeCode: '',
  departmentId: '',
  semesterNo: '',
  issue: 'all',
  status: 'all',
};

export function IaDefaultersWorkspace() {
  const [yearId, setYearId] = useState('all');
  const yearTouched = useRef(false);
  const [draft, setDraft] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [active, setActive] = useState<DefaulterRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sessions = useQuery({ queryKey: ['ia', 'admit-sessions'], queryFn: fetchIaAdmitSessions });
  const sessionRows: AdmitSession[] = sessions.data ?? [];
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

  const yearSessions = sessionRows.filter(
    (session) => yearId === 'all' || session.academicYearId === yearId,
  );

  const report = useQuery({
    queryKey: [
      'ia',
      'defaulters',
      applied.sessionId,
      applied.programmeCode,
      applied.departmentId,
      applied.semesterNo,
    ],
    queryFn: () =>
      fetchIaDefaulters({
        sessionId: applied.sessionId || undefined,
        programmeCode: applied.programmeCode || undefined,
        departmentId: applied.departmentId || undefined,
        semesterNo: applied.semesterNo ? Number(applied.semesterNo) : undefined,
      }),
  });
  const data = report.data as Report | undefined;
  const items = data?.items ?? [];
  const minAttendance = data?.minAttendancePercent ?? 75;
  const passMark = data?.iaPassMarkPercent ?? 40;

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((row) => {
      if (applied.issue === 'multiple' && row.issues.length < 2) return false;
      if (
        applied.issue !== 'all' &&
        applied.issue !== 'multiple' &&
        !row.issues.includes(applied.issue)
      )
        return false;
      if (applied.status === 'cleared') return false;
      if (!query) return true;
      return (
        (row.rollNumber ?? '').toLowerCase().includes(query) ||
        (row.fullName ?? '').toLowerCase().includes(query) ||
        (row.enrollmentNumber ?? '').toLowerCase().includes(query)
      );
    });
  }, [items, search, applied.issue, applied.status]);

  useEffect(() => {
    setPage(1);
  }, [applied, search, pageSize]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize) || 1);
  const safePage = Math.min(page, pageCount);
  const pageRows = visible.slice((safePage - 1) * pageSize, safePage * pageSize);

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

  const applyIssue = (issue: Filters['issue']) => {
    const next = { ...applied, issue };
    setDraft(next);
    setApplied(next);
  };

  const notify = (rows: DefaulterRow[]) => {
    const emails = [
      ...new Set(rows.map((row) => row.email).filter((email): email is string => Boolean(email))),
    ];
    if (!emails.length) {
      setNotice('None of these students have an email address on record.');
      return;
    }
    const batch = emails.slice(0, 30);
    const subject = encodeURIComponent('Internal assessment — pending issues');
    const body = encodeURIComponent(
      'Please clear the pending examination, attendance, fee, or library issues recorded against your name.',
    );
    window.location.href = `mailto:?bcc=${encodeURIComponent(batch.join(','))}&subject=${subject}&body=${body}`;
    setNotice(
      emails.length > 30
        ? `Opened a message for the first 30 of ${emails.length} students. Narrow the list to reach the rest.`
        : `Opened a message for ${emails.length} student${emails.length === 1 ? '' : 's'}.`,
    );
  };

  if (report.isError) {
    return (
      <QueryErrorPanel
        title="Unable to load defaulters"
        error={report.error}
        onRetry={() => void report.refetch()}
        isRetrying={report.isFetching}
      />
    );
  }

  return (
    <div className="space-y-4">
      {setHeaderAside ? null : <div className="flex justify-end">{yearControl}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat
          icon={<Users className="h-5 w-5" />}
          tone="rose"
          label="Total Students"
          value={data?.totalStudents ?? 0}
          hint="In this selection"
        />
        <Stat
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="amber"
          label="Total Defaulters"
          value={data?.total ?? 0}
          hint="At least one open issue"
        />
        <Stat
          icon={<CalendarDays className="h-5 w-5" />}
          tone="yellow"
          label="Attendance Defaulters"
          value={data?.attendanceDefaulters ?? 0}
          hint={`Below ${minAttendance}%`}
        />
        <Stat
          icon={<IndianRupee className="h-5 w-5" />}
          tone="sky"
          label="Fee Defaulters"
          value={data?.feeDefaulters ?? 0}
          hint="Pending fee payment"
        />
        <Stat
          icon={<BookOpen className="h-5 w-5" />}
          tone="violet"
          label="Library Defaulters"
          value={data?.libraryDefaulters ?? 0}
          hint="Overdue books or fines"
        />
        <Stat
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="green"
          label="Cleared"
          value={data?.cleared ?? 0}
          hint="No pending issues"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Filter className="h-4 w-4 text-blue-600" /> Filter Defaulters
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Students below the IA pass mark, below the attendance limit, or with fee or library dues.
        </p>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Field label="IA Examination">
            <select
              value={draft.sessionId}
              onChange={(event) => setDraft({ ...draft, sessionId: event.target.value })}
              className={selectClass}
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
              value={draft.programmeCode}
              onChange={(event) => setDraft({ ...draft, programmeCode: event.target.value })}
              className={selectClass}
            >
              <option value="">All Programmes</option>
              {(data?.programmes ?? []).map((programme) => (
                <option key={programme.code} value={programme.code}>
                  {programme.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select
              value={draft.departmentId}
              onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })}
              className={selectClass}
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
              value={draft.semesterNo}
              onChange={(event) => setDraft({ ...draft, semesterNo: event.target.value })}
              className={selectClass}
            >
              <option value="">All Semesters</option>
              {(data?.semesters ?? []).map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Defaulter Type">
            <select
              value={draft.issue}
              onChange={(event) =>
                setDraft({ ...draft, issue: event.target.value as Filters['issue'] })
              }
              className={selectClass}
            >
              <option value="all">All Types</option>
              <option value="academic">Academic / IA</option>
              <option value="attendance">Attendance</option>
              <option value="fee">Fees</option>
              <option value="library">Library</option>
              <option value="multiple">Multiple Issues</option>
            </select>
          </Field>
          <Field label="Status">
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft({ ...draft, status: event.target.value as Filters['status'] })
              }
              className={selectClass}
            >
              <option value="all">All Status</option>
              <option value="defaulter">Defaulter</option>
              <option value="cleared">Cleared</option>
            </select>
          </Field>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setApplied(draft)}
            className="inline-flex h-10 items-center gap-1 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
          >
            <Search className="h-4 w-4" /> Apply Filter
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              setApplied(EMPTY_FILTERS);
              setSearch('');
            }}
            className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-4 text-sm text-slate-600"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Chip
              active={applied.issue === 'all'}
              onClick={() => applyIssue('all')}
              className="bg-blue-50 text-blue-700"
            >
              All Defaulters ({data?.total ?? 0})
            </Chip>
            <Chip
              active={applied.issue === 'attendance'}
              onClick={() => applyIssue('attendance')}
              className="bg-amber-50 text-amber-700"
            >
              Attendance ({data?.attendanceDefaulters ?? 0})
            </Chip>
            <Chip
              active={applied.issue === 'fee'}
              onClick={() => applyIssue('fee')}
              className="bg-rose-50 text-rose-600"
            >
              Fees ({data?.feeDefaulters ?? 0})
            </Chip>
            <Chip
              active={applied.issue === 'library'}
              onClick={() => applyIssue('library')}
              className="bg-violet-50 text-violet-700"
            >
              Library ({data?.libraryDefaulters ?? 0})
            </Chip>
            <Chip
              active={applied.issue === 'multiple'}
              onClick={() => applyIssue('multiple')}
              className="bg-orange-50 text-orange-700"
            >
              Multiple Issues ({data?.multipleIssues ?? 0})
            </Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => notify(visible)}
              className="inline-flex h-9 items-center gap-1 rounded-xl bg-blue-600 px-3 text-xs font-semibold text-white"
            >
              <Send className="h-3.5 w-3.5" /> Send Notification
            </button>
            <button
              type="button"
              onClick={() => exportCsv(visible)}
              className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-50 px-3 text-xs font-semibold text-emerald-700"
            >
              <Download className="h-3.5 w-3.5" /> Export to Excel
            </button>
            <button
              type="button"
              onClick={() => printRows(visible)}
              className="inline-flex h-9 items-center gap-1 rounded-xl bg-slate-50 px-3 text-xs font-semibold text-slate-700"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          </div>
        </div>
        {notice ? <p className="mt-2 text-xs text-slate-500">{notice}</p> : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Defaulter List</h2>
            <p className="text-xs text-slate-500">
              Students with an open academic, attendance, fee, or library issue.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by roll number, name or registration no…"
                className="w-56 bg-transparent outline-none"
              />
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-500">
              Rows per page
              <select
                value={pageSize}
                onChange={(event) => setPageSize(Number(event.target.value))}
                className="rounded-lg border border-slate-200 px-2 py-1"
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          {report.isLoading ? (
            <p className="py-8 text-sm text-slate-500">Loading defaulters…</p>
          ) : (
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                <tr className="border-b border-slate-100">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-3">Roll Number</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Programme</th>
                  <th className="py-2 pr-3">Department</th>
                  <th className="py-2 pr-3">Sem</th>
                  <th className="py-2 pr-3">IA %</th>
                  <th className="py-2 pr-3">Attendance</th>
                  <th className="py-2 pr-3">Fee Status</th>
                  <th className="py-2 pr-3">Library Status</th>
                  <th className="py-2 pr-3">Total Issues</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, index) => (
                  <tr key={row.studentId} className="border-b border-slate-100">
                    <td className="py-2 pr-2 text-slate-400">
                      {(safePage - 1) * pageSize + index + 1}
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-800">
                      {row.rollNumber || '—'}
                    </td>
                    <td className="py-2 pr-3 text-slate-800">{row.fullName || '—'}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.programme || '—'}</td>
                    <td className="py-2 pr-3 text-slate-600">{row.department || '—'}</td>
                    <td className="py-2 pr-3">{row.semesterNo ?? '—'}</td>
                    <td className="py-2 pr-3">
                      <Percent
                        value={row.iaPercent}
                        bad={row.iaPercent != null && row.iaPercent < passMark}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Percent
                        value={row.attendancePercent}
                        bad={row.attendancePercent != null && row.attendancePercent < minAttendance}
                        warn={
                          row.attendancePercent != null &&
                          row.attendancePercent >= minAttendance &&
                          row.attendancePercent < minAttendance + 10
                        }
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <Pill tone={row.feeStatus === 'PENDING' ? 'rose' : 'green'}>
                        {row.feeStatus === 'PENDING' ? 'Pending' : 'Paid'}
                      </Pill>
                    </td>
                    <td className="py-2 pr-3">
                      <Pill tone={row.libraryStatus === 'PENDING' ? 'amber' : 'green'}>
                        {row.libraryStatus === 'PENDING' ? 'Pending' : 'Clear'}
                      </Pill>
                    </td>
                    <td className="py-2 pr-3 font-semibold text-slate-700">{row.totalIssues}</td>
                    <td className="py-2 pr-3">
                      <Pill tone="rose">Defaulter</Pill>
                    </td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"
                          onClick={() => setActive(row)}
                          aria-label="View issues"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"
                          onClick={() => notify([row])}
                          aria-label="Email student"
                        >
                          <Mail className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!report.isLoading && !pageRows.length ? (
            <p className="py-8 text-center text-sm text-slate-500">
              {applied.status === 'cleared'
                ? `${data?.cleared ?? 0} students have no pending issues. Cleared students are counted above and are not listed here.`
                : 'No defaulters match these filters.'}
            </p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            Showing {visible.length ? (safePage - 1) * pageSize + 1 : 0} to{' '}
            {Math.min(safePage * pageSize, visible.length)} of {visible.length} students
          </p>
          <Pager page={safePage} pageCount={pageCount} onPage={setPage} />
        </div>
      </section>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {active.fullName || 'Student'}
                </h3>
                <p className="text-xs text-slate-500">
                  {active.rollNumber || 'No roll number'} ·{' '}
                  {active.programme || 'Programme not set'}
                </p>
              </div>
              <button type="button" onClick={() => setActive(null)} aria-label="Close">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {active.reasons.map((reason) => (
                <li key={reason} className="rounded-xl bg-rose-50 px-3 py-2 text-rose-700">
                  {reason}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              IA {formatPercent(active.iaPercent)} · Attendance{' '}
              {formatPercent(active.attendancePercent)} · Fee{' '}
              {active.feeStatus === 'PENDING'
                ? `Pending${active.feeDue ? ` ₹${active.feeDue.toLocaleString('en-IN')}` : ''}`
                : 'Paid'}{' '}
              · Library {active.libraryStatus === 'PENDING' ? 'Pending' : 'Clear'}
            </p>
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
}: {
  icon: React.ReactNode;
  tone: 'rose' | 'amber' | 'yellow' | 'sky' | 'violet' | 'green';
  label: string;
  value: number;
  hint: string;
}) {
  const tones = {
    rose: 'bg-rose-50 text-rose-500',
    amber: 'bg-orange-50 text-orange-500',
    yellow: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
    violet: 'bg-violet-50 text-violet-600',
    green: 'bg-emerald-50 text-emerald-600',
  };
  return (
    <article className={cn('rounded-2xl border border-white p-3 shadow-sm', tones[tone])}>
      <div className="flex items-center gap-2">
        <span className="rounded-xl bg-white/80 p-2">{icon}</span>
        <div>
          <p className="text-[11px] text-slate-500">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value.toLocaleString('en-IN')}</p>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-400">{hint}</p>
    </article>
  );
}

function Chip({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-semibold',
        className,
        active && 'ring-2 ring-blue-500',
      )}
    >
      {children}
    </button>
  );
}

function Pill({ tone, children }: { tone: 'green' | 'amber' | 'rose'; children: React.ReactNode }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  );
}

function Percent({ value, bad, warn }: { value?: number | null; bad?: boolean; warn?: boolean }) {
  if (value == null) return <span className="text-slate-400">—</span>;
  return (
    <span
      className={cn(
        'font-semibold',
        bad ? 'text-rose-600' : warn ? 'text-amber-600' : 'text-emerald-600',
      )}
    >
      {value.toFixed(0)}%
    </span>
  );
}

function formatPercent(value?: number | null) {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  const pages = pageWindow(page, pageCount);
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="rounded-lg border border-slate-200 px-2 py-1"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        ‹
      </button>
      {pages.map((item, index) =>
        item === '…' ? (
          <span key={`gap-${index}`} className="px-1">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPage(item)}
            className={cn(
              'h-7 min-w-7 rounded-lg px-2',
              item === page ? 'bg-blue-600 text-white' : 'border border-slate-200',
            )}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className="rounded-lg border border-slate-200 px-2 py-1"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        ›
      </button>
    </div>
  );
}

function pageWindow(page: number, pageCount: number) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const items: Array<number | '…'> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) items.push('…');
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < pageCount - 1) items.push('…');
  items.push(pageCount);
  return items;
}

function exportCsv(rows: DefaulterRow[]) {
  const header = [
    'Roll Number',
    'Name',
    'Registration',
    'Programme',
    'Department',
    'Semester',
    'IA %',
    'Attendance %',
    'Fee Status',
    'Library Status',
    'Issues',
    'Reasons',
  ];
  const lines = rows.map((row) =>
    [
      row.rollNumber,
      row.fullName,
      row.enrollmentNumber,
      row.programme,
      row.department,
      row.semesterNo,
      row.iaPercent,
      row.attendancePercent,
      row.feeStatus,
      row.libraryStatus,
      row.totalIssues,
      row.reasons.join('; '),
    ]
      .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ia-defaulters.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function printRows(rows: DefaulterRow[]) {
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) return;
  const body = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.rollNumber)}</td><td>${escapeHtml(row.fullName)}</td><td>${escapeHtml(row.programme)}</td><td>${escapeHtml(row.department)}</td><td>${row.semesterNo ?? ''}</td><td>${row.iaPercent ?? ''}</td><td>${row.attendancePercent ?? ''}</td><td>${row.feeStatus ?? ''}</td><td>${row.libraryStatus ?? ''}</td><td>${escapeHtml(row.reasons.join('; '))}</td></tr>`,
    )
    .join('');
  popup.document.write(
    `<!doctype html><title>IA Defaulters</title><style>body{font-family:sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px;font-size:12px;text-align:left}</style><h1>IA Defaulters</h1><table><thead><tr><th>Roll</th><th>Name</th><th>Programme</th><th>Department</th><th>Sem</th><th>IA %</th><th>Attendance</th><th>Fee</th><th>Library</th><th>Reasons</th></tr></thead><tbody>${body}</tbody></table>`,
  );
  popup.document.close();
  popup.focus();
  popup.print();
}

function escapeHtml(value?: string | null) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
