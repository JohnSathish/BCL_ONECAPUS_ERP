'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Filter,
  GraduationCap,
  History,
  IdCard,
  Library,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Upload,
  Users,
} from 'lucide-react';
import { useExamHeaderAside } from '@/components/examinations/ia/ia-examination-shell';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { useAuth } from '@/hooks/use-auth';
import {
  downloadIaNehuExport,
  fetchIaAdmitAudit,
  fetchIaAdmitSessions,
  fetchIaAdmitStudents,
  fetchIaAnalytics,
  fetchIaConsolidationSheets,
  fetchIaDefaulters,
} from '@/services/examinations-ia';
import { cn } from '@/utils/cn';

const BASE = '/admin/academics/examinations';
const FILTER_KEY = 'ia-report-filter';
const HISTORY_KEY = 'ia-report-history';

type Filters = {
  sessionId: string;
  programmeCode: string;
  departmentId: string;
  semesterNo: string;
  shiftId: string;
};

type CategoryId =
  | 'student'
  | 'marks'
  | 'performance'
  | 'attendance'
  | 'defaulters'
  | 'admit'
  | 'department'
  | 'university'
  | 'audit'
  | 'summary';

type ReportDef = {
  id: string;
  category: CategoryId;
  name: string;
  description: string;
  format: 'CSV' | 'XLSX' | 'PDF';
  needsExam?: boolean;
};

type HistoryItem = {
  id: string;
  reportId: string;
  name: string;
  examination: string;
  generatedAt: string;
  format: string;
  generatedBy: string;
  filters: Filters;
};

const EMPTY: Filters = {
  sessionId: '',
  programmeCode: '',
  departmentId: '',
  semesterNo: '',
  shiftId: '',
};

const REPORTS: ReportDef[] = [
  {
    id: 'registered',
    category: 'student',
    name: 'Registered student list',
    description: 'Students registered for the selected examination.',
    format: 'CSV',
    needsExam: true,
  },
  {
    id: 'eligible',
    category: 'student',
    name: 'Eligible students',
    description: 'Students who can be issued an admit card.',
    format: 'CSV',
    needsExam: true,
  },
  {
    id: 'ineligible-students',
    category: 'student',
    name: 'Not eligible students',
    description: 'Students blocked from an admit card, with the reasons.',
    format: 'CSV',
    needsExam: true,
  },
  {
    id: 'subject-averages',
    category: 'marks',
    name: 'Subject average report',
    description: 'Average score for each paper that has marks.',
    format: 'CSV',
  },
  {
    id: 'programme-averages',
    category: 'marks',
    name: 'Programme average report',
    description: 'Average IA score by programme.',
    format: 'CSV',
  },
  {
    id: 'top',
    category: 'performance',
    name: 'Top performers',
    description: 'Highest IA scores in this selection.',
    format: 'CSV',
  },
  {
    id: 'lowest',
    category: 'performance',
    name: 'Lowest performers',
    description: 'Lowest IA scores among students with marks.',
    format: 'CSV',
  },
  {
    id: 'appearance',
    category: 'attendance',
    name: 'Appearance summary',
    description: 'Registered, appeared, absent, and not yet entered.',
    format: 'CSV',
  },
  {
    id: 'attendance-defaulters',
    category: 'attendance',
    name: 'Attendance defaulters',
    description: 'Students below the attendance limit.',
    format: 'CSV',
  },
  {
    id: 'all-defaulters',
    category: 'defaulters',
    name: 'All defaulters',
    description: 'Academic, attendance, fee, and library issues.',
    format: 'CSV',
  },
  {
    id: 'fee-defaulters',
    category: 'defaulters',
    name: 'Fee defaulters',
    description: 'Students with pending fee dues.',
    format: 'CSV',
  },
  {
    id: 'library-defaulters',
    category: 'defaulters',
    name: 'Library defaulters',
    description: 'Students with overdue books or unpaid fines.',
    format: 'CSV',
  },
  {
    id: 'academic-defaulters',
    category: 'defaulters',
    name: 'Academic defaulters',
    description: 'Students below the IA pass mark.',
    format: 'CSV',
  },
  {
    id: 'admit-status',
    category: 'admit',
    name: 'Admit card status',
    description: 'Eligibility and admit card number for each student.',
    format: 'CSV',
    needsExam: true,
  },
  {
    id: 'admit-audit',
    category: 'audit',
    name: 'Admit card activity',
    description: 'Cards generated, downloaded, and printed for this examination.',
    format: 'CSV',
    needsExam: true,
  },
  {
    id: 'department-performance',
    category: 'department',
    name: 'Department performance',
    description: 'Students, average IA, and pass rate by department.',
    format: 'CSV',
  },
  {
    id: 'selection-summary',
    category: 'summary',
    name: 'Selection summary',
    description: 'The counts and averages for the current filters.',
    format: 'CSV',
  },
];

const CATEGORIES: Array<{
  id: CategoryId;
  title: string;
  description: string;
  tone: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'student',
    title: 'Student Reports',
    description: 'Registered, eligible, and blocked students.',
    tone: 'bg-blue-50 text-blue-700',
    icon: <GraduationCap className="h-5 w-5" />,
  },
  {
    id: 'marks',
    title: 'Marks & Academic Reports',
    description: 'Subject and programme averages from entered marks.',
    tone: 'bg-emerald-50 text-emerald-700',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    id: 'performance',
    title: 'Performance Analysis',
    description: 'Highest and lowest scores.',
    tone: 'bg-violet-50 text-violet-700',
    icon: <Library className="h-5 w-5" />,
  },
  {
    id: 'attendance',
    title: 'Attendance Reports',
    description: 'Appearance and attendance shortfall.',
    tone: 'bg-amber-50 text-amber-700',
    icon: <CalendarDays className="h-5 w-5" />,
  },
  {
    id: 'defaulters',
    title: 'Defaulter Reports',
    description: 'IA, attendance, fee, and library issues.',
    tone: 'bg-rose-50 text-rose-600',
    icon: <AlertTriangle className="h-5 w-5" />,
  },
  {
    id: 'admit',
    title: 'Admit Card Reports',
    description: 'Card status for the selected examination.',
    tone: 'bg-yellow-50 text-yellow-700',
    icon: <IdCard className="h-5 w-5" />,
  },
  {
    id: 'department',
    title: 'Department Reports',
    description: 'Department averages and pass rates.',
    tone: 'bg-cyan-50 text-cyan-700',
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    id: 'university',
    title: 'University Submission',
    description: 'NEHU consolidation files.',
    tone: 'bg-pink-50 text-pink-700',
    icon: <Upload className="h-5 w-5" />,
  },
  {
    id: 'audit',
    title: 'Audit & Activity',
    description: 'Admit card generation and downloads.',
    tone: 'bg-indigo-50 text-indigo-700',
    icon: <ClipboardList className="h-5 w-5" />,
  },
  {
    id: 'summary',
    title: 'Selection Summary',
    description: 'A snapshot of the current filters.',
    tone: 'bg-slate-50 text-slate-700',
    icon: <Settings2 className="h-5 w-5" />,
  },
];

export function IaReportsWorkspace() {
  const { session } = useAuth();
  const generatedBy = session?.user?.displayName || session?.user?.email || 'Signed-in user';
  const [yearId, setYearId] = useState('all');
  const yearTouched = useRef(false);
  const [draft, setDraft] = useState<Filters>(EMPTY);
  const [applied, setApplied] = useState<Filters>(EMPTY);
  const [ready, setReady] = useState(false);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; csv: string } | null>(null);

  const sessions = useQuery({ queryKey: ['ia', 'admit-sessions'], queryFn: fetchIaAdmitSessions });
  const sessionRows: Array<{
    id: string;
    name: string;
    status?: string;
    academicYearId?: string | null;
    academicYearName?: string | null;
  }> = sessions.data ?? [];
  const sheets = useQuery({
    queryKey: ['ia', 'consolidation'],
    queryFn: fetchIaConsolidationSheets,
  });
  const sheetRows: Array<{ id: string; name: string; status: string; createdAt?: string }> =
    sheets.data ?? [];

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem(HISTORY_KEY);
      if (savedHistory) setHistory(JSON.parse(savedHistory) as HistoryItem[]);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    if (sessions.isLoading || ready) return;
    let saved: Filters | null = null;
    try {
      const raw = localStorage.getItem(FILTER_KEY);
      if (raw) saved = JSON.parse(raw) as Filters;
    } catch {
      saved = null;
    }
    const preferred = sessionRows.find((row) => row.status === 'SCHEDULED') ?? sessionRows[0];
    const next =
      saved?.sessionId || !preferred
        ? (saved ?? EMPTY)
        : { ...EMPTY, ...saved, sessionId: saved?.sessionId || preferred.id };
    setDraft(next);
    setApplied(next);
    if (next.sessionId) {
      const match = sessionRows.find((row) => row.id === next.sessionId);
      if (match?.academicYearId) setYearId(match.academicYearId);
    }
    setReady(true);
  }, [sessions.isLoading, sessionRows, ready]);

  const yearOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of sessionRows) {
      if (row.academicYearId)
        map.set(row.academicYearId, row.academicYearName || row.academicYearId);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [sessionRows]);

  useEffect(() => {
    if (yearTouched.current || yearId !== 'all' || !sessionRows.length) return;
    const preferred = sessionRows.find((row) => row.status === 'SCHEDULED') ?? sessionRows[0];
    if (preferred?.academicYearId) setYearId(preferred.academicYearId);
  }, [sessionRows, yearId]);

  const analytics = useQuery({
    queryKey: ['ia', 'analytics', 'reports', applied],
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

  const yearSessions = sessionRows.filter(
    (row) => yearId === 'all' || row.academicYearId === yearId || row.id === draft.sessionId,
  );
  const todayKey = `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`;
  const generatedToday = history.filter((item) => {
    const date = new Date(item.generatedAt);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` === todayKey;
  }).length;

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

  const visibleReports = REPORTS.filter((report) => {
    const query = search.trim().toLowerCase();
    if (category && report.category !== category) return false;
    if (!query) return Boolean(category);
    return `${report.name} ${report.description}`.toLowerCase().includes(query);
  });

  const remember = (report: ReportDef, filters: Filters) => {
    const item: HistoryItem = {
      id: `${Date.now()}`,
      reportId: report.id,
      name: report.name,
      examination:
        sessionRows.find((row) => row.id === filters.sessionId)?.name || 'All examinations',
      generatedAt: new Date().toISOString(),
      format: report.format,
      generatedBy,
      filters,
    };
    const next = [item, ...history].slice(0, 20);
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const buildReport = async (report: ReportDef, filters: Filters) => {
    if (report.needsExam && !filters.sessionId) {
      throw new Error('Choose an examination and apply the filter first.');
    }
    const examination =
      sessionRows.find((row) => row.id === filters.sessionId)?.name || 'All examinations';
    const analyticsData = await fetchIaAnalytics(filterParams(filters));
    if (report.id === 'subject-averages') {
      return csv(
        ['Paper code', 'Paper', 'Average %', 'Students'],
        (analyticsData.subjectPerformance ?? []).map(
          (row: { paperCode: string; paperName: string; average: number; students: number }) => [
            row.paperCode,
            row.paperName,
            row.average,
            row.students,
          ],
        ),
      );
    }
    if (report.id === 'programme-averages') {
      return csv(
        ['Programme', 'Average %', 'Students with marks'],
        (analyticsData.programmeAverages ?? []).map(
          (row: { name: string; average: number; students: number }) => [
            row.name,
            row.average,
            row.students,
          ],
        ),
      );
    }
    if (report.id === 'top' || report.id === 'lowest') {
      const rows =
        report.id === 'top' ? analyticsData.topPerformers : analyticsData.lowestPerformers;
      return csv(
        ['Roll number', 'Name', 'Programme', 'IA %'],
        (rows ?? []).map(
          (row: {
            rollNumber?: string;
            fullName?: string;
            programme?: string;
            percentage: number;
          }) => [row.rollNumber, row.fullName, row.programme, row.percentage],
        ),
      );
    }
    if (report.id === 'appearance' || report.id === 'selection-summary') {
      return csv(
        ['Metric', 'Value'],
        [
          ['Examination', examination],
          ['Registered students', analyticsData.totalStudents ?? 0],
          ['Appeared', analyticsData.appeared ?? 0],
          ['Absent', analyticsData.absent ?? 0],
          ['Not entered', analyticsData.notEntered ?? 0],
          ['Subjects', analyticsData.subjects ?? 0],
          ['Average IA %', analyticsData.averageScore ?? ''],
          ['Pass %', analyticsData.passPercent ?? ''],
        ],
      );
    }
    if (report.id === 'department-performance') {
      return csv(
        ['Department', 'Students', 'Average IA %', 'Pass %'],
        (analyticsData.departmentPerformance ?? []).map(
          (row: {
            name: string;
            students: number;
            average: number | null;
            passPercent: number | null;
          }) => [row.name, row.students, row.average ?? '', row.passPercent ?? ''],
        ),
      );
    }
    if (report.category === 'defaulters' || report.id === 'attendance-defaulters') {
      const data = await fetchIaDefaulters({
        sessionId: filters.sessionId || undefined,
        programmeCode: filters.programmeCode || undefined,
        departmentId: filters.departmentId || undefined,
        semesterNo: filters.semesterNo ? Number(filters.semesterNo) : undefined,
      });
      const issue =
        report.id === 'attendance-defaulters'
          ? 'attendance'
          : report.id === 'fee-defaulters'
            ? 'fee'
            : report.id === 'library-defaulters'
              ? 'library'
              : report.id === 'academic-defaulters'
                ? 'academic'
                : null;
      const items = (data.items ?? []).filter(
        (row: { issues?: string[] }) => !issue || row.issues?.includes(issue),
      );
      return csv(
        [
          'Roll number',
          'Name',
          'Programme',
          'Department',
          'Semester',
          'IA %',
          'Attendance %',
          'Fee',
          'Library',
          'Issues',
        ],
        items.map(
          (row: {
            rollNumber?: string;
            fullName?: string;
            programme?: string;
            department?: string;
            semesterNo?: number;
            iaPercent?: number;
            attendancePercent?: number;
            feeStatus?: string;
            libraryStatus?: string;
            reasons?: string[];
          }) => [
            row.rollNumber,
            row.fullName,
            row.programme,
            row.department,
            row.semesterNo,
            row.iaPercent,
            row.attendancePercent,
            row.feeStatus,
            row.libraryStatus,
            (row.reasons ?? []).join('; '),
          ],
        ),
      );
    }
    const roster = await fetchIaAdmitStudents(filters.sessionId, {
      programmeCode: filters.programmeCode || undefined,
      departmentId: filters.departmentId || undefined,
    });
    const students = (roster.students ?? []).filter((row: { semesterNos?: number[] }) => {
      if (!filters.semesterNo) return true;
      return (row.semesterNos ?? []).includes(Number(filters.semesterNo));
    });
    if (report.id === 'admit-audit') {
      const audit = await fetchIaAdmitAudit(filters.sessionId);
      return csv(
        ['Roll number', 'Name', 'Admit card', 'Generated', 'Downloads', 'Prints'],
        (audit ?? []).map(
          (row: {
            rollNumber?: string;
            fullName?: string;
            admitCardNumber?: string;
            generatedAt?: string;
            downloadCount?: number;
            printCount?: number;
          }) => [
            row.rollNumber,
            row.fullName,
            row.admitCardNumber,
            row.generatedAt,
            row.downloadCount,
            row.printCount,
          ],
        ),
      );
    }
    const filtered =
      report.id === 'eligible'
        ? students.filter((row: { eligible?: boolean }) => row.eligible)
        : report.id === 'ineligible-students'
          ? students.filter((row: { eligible?: boolean }) => !row.eligible)
          : students;
    return csv(
      ['Roll number', 'Name', 'Programme', 'Department', 'Eligible', 'Admit card', 'Reasons'],
      filtered.map(
        (row: {
          rollNumber?: string;
          fullName?: string;
          programme?: string;
          department?: string;
          eligible?: boolean;
          admitCardNumber?: string;
          ineligibilityReasons?: string[];
        }) => [
          row.rollNumber,
          row.fullName,
          row.programme,
          row.department,
          row.eligible ? 'Eligible' : 'Not eligible',
          row.admitCardNumber,
          (row.ineligibilityReasons ?? []).join('; '),
        ],
      ),
    );
  };

  const run = async (report: ReportDef, mode: 'download' | 'view', filters: Filters = applied) => {
    setBusy(report.id);
    setNotice(null);
    try {
      const file = await buildReport(report, filters);
      if (!file) return;
      if (mode === 'download') {
        downloadText(file, `${report.id}.csv`);
        remember(report, filters);
      } else {
        setPreview({ name: report.name, csv: file });
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This report could not be generated.');
    } finally {
      setBusy(null);
    }
  };

  const downloadSheet = async (
    sheet: { id: string; name: string },
    format: 'xlsx' | 'csv' | 'pdf',
  ) => {
    setBusy(sheet.id + format);
    try {
      const blob = await downloadIaNehuExport(sheet.id, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sheet.name}.${format === 'pdf' ? 'html' : format}`;
      link.click();
      URL.revokeObjectURL(url);
      remember(
        {
          id: `university-${sheet.id}`,
          category: 'university',
          name: sheet.name,
          description: 'NEHU consolidation file',
          format: format === 'xlsx' ? 'XLSX' : format === 'pdf' ? 'PDF' : 'CSV',
        },
        applied,
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'The university file could not be downloaded.',
      );
    } finally {
      setBusy(null);
    }
  };

  if (analytics.isError) {
    return (
      <QueryErrorPanel
        title="Unable to load reports"
        error={analytics.error}
        onRetry={() => void analytics.refetch()}
        isRetrying={analytics.isFetching}
      />
    );
  }

  const summary = analytics.data as { totalStudents?: number; subjects?: number } | undefined;

  return (
    <div className="space-y-4">
      {setHeaderAside ? null : <div className="flex justify-end">{yearControl}</div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          icon={<FileText className="h-5 w-5" />}
          tone="blue"
          label="Total Reports"
          value={REPORTS.length}
          hint="Reports you can generate"
        />
        <Stat
          icon={<Download className="h-5 w-5" />}
          tone="green"
          label="Generated Today"
          value={generatedToday}
          hint="On this browser"
        />
        <Stat
          icon={<Users className="h-5 w-5" />}
          tone="violet"
          label="Total Students"
          value={summary?.totalStudents ?? 0}
          hint="In this selection"
        />
        <Stat
          icon={<BookOpen className="h-5 w-5" />}
          tone="amber"
          label="Subjects Covered"
          value={summary?.subjects ?? 0}
          hint="Scheduled papers"
        />
        <Stat
          icon={<Upload className="h-5 w-5" />}
          tone="rose"
          label="University Reports"
          value={sheetRows.length}
          hint="Consolidation files"
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Filter className="h-4 w-4 text-blue-600" /> Report Filters
            </h2>
            <p className="text-xs text-slate-500">
              These filters are applied when a report is generated.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem(FILTER_KEY, JSON.stringify(draft));
              setNotice('Filter saved on this browser.');
            }}
            className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600"
          >
            <Save className="h-3.5 w-3.5" /> Save Filter
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <Field label="IA Examination">
            <select
              className={selectClass}
              value={draft.sessionId}
              onChange={(event) => setDraft({ ...draft, sessionId: event.target.value })}
            >
              <option value="">All examinations</option>
              {yearSessions.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
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
              {(analytics.data?.programmes ?? []).map((row: { id: string; name: string }) => (
                <option key={row.id} value={row.id}>
                  {row.name}
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
              {(analytics.data?.departments ?? []).map((row: { id: string; name: string }) => (
                <option key={row.id} value={row.id}>
                  {row.name}
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
              {(analytics.data?.semesters ?? []).map((semester: number) => (
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
              {(analytics.data?.shifts ?? []).map((row: { id: string; name: string }) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
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
              setDraft(EMPTY);
              setApplied(EMPTY);
              localStorage.removeItem(FILTER_KEY);
            }}
            className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 px-4 text-sm text-slate-600"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <BookOpen className="h-4 w-4 text-blue-600" /> Report Categories
            </h2>
            <p className="text-xs text-slate-500">
              Choose a category, then generate a report from the current filters.
            </p>
          </div>
          <label className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reports…"
              className="w-40 bg-transparent outline-none"
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {CATEGORIES.map((item) => {
            const count =
              item.id === 'university'
                ? sheetRows.length
                : REPORTS.filter((report) => report.category === item.id).length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
                className={cn(
                  'rounded-2xl p-3 text-left',
                  item.tone,
                  category === item.id && 'ring-2 ring-blue-500',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-xl bg-white/80 p-2">{item.icon}</span>
                  <span className="text-xs font-semibold">
                    {count} {count === 1 ? 'report' : 'reports'}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold">{item.title}</p>
                <p className="text-[11px] opacity-80">{item.description}</p>
              </button>
            );
          })}
        </div>

        {category === 'university' ? (
          <div className="mt-4 space-y-2">
            {sheetRows.length ? (
              sheetRows.map((sheet) => (
                <div
                  key={sheet.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{sheet.name}</p>
                    <p className="text-xs text-slate-400">{sheet.status}</p>
                  </div>
                  <div className="flex gap-2">
                    {(['xlsx', 'csv', 'pdf'] as const).map((format) => (
                      <button
                        key={format}
                        type="button"
                        disabled={busy === sheet.id + format}
                        onClick={() => void downloadSheet(sheet, format)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600"
                      >
                        {format.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="py-4 text-sm text-slate-500">
                No consolidation file yet.{' '}
                <Link href={`${BASE}/nehu-submission`} className="font-medium text-blue-600">
                  Open University Submission
                </Link>{' '}
                after a consolidation sheet is generated.
              </p>
            )}
          </div>
        ) : null}

        {visibleReports.length ? (
          <ul className="mt-4 divide-y divide-slate-100">
            {visibleReports.map((report) => (
              <li
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{report.name}</p>
                  <p className="text-xs text-slate-500">{report.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {report.format}
                  </span>
                  <button
                    type="button"
                    disabled={busy === report.id}
                    onClick={() => void run(report, 'view')}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs text-slate-600"
                  >
                    <Eye className="h-3.5 w-3.5" /> View
                  </button>
                  <button
                    type="button"
                    disabled={busy === report.id}
                    onClick={() => void run(report, 'download')}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-2 text-xs font-semibold text-white"
                  >
                    <Download className="h-3.5 w-3.5" /> Generate
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        {notice ? <p className="mt-2 text-xs text-slate-500">{notice}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <History className="h-4 w-4 text-blue-600" /> Recent Reports
        </h2>
        {history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-3">Report</th>
                  <th className="py-2 pr-3">Examination</th>
                  <th className="py-2 pr-3">Generated by</th>
                  <th className="py-2 pr-3">Generated on</th>
                  <th className="py-2 pr-3">Format</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => {
                  const report = REPORTS.find((row) => row.id === item.reportId);
                  return (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="py-2 pr-2 text-slate-400">{index + 1}</td>
                      <td className="py-2 pr-3 font-medium text-slate-800">{item.name}</td>
                      <td className="py-2 pr-3 text-slate-600">{item.examination}</td>
                      <td className="py-2 pr-3 text-slate-600">{item.generatedBy}</td>
                      <td className="py-2 pr-3 text-slate-600">
                        {new Date(item.generatedAt).toLocaleString('en-IN')}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {item.format}
                        </span>
                      </td>
                      <td className="py-2">
                        {report ? (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="text-xs font-medium text-blue-600"
                              onClick={() => void run(report, 'download', item.filters)}
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              className="text-xs font-medium text-slate-500"
                              onClick={() => void run(report, 'view', item.filters)}
                            >
                              View
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Open University Submission</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-sm text-slate-500">Reports you generate will appear here.</p>
        )}
      </section>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">{preview.name}</h3>
              <button
                type="button"
                className="text-xs text-slate-500"
                onClick={() => setPreview(null)}
              >
                Close
              </button>
            </div>
            <pre className="whitespace-pre-wrap text-xs text-slate-700">
              {preview.csv.split('\n').slice(0, 40).join('\n')}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const selectClass =
  'mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none';

function filterParams(filters: Filters) {
  return {
    sessionId: filters.sessionId || undefined,
    programmeCode: filters.programmeCode || undefined,
    departmentId: filters.departmentId || undefined,
    semesterNo: filters.semesterNo ? Number(filters.semesterNo) : undefined,
    shiftId: filters.shiftId || undefined,
  };
}

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
  tone: 'blue' | 'green' | 'violet' | 'amber' | 'rose';
  label: string;
  value: number;
  hint: string;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-500',
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

function csv(header: string[], rows: Array<Array<string | number | null | undefined>>) {
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','),
    ),
  ];
  return lines.join('\n');
}

function downloadText(contents: string, filename: string) {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
