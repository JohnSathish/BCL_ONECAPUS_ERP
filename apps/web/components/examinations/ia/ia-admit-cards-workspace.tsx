'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Archive,
  CalendarDays,
  CheckCircle2,
  Download,
  Eye,
  IdCard,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Ticket,
  Users,
} from 'lucide-react';
import { useExamHeaderAside } from '@/components/examinations/ia/ia-examination-shell';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import {
  bulkGenerateIaAdmitCards,
  downloadIaAdmitPdf,
  downloadIaAdmitZip,
  fetchIaAdmitCard,
  fetchIaAdmitPrintHtml,
  fetchIaAdmitSessions,
  fetchIaAdmitStudents,
} from '@/services/examinations-ia';
import { printHtmlDocument } from '@/lib/print-html-document';
import { IaAdmitCardPrint, type IaAdmitCardData } from './ia-admit-card-print';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const BASE = '/admin/academics/examinations';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type AdmitSession = {
  id: string;
  name: string;
  examType?: string;
  semesterNo?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  academicYearId?: string | null;
  academicYearName?: string | null;
  shiftId?: string | null;
  shiftName?: string | null;
  isDemo?: boolean;
};

type StudentRow = {
  id: string;
  rollNumber?: string | null;
  fullName?: string | null;
  programme?: string | null;
  programmeCode?: string | null;
  department?: string | null;
  departmentId?: string | null;
  paperCount: number;
  semesterNos?: number[];
  eligible: boolean;
  blocked: boolean;
  status: string;
  ineligibilityReasons: string[];
  missingFields: string[];
  admitCardNumber?: string | null;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function isoDate(value?: string | null) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function rangeLabel(start?: string | null, end?: string | null) {
  const from = isoDate(start);
  const to = isoDate(end) || from;
  if (!from) return '';
  const [, sm, sd] = from.split('-').map(Number);
  const [, em, ed] = to.split('-').map(Number);
  if (!sm || !sd) return '';
  if (sm === em) return `${sd}–${ed} ${MONTHS[sm - 1]}`;
  return `${sd} ${MONTHS[sm - 1]}–${ed} ${MONTHS[(em || sm) - 1]}`;
}

function shiftOf(session: AdmitSession) {
  if (session.shiftName) return session.shiftName;
  if (/morning/i.test(session.name)) return 'Morning';
  if (/\bday\b/i.test(session.name)) return 'Day';
  return 'All shifts';
}

function modeLabel(session: AdmitSession) {
  const range = rangeLabel(session.startDate, session.endDate);
  const shift = shiftOf(session);
  return range ? `${shift} (${range})` : shift;
}

export function IaAdmitCardsWorkspace() {
  const [yearId, setYearId] = useState('all');
  const yearTouched = useRef(false);
  const [sessionId, setSessionId] = useState('');
  const [mode, setMode] = useState('all');
  const [semester, setSemester] = useState('all');
  const [programmeFilter, setProgrammeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'eligible' | 'all' | 'ineligible'>('eligible');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewCard, setPreviewCard] = useState<IaAdmitCardData | null>(null);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);

  const sessions = useQuery({ queryKey: ['ia', 'admit-sessions'], queryFn: fetchIaAdmitSessions });
  const sessionRows: AdmitSession[] = sessions.data ?? [];

  const yearOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const session of sessionRows) {
      if (session.academicYearId) {
        map.set(session.academicYearId, session.academicYearName || session.academicYearId);
      }
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [sessionRows]);

  useEffect(() => {
    if (yearTouched.current || yearId !== 'all' || !sessionRows.length) return;
    const preferred =
      sessionRows.find((session) => session.status === 'SCHEDULED') ?? sessionRows[0];
    if (preferred?.academicYearId) setYearId(preferred.academicYearId);
  }, [sessionRows, yearId]);

  const yearSessions = useMemo(
    () => sessionRows.filter((session) => yearId === 'all' || session.academicYearId === yearId),
    [sessionRows, yearId],
  );
  const modes = useMemo(
    () => [...new Set(yearSessions.map((session) => shiftOf(session)))],
    [yearSessions],
  );
  const modeSessions = useMemo(
    () => yearSessions.filter((session) => mode === 'all' || shiftOf(session) === mode),
    [yearSessions, mode],
  );
  const activeSession = modeSessions.some((session) => session.id === sessionId)
    ? sessionId
    : (modeSessions.find((session) => session.status === 'SCHEDULED')?.id ??
      modeSessions[0]?.id ??
      '');
  const currentSession = modeSessions.find((session) => session.id === activeSession) ?? null;

  const roster = useQuery({
    queryKey: ['ia', 'admit-students', activeSession],
    queryFn: () => fetchIaAdmitStudents(activeSession),
    enabled: Boolean(activeSession),
  });

  const students: StudentRow[] = roster.data?.students ?? [];
  const programmes = useMemo(() => {
    const map = new Map<string, string>();
    for (const student of students) {
      if (student.programmeCode)
        map.set(student.programmeCode, student.programme ?? student.programmeCode);
    }
    return [...map.entries()];
  }, [students]);
  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const student of students) {
      if (student.departmentId && student.department)
        map.set(student.departmentId, student.department);
    }
    return [...map.entries()];
  }, [students]);
  const semesters = useMemo(() => {
    const values = new Set<number>();
    if (currentSession?.semesterNo) values.add(currentSession.semesterNo);
    for (const student of students) {
      for (const value of student.semesterNos ?? []) values.add(value);
    }
    return [...values].sort((a, b) => a - b);
  }, [students, currentSession]);

  const cohort = useMemo(
    () =>
      students.filter((student) => {
        const semestersForStudent = student.semesterNos?.length
          ? student.semesterNos
          : currentSession?.semesterNo
            ? [currentSession.semesterNo]
            : [];
        if (semester !== 'all' && !semestersForStudent.includes(Number(semester))) return false;
        if (programmeFilter && student.programmeCode !== programmeFilter) return false;
        if (departmentFilter && student.departmentId !== departmentFilter) return false;
        return true;
      }),
    [students, semester, programmeFilter, departmentFilter, currentSession],
  );
  const tableStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cohort.filter((student) => {
      if (statusFilter === 'eligible' && !student.eligible) return false;
      if (statusFilter === 'ineligible' && student.eligible) return false;
      if (!query) return true;
      return (
        (student.rollNumber ?? '').toLowerCase().includes(query) ||
        (student.fullName ?? '').toLowerCase().includes(query)
      );
    });
  }, [cohort, statusFilter, search]);

  const eligible = useMemo(() => cohort.filter((student) => student.eligible), [cohort]);
  const generated = cohort.filter((student) => student.admitCardNumber).length;
  const pending = Math.max(cohort.length - generated, 0);
  const generatedPercent = cohort.length ? Math.round((generated / cohort.length) * 1000) / 10 : 0;
  const pageCount = Math.max(1, Math.ceil(tableStudents.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = tableStudents.slice((safePage - 1) * pageSize, safePage * pageSize);
  const selectedEligibleIds = [...selected].filter((id) =>
    eligible.some((student) => student.id === id),
  );

  useEffect(() => {
    setPage(1);
  }, [activeSession, semester, programmeFilter, departmentFilter, statusFilter, search, pageSize]);

  const preview = useMutation({
    mutationFn: (studentId: string) =>
      fetchIaAdmitCard(activeSession, studentId, { preview: true }),
    onSuccess: (data, studentId) => {
      setPreviewStudentId(studentId);
      setPreviewCard(data as IaAdmitCardData);
    },
  });

  const regenerate = useMutation({
    mutationFn: (studentId: string) => bulkGenerateIaAdmitCards(activeSession, [studentId]),
    onSuccess: async (_data, studentId) => {
      await roster.refetch();
      preview.mutate(studentId);
    },
  });

  const generateSelected = useMutation({
    mutationFn: (ids: string[]) => bulkGenerateIaAdmitCards(activeSession, ids),
    onSuccess: (data) => {
      const cards = (data.cards ?? []).filter((card: IaAdmitCardData) => !card.blocked);
      if (cards[0]) setPreviewCard(cards[0]);
      roster.refetch();
    },
  });

  const admitPrint = useMutation({
    mutationFn: async (studentIds: string[]) => {
      setPrintError(null);
      const html = await fetchIaAdmitPrintHtml(activeSession, studentIds);
      await printHtmlDocument(html);
    },
    onSuccess: () => roster.refetch(),
    onError: (error) =>
      setPrintError(apiErrorMessage(error, 'Unable to open the print dialog. Try Download PDF.')),
  });

  const pdfDownload = useMutation({
    mutationFn: (ids: string[]) => downloadIaAdmitPdf(activeSession, ids),
    onSuccess: (blob, ids) => {
      downloadBlob(blob, ids.length === 1 ? 'ia-admit-card.pdf' : 'ia-admit-cards-batch.pdf');
      roster.refetch();
    },
  });

  const zipDownload = useMutation({
    mutationFn: (ids: string[]) => downloadIaAdmitZip(activeSession, ids),
    onSuccess: (blob) => downloadBlob(blob, 'ia-admit-cards.zip'),
  });

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
            setSessionId('');
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

  const toggleAll = () => {
    const ids = tableStudents.filter((student) => student.eligible).map((student) => student.id);
    setSelected((prev) =>
      ids.length > 0 && ids.every((id) => prev.has(id)) ? new Set() : new Set(ids),
    );
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openPreview = (studentId: string) => preview.mutate(studentId);

  if (sessions.isLoading) return <p className="text-sm text-slate-500">Loading admit cards…</p>;
  if (sessions.isError) {
    return (
      <QueryErrorPanel
        title="Unable to load admit cards"
        error={sessions.error}
        onRetry={() => void sessions.refetch()}
        isRetrying={sessions.isFetching}
      />
    );
  }

  const allEligibleChecked =
    tableStudents.some((student) => student.eligible) &&
    tableStudents
      .filter((student) => student.eligible)
      .every((student) => selected.has(student.id));

  return (
    <div className="space-y-4">
      {setHeaderAside ? null : <div className="flex justify-end">{yearControl}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          icon={<Users className="h-5 w-5" />}
          tone="blue"
          label="Total Registered"
          value={cohort.length}
          hint="All selected students"
        />
        <Stat
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="green"
          label="Eligible"
          value={eligible.length}
          hint="Can generate admit cards"
        />
        <Stat
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="rose"
          label="Not Eligible"
          value={cohort.length - eligible.length}
          hint="Due to fee or other issues"
        />
        <Stat
          icon={<IdCard className="h-5 w-5" />}
          tone="violet"
          label="Cards Generated"
          value={generated}
          hint={`${generatedPercent}% completed`}
        />
        <Stat
          icon={<Download className="h-5 w-5" />}
          tone="amber"
          label="Pending"
          value={pending}
          hint="Yet to generate"
        />
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Ticket className="h-4 w-4 text-blue-600" /> Generate IA Admit Cards
            </h2>
            <p className="text-xs text-slate-500">
              Select an examination, filter students, and generate admit cards.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="IA Examination">
              <select
                value={activeSession}
                onChange={(event) => {
                  setSessionId(event.target.value);
                  setSelected(new Set());
                  setPreviewCard(null);
                  setPreviewStudentId(null);
                }}
                className={selectClass}
              >
                {modeSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mode">
              <select
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value);
                  setSessionId('');
                }}
                className={selectClass}
              >
                <option value="all">All shifts</option>
                {modes.map((name) => {
                  const sample = yearSessions.find((session) => shiftOf(session) === name);
                  const range = sample ? rangeLabel(sample.startDate, sample.endDate) : '';
                  return (
                    <option key={name} value={name}>
                      {range ? `${name} (${range})` : name}
                    </option>
                  );
                })}
              </select>
            </Field>
            <Field label="Semester">
              <select
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                className={selectClass}
              >
                <option value="all">All semesters</option>
                {semesters.map((value) => (
                  <option key={value} value={String(value)}>
                    Semester {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Programme / Stream">
              <select
                value={programmeFilter}
                onChange={(event) => setProgrammeFilter(event.target.value)}
                className={selectClass}
              >
                <option value="">All Programmes</option>
                {programmes.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                className={selectClass}
              >
                <option value="">All Departments</option>
                {departments.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <div className="flex gap-2">
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as 'eligible' | 'all' | 'ineligible')
                  }
                  className={selectClass}
                >
                  <option value="eligible">Eligible Only</option>
                  <option value="all">All students</option>
                  <option value="ineligible">Not Eligible</option>
                </select>
                <button
                  type="button"
                  onClick={() => void roster.refetch()}
                  className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-sky-600 px-3 text-xs font-semibold text-white"
                >
                  <Search className="h-3.5 w-3.5" /> Load
                </button>
              </div>
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton
              className="bg-blue-600 text-white"
              disabled={!selectedEligibleIds.length || generateSelected.isPending}
              onClick={() => generateSelected.mutate(selectedEligibleIds)}
            >
              <CheckCircle2 className="h-4 w-4" /> Generate Selected ({selectedEligibleIds.length})
            </ActionButton>
            <ActionButton
              className="bg-sky-50 text-sky-700"
              disabled={!eligible.length || generateSelected.isPending}
              onClick={() => generateSelected.mutate(eligible.map((student) => student.id))}
            >
              <Users className="h-4 w-4" /> Generate All Eligible ({eligible.length})
            </ActionButton>
            <ActionButton
              className="bg-emerald-50 text-emerald-700"
              disabled={!selectedEligibleIds.length || preview.isPending}
              onClick={() => openPreview(selectedEligibleIds[0])}
            >
              <Eye className="h-4 w-4" /> Preview Selected
            </ActionButton>
            <ActionButton
              className="bg-rose-50 text-rose-600"
              disabled={!selectedEligibleIds.length || pdfDownload.isPending}
              onClick={() => pdfDownload.mutate(selectedEligibleIds)}
            >
              <Download className="h-4 w-4" /> Download PDF
            </ActionButton>
            <ActionButton
              className="bg-violet-50 text-violet-700"
              disabled={!selectedEligibleIds.length || admitPrint.isPending}
              onClick={() => admitPrint.mutate(selectedEligibleIds)}
            >
              <Printer className="h-4 w-4" /> Print Selected
            </ActionButton>
            <ActionButton
              className="bg-slate-50 text-slate-600"
              disabled={!selectedEligibleIds.length || zipDownload.isPending}
              onClick={() => zipDownload.mutate(selectedEligibleIds)}
            >
              <Archive className="h-4 w-4" /> ZIP
            </ActionButton>
          </div>

          <div className="mt-4 flex justify-end">
            <label className="flex h-9 w-full max-w-xs items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-500">
              <Search className="h-4 w-4" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by roll number or name…"
                className="w-full bg-transparent outline-none"
              />
            </label>
          </div>

          <div className="mt-3 overflow-x-auto">
            {roster.isLoading ? (
              <p className="py-8 text-sm text-slate-500">Loading students…</p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                  <tr className="border-b border-slate-100">
                    <th className="py-2 pr-2">
                      <input
                        type="checkbox"
                        checked={allEligibleChecked}
                        onChange={toggleAll}
                        aria-label="Select eligible students"
                      />
                    </th>
                    <th className="py-2 pr-3">#</th>
                    <th className="py-2 pr-3">Roll Number</th>
                    <th className="py-2 pr-3">Student Name</th>
                    <th className="py-2 pr-3">Programme</th>
                    <th className="py-2 pr-3">Department</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((student, index) => (
                    <tr key={student.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={selected.has(student.id)}
                          onChange={() => toggleOne(student.id)}
                          aria-label={`Select ${student.fullName ?? student.rollNumber}`}
                        />
                      </td>
                      <td className="py-2 pr-3 text-slate-500">
                        {(safePage - 1) * pageSize + index + 1}
                      </td>
                      <td className="py-2 pr-3 font-medium text-slate-800">
                        {student.rollNumber ?? '—'}
                      </td>
                      <td className="py-2 pr-3 text-slate-800">{student.fullName ?? '—'}</td>
                      <td className="py-2 pr-3 text-slate-600">{student.programme ?? '—'}</td>
                      <td className="py-2 pr-3 text-slate-600">{student.department ?? '—'}</td>
                      <td className="py-2 pr-3">
                        {student.eligible ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Eligible
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600"
                            title={student.ineligibilityReasons.join('; ')}
                          >
                            <AlertTriangle className="h-3 w-3" /> Not Eligible
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-50"
                          onClick={() => openPreview(student.id)}
                          aria-label={`Preview ${student.fullName ?? student.rollNumber}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!roster.isLoading && !pageRows.length ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No students match these filters.
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <p>
              Showing {tableStudents.length ? (safePage - 1) * pageSize + 1 : 0} to{' '}
              {Math.min(safePage * pageSize, tableStudents.length)} of {tableStudents.length}{' '}
              students
            </p>
            <div className="flex items-center gap-2">
              <Pager page={safePage} pageCount={pageCount} onPage={setPage} />
              <label className="flex items-center gap-1">
                Rows
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1"
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
          {printError ? <p className="mt-2 text-xs text-rose-600">{printError}</p> : null}
        </div>

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <IdCard className="h-4 w-4 text-blue-600" /> Admit Card Preview
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
                disabled={!previewStudentId || preview.isPending}
                onClick={() => previewStudentId && openPreview(previewStudentId)}
              >
                <Eye className="h-3.5 w-3.5" /> Preview
              </button>
              <Link
                href={`${BASE}/settings`}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
              >
                <Settings className="h-3.5 w-3.5" /> Settings
              </Link>
            </div>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Click a student to preview their admit card.
          </p>

          {preview.isPending ? (
            <div className="flex items-center justify-center py-20 text-slate-500">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading preview…
            </div>
          ) : previewCard ? (
            <div className="max-h-[calc(100vh-16rem)] overflow-y-auto rounded-xl bg-slate-50 p-3">
              {previewCard.blocked ? (
                <IaAdmitCardPrint card={previewCard} />
              ) : (
                <AdmitPreview
                  card={previewCard}
                  shiftLabel={currentSession ? modeLabel(currentSession) : undefined}
                />
              )}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-slate-500">
              Choose a student and use the eye icon to preview the admit card.
            </p>
          )}

          {previewCard && !previewCard.blocked && previewStudentId ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton
                className="bg-rose-500 text-white"
                disabled={pdfDownload.isPending}
                onClick={() => pdfDownload.mutate([previewStudentId])}
              >
                <Download className="h-4 w-4" /> Download PDF
              </ActionButton>
              <ActionButton
                className="bg-blue-600 text-white"
                disabled={admitPrint.isPending}
                onClick={() => admitPrint.mutate([previewStudentId])}
              >
                {admitPrint.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Print Admit Card
              </ActionButton>
              <ActionButton
                className="bg-white text-slate-700 ring-1 ring-slate-200"
                disabled={regenerate.isPending}
                onClick={() => regenerate.mutate(previewStudentId)}
              >
                {regenerate.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Regenerate
              </ActionButton>
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}

const selectClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ActionButton({
  className,
  disabled,
  onClick,
  children,
}: {
  className: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold disabled:opacity-50',
        className,
      )}
    >
      {children}
    </button>
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
  tone: 'blue' | 'green' | 'rose' | 'violet' | 'amber';
  label: string;
  value: number;
  hint: string;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-500',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
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

function AdmitPreview({ card, shiftLabel }: { card: IaAdmitCardData; shiftLabel?: string }) {
  const name = card.institution?.displayName ?? card.institutionName ?? 'College';
  const instructions = (
    card.session?.instructions
      ? card.session.instructions.split(/\n+/).filter(Boolean)
      : [
          'Carry this admit card and a valid college ID card to the examination hall.',
          'Report at least 30 minutes before the start of the examination.',
          'Use of mobile phones and electronic devices is strictly prohibited.',
          'Follow all examination rules and instructions given by the invigilators.',
        ]
  ).slice(0, 4);
  const qr = card.verifyUrl ?? card.qrPayload ?? '';
  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm">
      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="flex gap-3">
          {card.institution?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.institution.logoUrl} alt="" className="h-14 w-14 object-contain" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-[10px] font-semibold text-blue-700">
              LOGO
            </div>
          )}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-blue-900">{name}</h3>
            <p className="text-[11px] font-semibold text-slate-700">{card.session?.name}</p>
            <p className="text-[10px] text-slate-500">
              Academic Year {card.session?.academicYear ?? '—'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400">Roll No.</p>
          <p className="font-mono text-xs font-bold">{card.student?.rollNumber ?? '—'}</p>
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(qr)}`}
              alt="Verification QR"
              className="ml-auto mt-1 h-12 w-12"
            />
          ) : null}
        </div>
      </header>
      <p className="mx-4 mt-3 rounded-md bg-blue-800 py-1 text-center text-xs font-bold tracking-[0.2em] text-white">
        ADMIT CARD
      </p>
      <div className="grid grid-cols-[1fr_72px] gap-3 px-4 py-3 text-[11px]">
        <dl className="space-y-1">
          <PreviewLine label="Name" value={card.student?.fullName} />
          <PreviewLine label="Programme" value={card.student?.programme} />
          <PreviewLine label="Department" value={card.student?.department} />
          <PreviewLine
            label="Semester"
            value={card.student?.semesterNo?.toString() ?? card.session?.semesterNo?.toString()}
          />
          <PreviewLine label="Shift" value={card.session?.shiftName || shiftLabel} />
          <PreviewLine
            label="Registration No."
            value={card.student?.enrollmentNumber || card.admitCardNumber}
          />
        </dl>
        {card.student?.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.student.photoUrl}
            alt=""
            className="h-20 w-16 rounded border border-slate-200 object-cover"
          />
        ) : (
          <div className="h-20 w-16 rounded border border-dashed border-slate-300 bg-slate-50" />
        )}
      </div>
      <div className="px-4 pb-3">
        <p className="mb-1 text-center text-[10px] font-bold tracking-wide text-blue-900">
          EXAMINATION SCHEDULE
        </p>
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="bg-blue-800 text-left text-white">
              <th className="px-1.5 py-1">Date</th>
              <th className="px-1.5 py-1">Day</th>
              <th className="px-1.5 py-1">Subject Code</th>
              <th className="px-1.5 py-1">Subject / Paper</th>
              <th className="px-1.5 py-1">Time</th>
            </tr>
          </thead>
          <tbody>
            {(card.papers ?? []).map((paper, index) => (
              <tr key={`${paper.paperCode}-${index}`} className="even:bg-slate-50">
                <td className="border-t border-slate-100 px-1.5 py-1">
                  {formatCardDate(paper.examDate)}
                </td>
                <td className="border-t border-slate-100 px-1.5 py-1">
                  {weekdayOf(paper.examDate)}
                </td>
                <td className="border-t border-slate-100 px-1.5 py-1 font-medium">
                  {paper.paperCode}
                </td>
                <td className="border-t border-slate-100 px-1.5 py-1">{paper.paperName}</td>
                <td className="border-t border-slate-100 px-1.5 py-1">
                  {clock12(paper.startTime)} – {clock12(paper.endTime)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!card.papers?.length ? (
          <p className="py-3 text-center text-xs text-slate-500">
            No scheduled papers for this student.
          </p>
        ) : null}
      </div>
      <footer className="grid grid-cols-[1fr_120px] gap-3 border-t border-slate-100 px-4 py-3 text-[10px]">
        <div>
          <p className="font-semibold text-slate-800">Important Instructions:</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-slate-600">
            {instructions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
        <div className="self-end text-center">
          <div className="border-t border-slate-400 pt-1 font-semibold text-slate-700">
            Controller of Examinations
          </div>
          <p className="text-slate-500">{name}</p>
        </div>
      </footer>
    </article>
  );
}

function PreviewLine({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-800">{value || '—'}</dd>
    </div>
  );
}

function formatCardDate(value?: string | Date | null) {
  const iso = isoDate(value == null ? '' : String(value));
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return '—';
  return `${day}-${month}-${year}`;
}

function weekdayOf(value?: string | Date | null) {
  const iso = isoDate(value == null ? '' : String(value));
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return '—';
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? '—';
}

function clock12(value?: string | Date | null) {
  if (value == null || value === '') return '—';
  const raw = String(value);
  const match = raw.match(/T(\d{2}):(\d{2})/) ?? raw.match(/^(\d{1,2}):(\d{2})/);
  const hours = match
    ? Number(match[1])
    : value instanceof Date
      ? value.getUTCHours()
      : new Date(raw).getUTCHours();
  const minutes = match
    ? Number(match[2])
    : value instanceof Date
      ? value.getUTCMinutes()
      : new Date(raw).getUTCMinutes();
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return '—';
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}
