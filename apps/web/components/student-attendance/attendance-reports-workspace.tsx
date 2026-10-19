'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, FileText, Loader2, Printer } from 'lucide-react';

import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchAcademicDepartments, fetchAcademicYears } from '@/services/organization';
import { fetchCourses } from '@/services/programs';
import {
  exportStudentAttendanceReport,
  fetchStudentAttendanceReport,
} from '@/services/student-attendance';
import { downloadBlob } from '@/utils/download-blob';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const REPORTS = [
  ['monthly', 'Monthly'],
  ['cumulative', 'Semester / cumulative'],
  ['daily', 'Daily'],
  ['semester', 'Semester subjects'],
  ['subject', 'Subject'],
  ['statement', 'Student statement'],
  ['absentees', 'Absentees'],
  ['shortage', 'Shortage'],
  ['defaulters', 'Defaulters'],
  ['register', 'Register'],
  ['period', 'Period'],
  ['department', 'Department'],
  ['faculty-submission', 'Faculty submission'],
  ['timetable-gap', 'Timetable gaps'],
  ['dashboard', 'Dashboard'],
  ['audit', 'Audit'],
] as const;

type ReportKind = (typeof REPORTS)[number][0];

type ReportRow = {
  studentId: string;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
  fullName: string;
  subject?: string | null;
  semesterNo?: number | null;
  classLabel?: string | null;
  departmentName?: string | null;
  totalSessions: number;
  presentCount: number;
  attendedCount?: number;
  absentCount: number;
  leaveCount?: number;
  dutyCount?: number;
  percentage: number;
  eligibilityStatus?: string;
  subjectName?: string;
  status?: string;
  band?: string;
  classesStillNeeded?: number;
};

type GroupSummary = {
  key: string;
  label: string;
  students: number;
  classes: number;
  conducted: number;
  attended: number;
  absent: number;
  leave: number;
  duty: number;
  percentage: number;
};

type ReportPayload = {
  type: string;
  institutionName?: string;
  academicYear?: string | null;
  from: string;
  to: string;
  generatedAt?: string;
  attendanceMode: string;
  calculation?: string;
  aggregationUnit?: 'PERIOD' | 'DAY' | 'SESSION';
  unitLabels?: {
    working: string;
    present: string;
    absent: string;
    percentageHint: string;
  };
  summary: Record<string, number>;
  rows: ReportRow[];
  subjectSummaries?: GroupSummary[];
  classSummaries?: GroupSummary[];
  departmentSummaries?: GroupSummary[];
  semesterSummaries?: GroupSummary[];
  dateColumns?: string[];
  registerRows?: Array<Record<string, string | number | null>>;
};

const TITLES: Record<ReportKind, string> = {
  monthly: 'Monthly Attendance Report',
  cumulative: 'Cumulative Attendance Report',
  daily: 'Daily Attendance Report',
  semester: 'Semester Attendance Report',
  subject: 'Subject Attendance Report',
  statement: 'Student Attendance Statement',
  absentees: 'Absentee Report',
  shortage: 'Attendance Shortage Report',
  defaulters: 'Attendance Defaulters',
  register: 'Attendance Register',
  period: 'Period-wise Attendance',
  department: 'Department Attendance',
  'faculty-submission': 'Faculty Submission Report',
  'timetable-gap': 'Timetable vs Attendance',
  dashboard: 'Attendance Analytics',
  audit: 'Attendance Audit',
};

const fieldClass = 'mt-1 block h-9 rounded-lg border border-border bg-background px-2 text-sm';

export function AttendanceReportsWorkspace({ kind: initialKind }: { kind: ReportKind }) {
  const [kind, setKind] = useState<ReportKind>(initialKind);
  const session = useRequireAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [academicYearId, setAcademicYearId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [semesterNo, setSemesterNo] = useState('');
  const [courseId, setCourseId] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | 'pdf' | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const yearsQ = useQuery({
    queryKey: ['org', 'academic-years'],
    queryFn: fetchAcademicYears,
    enabled: Boolean(session),
  });
  const departmentsQ = useQuery({
    queryKey: ['org', 'departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
    enabled: Boolean(session),
  });
  useEffect(() => {
    if (academicYearId || !yearsQ.data?.length) return;
    const today = new Date().toISOString().slice(0, 10);
    const covering = yearsQ.data.find(
      (item) => item.startDate.slice(0, 10) <= today && item.endDate.slice(0, 10) >= today,
    );
    const active = yearsQ.data.find((item) => item.status === 'ACTIVE');
    const chosen = covering ?? active ?? yearsQ.data[0];
    if (!chosen) return;
    setAcademicYearId(chosen.id);
    if (initialKind === 'cumulative') {
      const start = chosen.startDate.slice(0, 10);
      const end = chosen.endDate.slice(0, 10);
      setFrom(start);
      setTo(end < today ? end : today);
    }
  }, [academicYearId, initialKind, yearsQ.data]);

  useEffect(() => {
    setPage(1);
  }, [kind, academicYearId, departmentId, semesterNo, courseId, from, to, month, year]);

  const coursesQ = useQuery({
    queryKey: ['courses', 'attendance-report', departmentId],
    queryFn: () => fetchCourses({ departmentId: departmentId || undefined, limit: 100, page: 1 }),
    enabled: Boolean(session),
  });

  const params = useMemo(() => {
    const shared: Record<string, string | number | undefined> = {
      academicYearId: academicYearId || undefined,
      departmentId: departmentId || undefined,
      semesterNo: semesterNo ? Number(semesterNo) : undefined,
      courseId: courseId || undefined,
    };
    if (kind === 'monthly') return { ...shared, month, year };
    return { ...shared, from, to };
  }, [academicYearId, courseId, departmentId, from, kind, month, semesterNo, to, year]);

  const reportQ = useQuery({
    queryKey: ['student-attendance', 'report', kind, params],
    queryFn: () => fetchStudentAttendanceReport(kind, params),
    enabled: Boolean(session),
  });

  const report = (reportQ.data ?? null) as ReportPayload | null;
  const rows = useMemo(() => {
    const source = report?.rows ?? [];
    const needle = studentQuery.trim().toLowerCase();
    if (!needle) return source;
    return source.filter((row) =>
      `${row.fullName} ${row.rollNumber ?? ''} ${row.enrollmentNumber ?? ''}`
        .toLowerCase()
        .includes(needle),
    );
  }, [report?.rows, studentQuery]);

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const averagePercentage = useMemo(() => {
    if (typeof report?.summary?.averagePercentage === 'number') {
      return report.summary.averagePercentage;
    }
    if (!rows.length) return 0;
    return rows.reduce((sum, row) => sum + Number(row.percentage || 0), 0) / rows.length;
  }, [report?.summary?.averagePercentage, rows]);

  if (!session) return null;

  const exportReport = async (format: 'xlsx' | 'csv' | 'pdf') => {
    setExporting(format);
    setError('');
    try {
      const blob = await exportStudentAttendanceReport(kind, params, format);
      downloadBlob(blob, `${kind}-attendance.${format}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Export failed'));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {report?.institutionName ?? 'Attendance'}
          </p>
          <h1 className="text-xl font-semibold">{TITLES[kind]}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {report?.calculation ??
              'Percentages use classes that were actually conducted. Holidays and cancelled classes stay out of the total.'}
            {report?.from && report?.to ? ` Period ${report.from} to ${report.to}.` : ''}
            {report?.generatedAt
              ? ` Generated ${new Date(report.generatedAt).toLocaleString('en-IN')}.`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting === 'csv'}
            onClick={() => exportReport('csv')}
          >
            {exporting === 'csv' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting === 'pdf'}
            onClick={() => exportReport('pdf')}
          >
            {exporting === 'pdf' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            PDF
          </Button>
          <Button size="sm" disabled={exporting === 'xlsx'} onClick={() => exportReport('xlsx')}>
            {exporting === 'xlsx' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Excel
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {REPORTS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold',
              kind === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card',
            )}
            onClick={() => {
              setKind(value);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
        <a
          className="rounded-full border border-border px-3 py-1 text-xs font-semibold"
          href="/admin/staff/attendance/audit"
        >
          Staff audit
        </a>
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-3">
        <label className="text-xs text-muted-foreground">
          Academic year
          <select
            className={fieldClass}
            value={academicYearId}
            onChange={(event) => setAcademicYearId(event.target.value)}
          >
            <option value="">Current / all</option>
            {(yearsQ.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {kind === 'monthly' ? (
          <>
            <label className="text-xs text-muted-foreground">
              Month
              <select
                className={fieldClass}
                value={month}
                onChange={(event) => setMonth(Number(event.target.value))}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {new Date(2000, value - 1, 1).toLocaleString('en', { month: 'long' })}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Year
              <input
                type="number"
                className={`${fieldClass} w-28`}
                value={year}
                onChange={(event) => setYear(Number(event.target.value))}
              />
            </label>
          </>
        ) : (
          <>
            <label className="text-xs text-muted-foreground">
              From
              <input
                type="date"
                className={fieldClass}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              To
              <input
                type="date"
                className={fieldClass}
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </>
        )}
        <label className="text-xs text-muted-foreground">
          Department
          <select
            className={fieldClass}
            value={departmentId}
            onChange={(event) => {
              setDepartmentId(event.target.value);
              setCourseId('');
            }}
          >
            <option value="">All departments</option>
            {(departmentsQ.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Semester
          <select
            className={fieldClass}
            value={semesterNo}
            onChange={(event) => setSemesterNo(event.target.value)}
          >
            <option value="">All semesters</option>
            {Array.from({ length: 8 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                Semester {value}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Subject
          <select
            className={fieldClass}
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
          >
            <option value="">All subjects</option>
            {(coursesQ.data?.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} {item.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Student
          <input
            className={fieldClass}
            value={studentQuery}
            placeholder="Name or roll"
            onChange={(event) => {
              setStudentQuery(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {reportQ.isError ? (
        <QueryErrorPanel
          title="Unable to load attendance report"
          error={reportQ.error}
          onRetry={() => void reportQ.refetch()}
          isRetrying={reportQ.isFetching}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards(kind, report, rows, averagePercentage).map((card) => (
          <SummaryCard key={card.label} label={card.label} value={card.value} tone={card.tone} />
        ))}
      </div>

      {report?.dateColumns?.length ? (
        <div className="overflow-auto rounded-2xl border border-border">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/40 text-left uppercase text-muted-foreground">
              <tr>
                <th className="sticky left-0 bg-muted/40 px-3 py-2">Student</th>
                {report.dateColumns.map((date) => (
                  <th key={date} className="px-2 py-2">
                    {date.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(report.registerRows ?? []).map((row, index) => (
                <tr key={`${row.studentId}-${index}`} className="border-t border-border">
                  <td className="sticky left-0 bg-card px-3 py-2">{row.fullName}</td>
                  {report.dateColumns?.map((date) => (
                    <td key={date} className="px-2 py-2 font-mono">
                      {row[date] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ReportTable
        rows={visibleRows}
        total={rows.length}
        page={safePage}
        pageCount={pageCount}
        pageSize={pageSize}
        onPage={setPage}
        onPageSize={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        loading={reportQ.isLoading}
        showStatus={kind === 'defaulters'}
        showClass={kind === 'cumulative' || kind === 'monthly'}
        unitLabel={report?.unitLabels?.working ?? 'Conducted'}
      />

      <SummaryTable title="Subject summary" rows={report?.subjectSummaries ?? []} />
      <SummaryTable title="Class summary" rows={report?.classSummaries ?? []} />
      {kind === 'cumulative' ? (
        <>
          <SummaryTable title="Department summary" rows={report?.departmentSummaries ?? []} />
          <SummaryTable title="Semester summary" rows={report?.semesterSummaries ?? []} />
        </>
      ) : null}
    </div>
  );
}

function displayStudentName(row: ReportRow) {
  const name = String(row.fullName ?? '').trim();
  if (name && name !== 'Student') return name;
  return row.rollNumber || row.enrollmentNumber || 'Name not on profile';
}

function summaryCards(
  kind: ReportKind,
  report: ReportPayload | null,
  rows: ReportRow[],
  averagePercentage: number,
) {
  const average = `${Number(averagePercentage || 0).toFixed(2)}%`;
  if (kind === 'daily') {
    return [
      {
        label: 'Students',
        value: report?.summary?.students ?? new Set(rows.map((row) => row.studentId)).size,
        tone: 'slate',
      },
      { label: 'Present', value: report?.summary?.present ?? 0, tone: 'green' },
      { label: 'Absent', value: report?.summary?.absent ?? 0, tone: 'rose' },
      { label: 'Average attendance', value: average, tone: 'amber' },
    ];
  }
  if (kind === 'defaulters') {
    return [
      { label: 'Students', value: rows.length, tone: 'slate' },
      { label: 'Working days', value: report?.summary?.workingDays ?? '—', tone: 'blue' },
      { label: 'Conducted classes', value: report?.summary?.conductedClasses ?? 0, tone: 'green' },
      { label: 'Detained', value: report?.summary?.detained ?? rows.length, tone: 'rose' },
    ];
  }
  return [
    { label: 'Students', value: report?.summary?.students ?? rows.length, tone: 'slate' },
    { label: 'Working days', value: report?.summary?.workingDays ?? '—', tone: 'blue' },
    {
      label: 'Conducted classes',
      value: report?.summary?.conductedClasses ?? report?.summary?.sessions ?? 0,
      tone: 'green',
    },
    { label: 'Average attendance', value: average, tone: 'rose' },
  ];
}

function ReportTable({
  rows,
  total,
  page,
  pageCount,
  pageSize,
  onPage,
  onPageSize,
  loading,
  showStatus,
  showClass,
  unitLabel,
}: {
  rows: ReportRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  loading: boolean;
  showStatus: boolean;
  showClass: boolean;
  unitLabel: string;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="overflow-auto rounded-2xl border border-border">
      <table className="min-w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Roll</th>
            <th className="px-3 py-2">Student</th>
            {showClass ? <th className="px-3 py-2">Class</th> : null}
            <th className="px-3 py-2">{unitLabel}</th>
            <th className="px-3 py-2">Attended</th>
            <th className="px-3 py-2">Absent</th>
            <th className="px-3 py-2">Leave</th>
            <th className="px-3 py-2">On duty</th>
            <th className="px-3 py-2">%</th>
            <th className="px-3 py-2">Details</th>
            {showStatus ? <th className="px-3 py-2">Status</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.studentId}-${index}`} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs">{row.rollNumber ?? '—'}</td>
              <td className="px-3 py-2">
                <div className="font-medium">{displayStudentName(row)}</div>
                {row.departmentName ? (
                  <div className="text-xs text-muted-foreground">{row.departmentName}</div>
                ) : null}
              </td>
              {showClass ? (
                <td className="px-3 py-2 text-xs">
                  {[row.semesterNo ? `Semester ${row.semesterNo}` : '', row.classLabel]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </td>
              ) : null}
              <td className="px-3 py-2">{row.totalSessions}</td>
              <td className="px-3 py-2">{row.attendedCount ?? row.presentCount}</td>
              <td className="px-3 py-2">{row.absentCount}</td>
              <td className="px-3 py-2">{row.leaveCount ?? 0}</td>
              <td className="px-3 py-2">{row.dutyCount ?? 0}</td>
              <td className="px-3 py-2">
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    row.percentage < 65
                      ? 'bg-rose-100 text-rose-700'
                      : row.percentage < 75
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800',
                  )}
                >
                  {Number(row.percentage || 0).toFixed(2)}%
                </span>
              </td>
              <td className="px-3 py-2 text-xs">
                {[
                  row.subjectName || row.subject,
                  row.status,
                  row.band,
                  row.classesStillNeeded ? `${row.classesStillNeeded} needed` : '',
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </td>
              {showStatus ? (
                <td className="px-3 py-2 text-xs">{row.eligibilityStatus ?? '—'}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && total === 0 ? (
        <p className="px-3 py-6 text-sm text-muted-foreground">
          No attendance rows for the selected period.
        </p>
      ) : null}
      {loading ? (
        <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading report…
        </p>
      ) : null}
      {total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>
            Showing {from} to {to} of {total} students
          </span>
          <div className="flex items-center gap-2">
            <select
              className="h-8 rounded-md border border-border bg-background px-2"
              value={pageSize}
              onChange={(event) => onPageSize(Number(event.target.value))}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPage(page - 1)}
            >
              Previous
            </Button>
            <span>
              {page} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => onPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryTable({ title, rows }: { title: string; rows: GroupSummary[] }) {
  if (!rows.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="overflow-auto rounded-2xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Group</th>
              <th className="px-3 py-2">Students</th>
              <th className="px-3 py-2">Classes</th>
              <th className="px-3 py-2">Attended</th>
              <th className="px-3 py-2">Absent</th>
              <th className="px-3 py-2">Leave</th>
              <th className="px-3 py-2">On duty</th>
              <th className="px-3 py-2">%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <td className="px-3 py-2">{row.label}</td>
                <td className="px-3 py-2">{row.students}</td>
                <td className="px-3 py-2">{row.classes}</td>
                <td className="px-3 py-2">{row.attended}</td>
                <td className="px-3 py-2">{row.absent}</td>
                <td className="px-3 py-2">{row.leave}</td>
                <td className="px-3 py-2">{row.duty}</td>
                <td className="px-3 py-2">{Number(row.percentage).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: string;
}) {
  const toneClass =
    tone === 'blue'
      ? 'bg-sky-50'
      : tone === 'green'
        ? 'bg-emerald-50'
        : tone === 'rose'
          ? 'bg-rose-50'
          : tone === 'amber'
            ? 'bg-amber-50'
            : 'bg-card';
  return (
    <div className={cn('rounded-2xl border border-border p-4', toneClass)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
