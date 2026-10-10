'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Info,
  Loader2,
  Pencil,
  Printer,
  Search,
  Settings2,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import {
  downloadIaNoticeboardRoutinePdf,
  fetchIaExams,
  fetchIaNoticeboardRoutineHtml,
  fetchIaPapers,
  generateIaTimetable,
  rescheduleIaPapers,
  updateIaPaperSchedule,
  type IaExamSummary,
  type IaPaper,
} from '@/services/examinations-ia';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type RoutineChoice = 'DAY_SECOND' | 'MORNING_SECOND' | 'FIRST' | 'SIMPLE';

const PAGE_SIZES = [10, 25, 50, 100];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function isSecondIaExam(exam?: { name?: string; examType?: string } | null) {
  if (!exam) return false;
  return exam.examType === 'IA_TEST_2' || /2nd internal|second internal/i.test(exam.name ?? '');
}

function shiftLabel(exam?: IaExamSummary | null) {
  return exam?.stats?.shiftName || exam?.metadata?.shiftName || '';
}

function isoDate(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function plusDays(iso: string, days: number) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function displayDate(iso?: string | null) {
  const value = isoDate(iso);
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function weekday(iso?: string | null) {
  const value = isoDate(iso);
  if (!value) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? '—';
}

function clock24(value: string | Date | null | undefined) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const match = value.match(/T(\d{2}):(\d{2})/) ?? value.match(/^(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

function clock12(value: string | Date | null | undefined) {
  const raw = clock24(value);
  if (!raw) return '—';
  const [hours, minutes] = raw.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function paperState(paper: IaPaper) {
  if (!isoDate(paper.examDate) || !clock24(paper.startTime)) return 'tentative';
  return 'scheduled';
}

export function IaTimetableWorkspace() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const exams = useQuery({ queryKey: ['ia', 'exams'], queryFn: fetchIaExams });
  const [yearId, setYearId] = useState('all');
  const [sessionId, setSessionId] = useState('');
  const [choice, setChoice] = useState<RoutineChoice>('DAY_SECOND');
  const [startDate, setStartDate] = useState('2026-10-12');
  const [endDate, setEndDate] = useState('2026-10-16');
  const [durationMinutes, setDurationMinutes] = useState(75);
  const [advanced, setAdvanced] = useState(false);
  const [message, setMessage] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [semester, setSemester] = useState('all');
  const [department, setDepartment] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<'date' | 'time' | 'code'>('date');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [editMode, setEditMode] = useState(false);
  const [drafts, setDrafts] = useState<
    Record<string, { examDate: string; startTime: string; endTime: string }>
  >({});
  const [editing, setEditing] = useState<IaPaper | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const yearTouched = useRef(false);
  const seededExam = useRef('');

  const yearOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const exam of exams.data ?? []) {
      if (exam.academicYearId)
        map.set(exam.academicYearId, exam.stats?.academicYearName || exam.academicYearId);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [exams.data]);

  const visibleExams = useMemo(
    () =>
      (exams.data ?? []).filter(
        (exam) => yearId === 'all' || !exam.academicYearId || exam.academicYearId === yearId,
      ),
    [exams.data, yearId],
  );

  useEffect(() => {
    const fromQuery = searchParams.get('exam');
    if (fromQuery) setSessionId(fromQuery);
  }, [searchParams]);

  useEffect(() => {
    if (yearTouched.current || yearId !== 'all' || !exams.data?.length) return;
    const preferred = exams.data.find((exam) => exam.status === 'SCHEDULED') ?? exams.data[0];
    if (preferred?.academicYearId) setYearId(preferred.academicYearId);
  }, [exams.data, yearId]);

  useEffect(() => {
    if (sessionId && visibleExams.some((exam) => exam.id === sessionId)) return;
    const preferred =
      visibleExams.find((exam) => exam.status === 'SCHEDULED') ??
      visibleExams.find((exam) => exam.status !== 'EXPIRED' && exam.status !== 'CANCELLED') ??
      visibleExams[0];
    if (preferred) setSessionId(preferred.id);
  }, [sessionId, visibleExams]);

  const selectedExam = visibleExams.find((exam) => exam.id === sessionId) ?? null;
  const papers = useQuery({
    queryKey: ['ia', 'papers', sessionId],
    queryFn: () => fetchIaPapers({ sessionId }),
    enabled: Boolean(sessionId),
  });
  const sessionPapers = papers.data ?? [];

  useEffect(() => {
    if (!selectedExam || seededExam.current === selectedExam.id) return;
    seededExam.current = selectedExam.id;
    const shift = shiftLabel(selectedExam).toLowerCase() || selectedExam.name.toLowerCase();
    if (isSecondIaExam(selectedExam))
      setChoice(shift.includes('morning') ? 'MORNING_SECOND' : 'DAY_SECOND');
    else if (selectedExam.examType === 'IA_TEST_1') setChoice('FIRST');
    const start = isoDate(selectedExam.startDate) || '2026-10-12';
    setStartDate(start);
    setEndDate(isoDate(selectedExam.endDate) || plusDays(start, 4));
    setDrafts({});
    setSelected({});
    setSemester('all');
    setDepartment('all');
    setDateFilter('all');
    setPage(1);
  }, [selectedExam]);

  const pattern =
    choice === 'MORNING_SECOND'
      ? 'MORNING'
      : choice === 'DAY_SECOND'
        ? 'DAY'
        : shiftLabel(selectedExam).toLowerCase().includes('morning')
          ? 'MORNING'
          : 'DAY';
  const generateMode =
    choice === 'FIRST' ? 'FYUGP_FIRST_IA' : choice === 'SIMPLE' ? 'SIMPLE' : 'FYUGP_SECOND_IA';
  const examShift = shiftLabel(selectedExam).toLowerCase();
  const patternMismatch =
    isSecondIaExam(selectedExam) &&
    ((pattern === 'MORNING' && examShift.includes('day') && !examShift.includes('morning')) ||
      (pattern === 'DAY' && examShift.includes('morning')));

  const semesters = useMemo(
    () =>
      [
        ...new Set(
          sessionPapers.map((paper) => paper.semesterNo).filter((n): n is number => n != null),
        ),
      ].sort((a, b) => a - b),
    [sessionPapers],
  );
  const departments = useMemo(() => {
    const map = new Map<string, string>();
    for (const paper of sessionPapers) {
      const name = paper.course?.departmentName;
      if (name) map.set(name, name);
    }
    return [...map.values()].sort();
  }, [sessionPapers]);
  const dates = useMemo(
    () =>
      [...new Set(sessionPapers.map((paper) => isoDate(paper.examDate)).filter(Boolean))].sort(),
    [sessionPapers],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = sessionPapers.filter((paper) => {
      if (semester !== 'all' && String(paper.semesterNo ?? '') !== semester) return false;
      if (department !== 'all' && (paper.course?.departmentName || 'Unassigned') !== department)
        return false;
      if (dateFilter !== 'all' && isoDate(paper.examDate) !== dateFilter) return false;
      if (statusFilter !== 'all' && paperState(paper) !== statusFilter) return false;
      if (!query) return true;
      return (
        paper.paperCode.toLowerCase().includes(query) ||
        paper.paperName.toLowerCase().includes(query)
      );
    });
    rows.sort((a, b) => {
      if (sortKey === 'code') return a.paperCode.localeCompare(b.paperCode);
      if (sortKey === 'time') return clock24(a.startTime).localeCompare(clock24(b.startTime));
      const byDate = isoDate(a.examDate).localeCompare(isoDate(b.examDate));
      return (
        byDate ||
        clock24(a.startTime).localeCompare(clock24(b.startTime)) ||
        a.paperCode.localeCompare(b.paperCode)
      );
    });
    return rows;
  }, [sessionPapers, search, semester, department, dateFilter, statusFilter, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageStart = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(safePage * pageSize, filtered.length);
  const datedCount = sessionPapers.filter((paper) => paperState(paper) === 'scheduled').length;
  const scheduledPercent = sessionPapers.length
    ? Math.round((datedCount / sessionPapers.length) * 100)
    : 0;
  const selectedIds = Object.entries(selected)
    .filter(([, on]) => on)
    .map(([id]) => id);
  const dirtyRows = Object.entries(drafts);

  const generate = useMutation({
    mutationFn: () =>
      generateIaTimetable({
        sessionId,
        startDate,
        mode: generateMode,
        ...(generateMode === 'SIMPLE'
          ? { durationMinutes, defaultStartTime: '10:00' }
          : { routinePattern: pattern }),
      }),
    onSuccess: (result) => {
      setWarnings(result.warnings ?? []);
      setMessage(`Timetable applied to ${result.updated} subjects.`);
      setDrafts({});
      qc.invalidateQueries({ queryKey: ['ia', 'papers'] });
      qc.invalidateQueries({ queryKey: ['ia', 'exams'] });
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Could not generate the timetable.')),
  });

  const downloadPdf = useMutation({
    mutationFn: () =>
      downloadIaNoticeboardRoutinePdf(sessionId, {
        routinePattern: pattern,
        startDate,
      }),
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'IA-Noticeboard.pdf';
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Noticeboard PDF downloaded.');
    },
    onError: (error) =>
      setMessage(apiErrorMessage(error, 'Could not download the noticeboard PDF.')),
  });

  const printHtml = useMutation({
    mutationFn: () =>
      fetchIaNoticeboardRoutineHtml(sessionId, {
        routinePattern: pattern,
        startDate,
      }),
    onSuccess: (html) => {
      const popup = window.open('', '_blank');
      if (!popup) {
        setMessage('Allow popups to print, or use Download PDF.');
        return;
      }
      popup.document.write(html);
      popup.document.close();
      popup.focus();
      setTimeout(() => popup.print(), 400);
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Could not open the noticeboard.')),
  });

  const saveSchedule = useMutation({
    mutationFn: (
      rows: Array<{ id: string; examDate: string; startTime: string; endTime: string }>,
    ) =>
      rescheduleIaPapers({
        sessionId,
        papers: rows.map((row) => ({
          ...row,
          startTime: row.startTime.slice(0, 5),
          endTime: row.endTime.slice(0, 5),
        })),
      }),
    onSuccess: (result) => {
      setMessage(`Updated ${result.updated} paper${result.updated === 1 ? '' : 's'}.`);
      setDrafts({});
      setEditing(null);
      setBulkOpen(false);
      setImportOpen(false);
      qc.invalidateQueries({ queryKey: ['ia', 'papers', sessionId] });
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Could not update the timetable.')),
  });

  const saveOne = useMutation({
    mutationFn: (row: { id: string; examDate: string; startTime: string; endTime: string }) =>
      updateIaPaperSchedule(row.id, {
        examDate: row.examDate,
        startTime: row.startTime.slice(0, 5),
        endTime: row.endTime.slice(0, 5),
      }),
    onSuccess: () => {
      setMessage('Paper time updated.');
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['ia', 'papers', sessionId] });
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Could not update that paper.')),
  });

  const resetFilters = () => {
    setSearch('');
    setSemester('all');
    setDepartment('all');
    setDateFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  const draftFor = (paper: IaPaper) =>
    drafts[paper.id] ?? {
      examDate: isoDate(paper.examDate),
      startTime: clock24(paper.startTime),
      endTime: clock24(paper.endTime),
    };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <label className="flex items-center gap-2 text-xs text-slate-500">
          <CalendarDays className="h-4 w-4 text-blue-600" />
          Academic Year
          <select
            value={yearId}
            onChange={(event) => {
              yearTouched.current = true;
              setYearId(event.target.value);
              setSessionId('');
            }}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800"
          >
            <option value="all">All</option>
            {yearOptions.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {exams.isError ? (
        <QueryErrorPanel
          title="Unable to load examinations"
          error={exams.error}
          onRetry={() => void exams.refetch()}
          isRetrying={exams.isFetching}
        />
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<CalendarDays className="h-5 w-5" />}
          tone="blue"
          label="Total IA Exams"
          value={visibleExams.length}
          hint="All internal assessments"
        />
        <SummaryCard
          icon={<FileText className="h-5 w-5" />}
          tone="slate"
          label="Total Subjects"
          value={sessionPapers.length}
          hint="For selected exam"
        />
        <SummaryCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="green"
          label="Scheduled Papers"
          value={datedCount}
          hint={`${scheduledPercent}% scheduled`}
        />
        <SummaryCard
          icon={<Users className="h-5 w-5" />}
          tone="violet"
          label="Affected Students"
          value={selectedExam?.stats?.registeredStudents ?? 0}
          hint="Registered for this examination"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-start gap-2">
          <Settings2 className="mt-0.5 h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">Auto Scheduling Wizard</h2>
            <p className="text-xs text-slate-500">
              Select the examination and shift routine, then generate the official timetable.
            </p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_160px_160px_auto] lg:items-end">
          <Field label="IA Examination" required>
            <select
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              className={selectClass}
            >
              {visibleExams.map((exam) => (
                <option key={exam.id} value={exam.id}>
                  {exam.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mode" required>
            <select
              value={choice}
              onChange={(event) => setChoice(event.target.value as RoutineChoice)}
              className={selectClass}
            >
              <option value="DAY_SECOND">Day Shift (12–16 Oct)</option>
              <option value="MORNING_SECOND">Morning Shift (12–16 Oct)</option>
              <option value="FIRST">First internal routine</option>
              <option value="SIMPLE">Simple auto-pack</option>
            </select>
          </Field>
          <Field label="Start Date" required>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={selectClass}
            />
          </Field>
          <Field label="End Date" required>
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={selectClass}
            />
          </Field>
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={!sessionId || generate.isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Generate Timetable
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium text-blue-800">
              <Info className="h-4 w-4" />
              Scheduling rules for this routine
            </p>
            <button
              type="button"
              onClick={() => setAdvanced((open) => !open)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Advanced Options
            </button>
          </div>
          <div className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <Rule label="Avoid subject clashes" />
            <Rule label="Follow semester-wise rules" />
            <Rule label="Apply shift-wise time slots" />
            <Rule label="Keep the official clocks for this shift" />
          </div>
          {advanced ? (
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              {choice === 'MORNING_SECOND' ? (
                <p>
                  Morning sittings are 8:15–9:30. Tuesday Semester 1 AEC is 6:45–8:00. Arrival is
                  6:30 AM.
                </p>
              ) : choice === 'DAY_SECOND' ? (
                <p>Day Shift sittings are 1:00–2:15 PM. Tuesday Semester 1 AEC is 9:45–11:00 AM.</p>
              ) : choice === 'FIRST' ? (
                <p>The first internal routine uses the August grid for the selected shift.</p>
              ) : (
                <label className="flex items-center gap-2">
                  Duration (minutes)
                  <input
                    type="number"
                    min={30}
                    max={180}
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(Number(event.target.value) || 75)}
                    className="h-8 w-20 rounded-lg border border-slate-200 px-2"
                  />
                </label>
              )}
            </div>
          ) : null}
        </div>
        {patternMismatch ? (
          <p className="mt-3 text-xs text-amber-700">
            This examination is {shiftLabel(selectedExam) || 'another shift'}. Generating the{' '}
            {pattern === 'MORNING' ? 'Morning' : 'Day'} routine will replace its clocks.
          </p>
        ) : null}
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
        {warnings.length ? (
          <ul className="mt-2 space-y-1 text-xs text-amber-700">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex gap-2">
            <CalendarDays className="mt-0.5 h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">IA Timetable — Table View</h2>
              <p className="text-xs text-slate-500">
                Subjects for the selected examination, with the scheduled date and time.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <GhostButton active={editMode} onClick={() => setEditMode((on) => !on)}>
              <Pencil className="h-4 w-4" /> Edit Mode
            </GhostButton>
            <GhostButton
              onClick={() => {
                if (!selectedIds.length) {
                  setMessage('Tick the papers you want to update.');
                  return;
                }
                setBulkOpen(true);
              }}
            >
              Bulk Update
            </GhostButton>
            <GhostButton onClick={() => setImportOpen(true)}>Import from Previous</GhostButton>
            <button
              type="button"
              onClick={() => downloadPdf.mutate()}
              disabled={!sessionId || downloadPdf.isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:opacity-50"
            >
              {downloadPdf.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Download PDF
            </button>
            <GhostButton
              onClick={() => printHtml.mutate()}
              disabled={printHtml.isPending || !sessionId}
            >
              {printHtml.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Print Timetable
            </GhostButton>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <label className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by subject code or subject name..."
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-blue-400"
            />
          </label>
          <MiniSelect
            label="Semester"
            value={semester}
            onChange={(value) => {
              setSemester(value);
              setPage(1);
            }}
            options={[
              ['all', 'All Semesters'],
              ...semesters.map((item) => [String(item), String(item)] as [string, string]),
            ]}
          />
          <MiniSelect
            label="Department"
            value={department}
            onChange={(value) => {
              setDepartment(value);
              setPage(1);
            }}
            options={[
              ['all', 'All Departments'],
              ...departments.map((name) => [name, name] as [string, string]),
            ]}
          />
          <MiniSelect
            label="Date"
            value={dateFilter}
            onChange={(value) => {
              setDateFilter(value);
              setPage(1);
            }}
            options={[
              ['all', 'All Dates'],
              ...dates.map((date) => [date, displayDate(date)] as [string, string]),
            ]}
          />
          <MiniSelect
            label="Status"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            options={[
              ['all', 'All Status'],
              ['scheduled', 'Scheduled'],
              ['tentative', 'Tentative'],
            ]}
          />
          <button
            type="button"
            onClick={() => void papers.refetch()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white"
          >
            <SlidersHorizontal className="h-4 w-4" /> Filter
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="h-10 px-2 text-sm text-slate-500 hover:text-slate-800"
          >
            Reset
          </button>
        </div>

        {papers.isError ? (
          <div className="p-4">
            <QueryErrorPanel
              title="Unable to load this timetable"
              error={papers.error}
              onRetry={() => void papers.refetch()}
              isRetrying={papers.isFetching}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-sky-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={pageRows.length > 0 && pageRows.every((paper) => selected[paper.id])}
                      onChange={(event) => {
                        const on = event.target.checked;
                        setSelected((prev) => {
                          const next = { ...prev };
                          for (const paper of pageRows) next[paper.id] = on;
                          return next;
                        });
                      }}
                      aria-label="Select papers on this page"
                    />
                  </th>
                  <th className="px-2 py-3">#</th>
                  <th className="px-2 py-3">Subject Code</th>
                  <th className="px-2 py-3">Subject / Paper</th>
                  <th className="px-2 py-3">Sem</th>
                  <SortHeader
                    label="Date"
                    active={sortKey === 'date'}
                    onClick={() => setSortKey('date')}
                  />
                  <th className="px-2 py-3">Day</th>
                  <SortHeader
                    label="Time"
                    active={sortKey === 'time'}
                    onClick={() => setSortKey('time')}
                  />
                  <th className="px-2 py-3">Status</th>
                  <th className="px-2 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((paper, index) => {
                  const draft = draftFor(paper);
                  const state = paperState(paper);
                  return (
                    <tr key={paper.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={Boolean(selected[paper.id])}
                          onChange={(event) =>
                            setSelected((prev) => ({ ...prev, [paper.id]: event.target.checked }))
                          }
                          aria-label={`Select ${paper.paperCode}`}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-slate-500">{pageStart + index}</td>
                      <td className="px-2 py-2.5 font-medium text-slate-800">{paper.paperCode}</td>
                      <td className="px-2 py-2.5 text-slate-700">{paper.paperName}</td>
                      <td className="px-2 py-2.5">{paper.semesterNo ?? '—'}</td>
                      <td className="px-2 py-2">
                        {editMode ? (
                          <input
                            type="date"
                            value={draft.examDate}
                            onChange={(event) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [paper.id]: { ...draft, examDate: event.target.value },
                              }))
                            }
                            className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
                          />
                        ) : (
                          displayDate(draft.examDate || paper.examDate)
                        )}
                      </td>
                      <td className="px-2 py-2.5">{weekday(draft.examDate || paper.examDate)}</td>
                      <td className="px-2 py-2 text-slate-700">
                        {editMode ? (
                          <span className="flex items-center gap-1">
                            <input
                              type="time"
                              value={draft.startTime}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [paper.id]: { ...draft, startTime: event.target.value },
                                }))
                              }
                              className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
                            />
                            <input
                              type="time"
                              value={draft.endTime}
                              onChange={(event) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [paper.id]: { ...draft, endTime: event.target.value },
                                }))
                              }
                              className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
                            />
                          </span>
                        ) : (
                          `${clock12(paper.startTime)} – ${clock12(paper.endTime)}`
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        {state === 'scheduled' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Scheduled
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Tentative
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          title="Edit this paper"
                          onClick={() => setEditing(paper)}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!pageRows.length ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                {papers.isLoading
                  ? 'Loading the timetable…'
                  : 'No papers match this examination and filter.'}
              </p>
            ) : null}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <p className="text-xs text-slate-500">
            Showing {pageStart} to {pageEnd} of {filtered.length} entries
          </p>
          <div className="flex items-center gap-1">
            <PageButton disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </PageButton>
            {Array.from({ length: pageCount }, (_, index) => index + 1)
              .filter((item) => item === 1 || item === pageCount || Math.abs(item - safePage) <= 1)
              .map((item, index, list) => (
                <span key={item} className="flex items-center">
                  {index > 0 && list[index - 1] !== item - 1 ? (
                    <span className="px-1 text-slate-400">…</span>
                  ) : null}
                  <PageButton active={item === safePage} onClick={() => setPage(item)}>
                    {item}
                  </PageButton>
                </span>
              ))}
            <PageButton disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </PageButton>
          </div>
          <div className="flex items-center gap-2">
            {editMode && dirtyRows.length ? (
              <button
                type="button"
                disabled={saveSchedule.isPending}
                onClick={() =>
                  saveSchedule.mutate(
                    dirtyRows.map(([id, row]) => ({
                      id,
                      examDate: row.examDate,
                      startTime: row.startTime,
                      endTime: row.endTime,
                    })),
                  )
                }
                className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                Save timetable changes
              </button>
            ) : null}
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Rows per page
              <select
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      {editing ? (
        <ScheduleDialog
          title={`${editing.paperCode} — ${editing.paperName}`}
          initial={draftFor(editing)}
          pending={saveOne.isPending}
          onClose={() => setEditing(null)}
          onSave={(row) => saveOne.mutate({ id: editing.id, ...row })}
        />
      ) : null}
      {bulkOpen ? (
        <ScheduleDialog
          title={`Update ${selectedIds.length} selected papers`}
          initial={{
            examDate: startDate,
            startTime: pattern === 'MORNING' ? '08:15' : '13:00',
            endTime: pattern === 'MORNING' ? '09:30' : '14:15',
          }}
          pending={saveSchedule.isPending}
          onClose={() => setBulkOpen(false)}
          onSave={(row) => saveSchedule.mutate(selectedIds.map((id) => ({ id, ...row })))}
        />
      ) : null}
      {importOpen ? (
        <ImportDialog
          exams={(exams.data ?? []).filter((exam) => exam.id !== sessionId)}
          pending={saveSchedule.isPending}
          onClose={() => setImportOpen(false)}
          onImport={async (sourceId) => {
            const source = await fetchIaPapers({ sessionId: sourceId });
            const byCode = new Map(source.map((paper) => [paper.paperCode, paper]));
            const rows = sessionPapers.flatMap((paper) => {
              const match = byCode.get(paper.paperCode);
              const examDate = isoDate(match?.examDate);
              const startTime = clock24(match?.startTime);
              const endTime = clock24(match?.endTime);
              if (!match || !examDate || !startTime || !endTime) return [];
              return [{ id: paper.id, examDate, startTime, endTime }];
            });
            if (!rows.length) {
              setMessage('No matching subject codes were found on that examination.');
              return;
            }
            saveSchedule.mutate(rows);
          }}
        />
      ) : null}
    </div>
  );
}

const selectClass =
  'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-400';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function Rule({ label }: { label: string }) {
  return (
    <label className="flex items-center gap-2">
      <input type="checkbox" checked readOnly className="accent-blue-600" />
      {label}
    </label>
  );
}

function SummaryCard({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  tone: 'blue' | 'slate' | 'green' | 'violet';
  label: string;
  value: number;
  hint: string;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-100 text-slate-600',
    green: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  };
  return (
    <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', tones[tone])}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value.toLocaleString('en-IN')}</p>
        <p className="text-[11px] text-slate-400">{hint}</p>
      </div>
    </article>
  );
}

function GhostButton({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium disabled:opacity-50',
        active
          ? 'border-blue-600 bg-blue-50 text-blue-700'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}

function MiniSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      <span className="hidden sm:inline">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700"
      >
        {options.map(([id, name]) => (
          <option key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <th className="px-2 py-3">
      <button
        type="button"
        onClick={onClick}
        className={cn('font-semibold', active && 'text-blue-700')}
      >
        {label} {active ? '↑' : '↕'}
      </button>
    </th>
  );
}

function PageButton({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm',
        active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100',
        disabled && 'opacity-40',
      )}
    >
      {children}
    </button>
  );
}

function ScheduleDialog({
  title,
  initial,
  pending,
  onClose,
  onSave,
}: {
  title: string;
  initial: { examDate: string; startTime: string; endTime: string };
  pending: boolean;
  onClose: () => void;
  onSave: (row: { examDate: string; startTime: string; endTime: string }) => void;
}) {
  const [examDate, setExamDate] = useState(initial.examDate);
  const [startTime, setStartTime] = useState(initial.startTime || '13:00');
  const [endTime, setEndTime] = useState(initial.endTime || '14:15');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ examDate, startTime, endTime });
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid gap-3">
          <Field label="Date" required>
            <input
              type="date"
              value={examDate}
              onChange={(event) => setExamDate(event.target.value)}
              className={selectClass}
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start" required>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className={selectClass}
                required
              />
            </Field>
            <Field label="End" required>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className={selectClass}
                required
              />
            </Field>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg px-3 text-sm text-slate-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function ImportDialog({
  exams,
  pending,
  onClose,
  onImport,
}: {
  exams: IaExamSummary[];
  pending: boolean;
  onClose: () => void;
  onImport: (sessionId: string) => Promise<void>;
}) {
  const [sourceId, setSourceId] = useState(exams[0]?.id ?? '');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          if (sourceId) void onImport(sourceId);
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">
            Import from a previous examination
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mb-3 text-sm text-slate-500">
          Dates and times are copied onto papers that share the same subject code. Other papers stay
          as they are.
        </p>
        <select
          value={sourceId}
          onChange={(event) => setSourceId(event.target.value)}
          className={selectClass}
        >
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name}
            </option>
          ))}
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg px-3 text-sm text-slate-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !sourceId}
            className="inline-flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Copy times
          </button>
        </div>
      </form>
    </div>
  );
}
