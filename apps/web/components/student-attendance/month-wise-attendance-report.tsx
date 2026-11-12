'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, FileText, Loader2, Printer } from 'lucide-react';

import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchAcademicDepartments, fetchAcademicYears } from '@/services/organization';
import { fetchAllPrograms, fetchCourses } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import {
  exportMonthWiseAttendance,
  fetchMonthWiseAttendanceOptions,
  fetchMonthWiseAttendanceReport,
  type MonthWiseAttendanceReport as ReportPayload,
  type MonthWiseCell,
} from '@/services/student-attendance';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { downloadBlob } from '@/utils/download-blob';

const fieldClass =
  'mt-1 block h-9 w-full rounded-lg border border-border bg-background px-2 text-sm';

type Filters = {
  academicYearId: string;
  programId: string;
  departmentId: string;
  semesterNo: string;
  offeringSectionId: string;
  courseId: string;
  shiftId: string;
  fromMonth: string;
  toMonth: string;
  attendanceType: 'policy' | 'period' | 'day';
};

type SortMode = 'roll' | 'low' | 'high';
type AttendanceBand =
  | 'all'
  | 'below-50'
  | 'below-60'
  | 'below-65'
  | 'below-70'
  | 'below-75'
  | 'below-80'
  | 'above-75'
  | 'above-80'
  | 'at-least-75'
  | 'custom';

const PERCENT_OPTIONS: Array<{ id: AttendanceBand; label: string }> = [
  { id: 'all', label: 'All students' },
  { id: 'below-50', label: 'Below 50%' },
  { id: 'below-60', label: 'Below 60%' },
  { id: 'below-65', label: 'Below 65%' },
  { id: 'below-70', label: 'Below 70%' },
  { id: 'below-75', label: 'Below 75%' },
  { id: 'below-80', label: 'Below 80%' },
  { id: 'above-75', label: 'Above 75%' },
  { id: 'above-80', label: 'Above 80%' },
  { id: 'at-least-75', label: '75% and above' },
  { id: 'custom', label: 'Custom percentage range' },
];

function monthOptions(startDate?: string, endDate?: string) {
  const now = new Date();
  const start = startDate
    ? new Date(`${startDate.slice(0, 10)}T00:00:00Z`)
    : new Date(Date.UTC(now.getFullYear() - 1, 0, 1));
  const end = endDate
    ? new Date(`${endDate.slice(0, 10)}T00:00:00Z`)
    : new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  const options: Array<{ key: string; label: string }> = [];
  while (cursor <= last && options.length < 18) {
    const key = cursor.toISOString().slice(0, 7);
    options.push({
      key,
      label: cursor.toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return options;
}

function toneClass(tone: MonthWiseCell['tone']) {
  if (tone === 'red') return 'bg-rose-200 text-rose-900';
  if (tone === 'light-red') return 'bg-red-100 text-red-800';
  if (tone === 'orange') return 'bg-orange-100 text-orange-800';
  if (tone === 'green') return 'bg-emerald-100 text-emerald-800';
  return 'bg-muted text-muted-foreground';
}

function parsePercent(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function percentageBounds(band: AttendanceBand, customMin: string, customMax: string) {
  if (band === 'below-50') return { min: null, max: 50, minInclusive: false, maxInclusive: false };
  if (band === 'below-60') return { min: null, max: 60, minInclusive: false, maxInclusive: false };
  if (band === 'below-65') return { min: null, max: 65, minInclusive: false, maxInclusive: false };
  if (band === 'below-70') return { min: null, max: 70, minInclusive: false, maxInclusive: false };
  if (band === 'below-75') return { min: null, max: 75, minInclusive: false, maxInclusive: false };
  if (band === 'below-80') return { min: null, max: 80, minInclusive: false, maxInclusive: false };
  if (band === 'above-75') return { min: 75, max: null, minInclusive: false, maxInclusive: false };
  if (band === 'above-80') return { min: 80, max: null, minInclusive: false, maxInclusive: false };
  if (band === 'at-least-75')
    return { min: 75, max: null, minInclusive: true, maxInclusive: false };
  if (band === 'custom') {
    return {
      min: parsePercent(customMin),
      max: parsePercent(customMax),
      minInclusive: true,
      maxInclusive: true,
    };
  }
  return { min: null, max: null, minInclusive: true, maxInclusive: true };
}

function matchesPercentage(percentage: number | null, bounds: ReturnType<typeof percentageBounds>) {
  if (bounds.min == null && bounds.max == null) return true;
  if (percentage == null || Number.isNaN(percentage)) return false;
  if (bounds.min != null) {
    const belowMin = bounds.minInclusive ? percentage < bounds.min : percentage <= bounds.min;
    if (belowMin) return false;
  }
  if (bounds.max != null) {
    const aboveMax = bounds.maxInclusive ? percentage > bounds.max : percentage >= bounds.max;
    if (aboveMax) return false;
  }
  return true;
}

function attendanceFilterLabel(band: AttendanceBand, customMin: string, customMax: string) {
  if (band === 'custom') {
    const min = customMin.trim();
    const max = customMax.trim();
    if (min && max) return `Custom ${min}% to ${max}%`;
    if (min) return `Custom from ${min}%`;
    if (max) return `Custom up to ${max}%`;
    return 'Custom percentage range';
  }
  return PERCENT_OPTIONS.find((item) => item.id === band)?.label ?? 'All students';
}

function countWhere(rows: ReportPayload['rows'], test: (percentage: number) => boolean) {
  return rows.filter((row) => row.overall.percentage != null && test(row.overall.percentage))
    .length;
}

function studentLabel(row: ReportPayload['rows'][number]) {
  const name = row.fullName?.trim();
  if (name && name !== 'Student') return name;
  return row.rollNumber || row.enrollmentNumber || 'Student record not linked';
}

export function MonthWiseAttendanceReport() {
  const session = useRequireAuth();
  const today = new Date();
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [filters, setFilters] = useState<Filters>({
    academicYearId: '',
    programId: '',
    departmentId: '',
    semesterNo: '',
    offeringSectionId: '',
    courseId: '',
    shiftId: '',
    fromMonth: thisMonth,
    toMonth: thisMonth,
    attendanceType: 'policy',
  });
  const [submitted, setSubmitted] = useState<Filters | null>(null);
  const [nameQuery, setNameQuery] = useState('');
  const [rollQuery, setRollQuery] = useState('');
  const [tableDepartment, setTableDepartment] = useState('');
  const [tableProgramme, setTableProgramme] = useState('');
  const [tableSemester, setTableSemester] = useState('');
  const [band, setBand] = useState<AttendanceBand>('all');
  const [customMin, setCustomMin] = useState('');
  const [customMax, setCustomMax] = useState('');
  const [sort, setSort] = useState<SortMode>('roll');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<ReportPayload['rows'][number] | null>(null);
  const [exporting, setExporting] = useState<'filtered-xlsx' | 'all-xlsx' | 'pdf' | null>(null);
  const [error, setError] = useState('');

  const yearsQ = useQuery({
    queryKey: ['org', 'academic-years'],
    queryFn: fetchAcademicYears,
    enabled: Boolean(session),
  });
  const programsQ = useQuery({
    queryKey: ['programs', 'month-wise'],
    queryFn: () => fetchAllPrograms(),
    enabled: Boolean(session),
  });
  const departmentsQ = useQuery({
    queryKey: ['org', 'departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
    enabled: Boolean(session),
  });
  const shiftsQ = useQuery({
    queryKey: ['shifts', 'month-wise'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
    enabled: Boolean(session),
  });
  const sectionsQ = useQuery({
    queryKey: ['attendance', 'month-wise', 'options'],
    queryFn: fetchMonthWiseAttendanceOptions,
    enabled: Boolean(session),
  });
  const coursesQ = useQuery({
    queryKey: ['courses', 'month-wise', filters.departmentId],
    queryFn: () =>
      fetchCourses({ departmentId: filters.departmentId || undefined, limit: 100, page: 1 }),
    enabled: Boolean(session),
  });

  const year = yearsQ.data?.find((item) => item.id === filters.academicYearId);
  const months = monthOptions(year?.startDate, year?.endDate);

  const params = useMemo(() => {
    if (!submitted) return null;
    return {
      academicYearId: submitted.academicYearId || undefined,
      programId: submitted.programId || undefined,
      departmentId: submitted.departmentId || undefined,
      semesterNo: submitted.semesterNo ? Number(submitted.semesterNo) : undefined,
      offeringSectionId: submitted.offeringSectionId || undefined,
      courseId: submitted.courseId || undefined,
      shiftId: submitted.shiftId || undefined,
      allShifts: submitted.shiftId ? undefined : 'true',
      fromMonth: submitted.fromMonth,
      toMonth: submitted.toMonth,
      attendanceType: submitted.attendanceType,
    };
  }, [submitted]);

  const reportQ = useQuery({
    queryKey: ['student-attendance', 'month-wise', params],
    queryFn: () => fetchMonthWiseAttendanceReport(params ?? {}),
    enabled: Boolean(session && params),
  });
  const report = reportQ.data ?? null;

  const bounds = percentageBounds(band, customMin, customMax);
  const customInvalid =
    band === 'custom' && bounds.min != null && bounds.max != null && bounds.min > bounds.max;
  const cohort = useMemo(() => {
    const source = report?.rows ?? [];
    const name = nameQuery.trim().toLowerCase();
    const roll = rollQuery.trim().toLowerCase();
    return source.filter((row) => {
      if (name && !row.fullName.toLowerCase().includes(name)) return false;
      if (roll) {
        const haystack = `${row.rollNumber ?? ''} ${row.enrollmentNumber ?? ''}`.toLowerCase();
        if (!haystack.includes(roll)) return false;
      }
      if (tableDepartment && (row.departmentName ?? '') !== tableDepartment) return false;
      if (tableProgramme && (row.programmeName ?? '') !== tableProgramme) return false;
      if (tableSemester && String(row.semesterNo ?? '') !== tableSemester) return false;
      return true;
    });
  }, [report?.rows, nameQuery, rollQuery, tableDepartment, tableProgramme, tableSemester]);
  const visible = useMemo(() => {
    const filtered = customInvalid
      ? []
      : cohort.filter((row) => matchesPercentage(row.overall.percentage, bounds));
    return [...filtered].sort((left, right) => {
      if (sort === 'roll') {
        return String(left.rollNumber ?? '').localeCompare(
          String(right.rollNumber ?? ''),
          undefined,
          {
            numeric: true,
            sensitivity: 'base',
          },
        );
      }
      const a = left.overall.percentage;
      const b = right.overall.percentage;
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return sort === 'low' ? a - b : b - a;
    });
  }, [cohort, bounds, customInvalid, sort]);
  const bandCounts = {
    total: cohort.length,
    below50: countWhere(cohort, (percentage) => percentage < 50),
    below60: countWhere(cohort, (percentage) => percentage < 60),
    below75: countWhere(cohort, (percentage) => percentage < 75),
    atLeast75: countWhere(cohort, (percentage) => percentage >= 75),
  };

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = visible.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (!session) return null;

  const set = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));

  const generate = () => {
    if (!filters.fromMonth || !filters.toMonth) {
      setError('Choose a from month and a to month.');
      return;
    }
    if (filters.fromMonth > filters.toMonth) {
      setError('From month must not be after to month.');
      return;
    }
    setError('');
    setPage(1);
    setBand('all');
    setNameQuery('');
    setRollQuery('');
    setTableDepartment('');
    setTableProgramme('');
    setTableSemester('');
    setSubmitted({ ...filters });
  };

  const filterLabel = attendanceFilterLabel(band, customMin, customMax);
  const landscape = (report?.months.length ?? 0) >= 3;

  const exportReport = async (format: 'xlsx' | 'pdf', scope: 'filtered' | 'all') => {
    if (!params || !report) return;
    if (scope === 'filtered' && customInvalid) {
      setError('Minimum attendance cannot be higher than the maximum.');
      return;
    }
    if (scope === 'filtered' && !visible.length) {
      setError('No students match the current filters.');
      return;
    }
    const key = format === 'pdf' ? 'pdf' : scope === 'filtered' ? 'filtered-xlsx' : 'all-xlsx';
    setExporting(key);
    setError('');
    try {
      const blob = await exportMonthWiseAttendance({
        ...params,
        format,
        attendanceFilter: scope === 'filtered' ? filterLabel : 'All students',
        studentIds: scope === 'filtered' ? visible.map((row) => row.studentId) : undefined,
      });
      const suffix = scope === 'filtered' ? 'filtered' : 'all';
      downloadBlob(blob, `cumulative-attendance-${suffix}.${format}`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Export failed'));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="month-wise-print space-y-4">
      <style>{`@media print { @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm 10mm 16mm; @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 9pt; } } header, aside { display: none !important; } #erp-main-scroll { overflow: visible !important; height: auto !important; } .month-wise-print table { width: 100%; border-collapse: collapse; font-size: ${landscape ? '8pt' : '10pt'}; } .month-wise-print th, .month-wise-print td { border: 1px solid #cbd5e1; padding: 3px 4px; vertical-align: top; } .month-wise-print thead { display: table-header-group; } .month-wise-print tr { break-inside: avoid; page-break-inside: avoid; } }`}</style>
      <div className="print:hidden">
        <h2 className="text-lg font-semibold">Month-wise cumulative attendance</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Each month shows classes attended / classes marked. The overall percentage uses those
          totals, not an average of the monthly percentages. Shortage filters use that overall
          percentage.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2 xl:grid-cols-5 print:hidden">
        <Filter label="Academic year">
          <select
            className={fieldClass}
            value={filters.academicYearId}
            onChange={(event) => {
              const academicYearId = event.target.value;
              const chosen = yearsQ.data?.find((item) => item.id === academicYearId);
              const range = monthOptions(chosen?.startDate, chosen?.endDate);
              set({
                academicYearId,
                fromMonth: range[0]?.key ?? filters.fromMonth,
                toMonth: range[range.length - 1]?.key ?? filters.toMonth,
              });
            }}
          >
            <option value="">All years</option>
            {(yearsQ.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Programme">
          <select
            className={fieldClass}
            value={filters.programId}
            onChange={(event) => set({ programId: event.target.value })}
          >
            <option value="">All programmes</option>
            {(programsQ.data?.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} {item.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Department">
          <select
            className={fieldClass}
            value={filters.departmentId}
            onChange={(event) => set({ departmentId: event.target.value, courseId: '' })}
          >
            <option value="">All departments</option>
            {(departmentsQ.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Semester">
          <select
            className={fieldClass}
            value={filters.semesterNo}
            onChange={(event) => set({ semesterNo: event.target.value })}
          >
            <option value="">All semesters</option>
            {Array.from({ length: 8 }, (_, index) => index + 1).map((value) => (
              <option key={value} value={value}>
                Semester {value}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Section / class">
          <select
            className={fieldClass}
            value={filters.offeringSectionId}
            onChange={(event) => set({ offeringSectionId: event.target.value })}
          >
            <option value="">All sections</option>
            {(sectionsQ.data?.sections ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Subject">
          <select
            className={fieldClass}
            value={filters.courseId}
            onChange={(event) => set({ courseId: event.target.value })}
          >
            <option value="">All subjects</option>
            {(coursesQ.data?.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} {item.title}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Shift">
          <select
            className={fieldClass}
            value={filters.shiftId}
            onChange={(event) => set({ shiftId: event.target.value })}
          >
            <option value="">All shifts</option>
            {(shiftsQ.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="From month">
          <select
            className={fieldClass}
            value={filters.fromMonth}
            onChange={(event) => set({ fromMonth: event.target.value })}
          >
            {months.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="To month">
          <select
            className={fieldClass}
            value={filters.toMonth}
            onChange={(event) => set({ toMonth: event.target.value })}
          >
            {months.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Attendance type">
          <select
            className={fieldClass}
            value={filters.attendanceType}
            onChange={(event) =>
              set({ attendanceType: event.target.value as Filters['attendanceType'] })
            }
          >
            <option value="policy">College rule</option>
            <option value="period">Each marked period</option>
            <option value="day">One class per day</option>
          </select>
        </Filter>
        <div className="flex items-end">
          <Button className="w-full" onClick={generate} disabled={reportQ.isFetching}>
            {reportQ.isFetching ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Generate Report
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600 print:hidden">{error}</p> : null}
      {reportQ.isError ? (
        <QueryErrorPanel
          error={reportQ.error}
          onRetry={() => reportQ.refetch()}
          isRetrying={reportQ.isFetching}
        />
      ) : null}

      {report ? (
        <ReportBody
          report={report}
          rows={pageRows}
          printRows={visible}
          total={visible.length}
          page={safePage}
          pageCount={pageCount}
          pageSize={pageSize}
          sort={sort}
          band={band}
          customMin={customMin}
          customMax={customMax}
          customInvalid={customInvalid}
          nameQuery={nameQuery}
          rollQuery={rollQuery}
          tableDepartment={tableDepartment}
          tableProgramme={tableProgramme}
          tableSemester={tableSemester}
          bandCounts={bandCounts}
          filterLabel={filterLabel}
          exporting={exporting}
          onBand={(value) => {
            setBand(value);
            setPage(1);
          }}
          onCustomMin={(value) => {
            setCustomMin(value);
            setBand('custom');
            setPage(1);
          }}
          onCustomMax={(value) => {
            setCustomMax(value);
            setBand('custom');
            setPage(1);
          }}
          onName={(value) => {
            setNameQuery(value);
            setPage(1);
          }}
          onRoll={(value) => {
            setRollQuery(value);
            setPage(1);
          }}
          onDepartment={(value) => {
            setTableDepartment(value);
            setPage(1);
          }}
          onProgramme={(value) => {
            setTableProgramme(value);
            setPage(1);
          }}
          onSemester={(value) => {
            setTableSemester(value);
            setPage(1);
          }}
          onSort={(value) => {
            setSort(value);
            setPage(1);
          }}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          onExport={exportReport}
          onPrint={() => window.print()}
          onOpen={setSelected}
        />
      ) : (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground print:hidden">
          Choose the month range and generate the report.
        </p>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selected ? studentLabel(selected) : 'Student'}</DialogTitle>
            <DialogDescription>
              {selected?.rollNumber || selected?.enrollmentNumber || 'No roll number'} · monthly
              attendance
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="max-h-[60vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Month</th>
                    <th className="px-2 py-2">Attended</th>
                    <th className="px-2 py-2">Conducted</th>
                    <th className="px-2 py-2">Absent</th>
                    <th className="px-2 py-2">Leave</th>
                    <th className="px-2 py-2">On duty</th>
                    <th className="px-2 py-2">%</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.months.map((month) => (
                    <tr key={month.key} className="border-t border-border">
                      <td className="px-2 py-2">{month.label}</td>
                      <td className="px-2 py-2">{month.conducted ? month.attended : '—'}</td>
                      <td className="px-2 py-2">{month.conducted || '—'}</td>
                      <td className="px-2 py-2">{month.conducted ? month.absent : '—'}</td>
                      <td className="px-2 py-2">{month.conducted ? month.leave : '—'}</td>
                      <td className="px-2 py-2">{month.conducted ? month.duty : '—'}</td>
                      <td className="px-2 py-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs font-semibold',
                            toneClass(month.tone),
                          )}
                        >
                          {month.display}
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border font-semibold">
                    <td className="px-2 py-2">Overall</td>
                    <td className="px-2 py-2">{selected.overall.attended}</td>
                    <td className="px-2 py-2">{selected.overall.conducted}</td>
                    <td className="px-2 py-2">{selected.overall.absent}</td>
                    <td className="px-2 py-2">{selected.overall.leave}</td>
                    <td className="px-2 py-2">{selected.overall.duty}</td>
                    <td className="px-2 py-2">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          toneClass(selected.overall.tone),
                        )}
                      >
                        {selected.overall.display}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim() ?? '').filter(Boolean))].sort(
    (left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }),
  );
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function ReportBody({
  report,
  rows,
  printRows,
  total,
  page,
  pageCount,
  pageSize,
  sort,
  band,
  customMin,
  customMax,
  customInvalid,
  nameQuery,
  rollQuery,
  tableDepartment,
  tableProgramme,
  tableSemester,
  bandCounts,
  filterLabel,
  exporting,
  onBand,
  onCustomMin,
  onCustomMax,
  onName,
  onRoll,
  onDepartment,
  onProgramme,
  onSemester,
  onSort,
  onPage,
  onPageSize,
  onExport,
  onPrint,
  onOpen,
}: {
  report: ReportPayload;
  rows: ReportPayload['rows'];
  printRows: ReportPayload['rows'];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  sort: SortMode;
  band: AttendanceBand;
  customMin: string;
  customMax: string;
  customInvalid: boolean;
  nameQuery: string;
  rollQuery: string;
  tableDepartment: string;
  tableProgramme: string;
  tableSemester: string;
  bandCounts: {
    total: number;
    below50: number;
    below60: number;
    below75: number;
    atLeast75: number;
  };
  filterLabel: string;
  exporting: 'filtered-xlsx' | 'all-xlsx' | 'pdf' | null;
  onBand: (value: AttendanceBand) => void;
  onCustomMin: (value: string) => void;
  onCustomMax: (value: string) => void;
  onName: (value: string) => void;
  onRoll: (value: string) => void;
  onDepartment: (value: string) => void;
  onProgramme: (value: string) => void;
  onSemester: (value: string) => void;
  onSort: (value: SortMode) => void;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onExport: (format: 'xlsx' | 'pdf', scope: 'filtered' | 'all') => void;
  onPrint: () => void;
  onOpen: (row: ReportPayload['rows'][number]) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const departments = uniqueValues(report.rows.map((row) => row.departmentName));
  const programmes = uniqueValues(report.rows.map((row) => row.programmeName));
  const semesters = uniqueValues(
    report.rows.map((row) => (row.semesterNo ? String(row.semesterNo) : '')),
  );
  const cards: Array<{ id: AttendanceBand; label: string; count: number }> = [
    { id: 'all', label: 'Total students', count: bandCounts.total },
    { id: 'below-50', label: 'Below 50%', count: bandCounts.below50 },
    { id: 'below-60', label: 'Below 60%', count: bandCounts.below60 },
    { id: 'below-75', label: 'Below 75%', count: bandCounts.below75 },
    { id: 'at-least-75', label: '75% and above', count: bandCounts.atLeast75 },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <img
          src="/branding/college-logo.png"
          alt=""
          className="hidden h-14 w-14 object-contain print:block"
        />
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide">{report.institutionName}</p>
          <p className="text-base font-semibold">Month-wise Cumulative Attendance Report</p>
          <p className="text-xs text-muted-foreground">
            {[
              report.academicYear,
              report.programme,
              report.department,
              report.semester,
              report.section,
              report.subject,
              report.shift,
              report.monthRange,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <p className="text-xs text-muted-foreground">
            Generated {new Date(report.generatedAt).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-muted-foreground">Attendance filter: {filterLabel}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{report.calculation}</p>
      {report.truncated ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This range has more marked classes than the report can load at once. Narrow the
          department, semester, or subject and generate again.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
        {report.months.map((month) => (
          <div key={month.key} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{month.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{month.conducted}</p>
            <p className="text-xs text-muted-foreground">Classes conducted</p>
          </div>
        ))}
        <div className="rounded-2xl border border-border bg-sky-50 p-4">
          <p className="text-xs text-muted-foreground">Selected period</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {report.summary.conductedClasses}
          </p>
          <p className="text-xs text-muted-foreground">Total classes conducted</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Students</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{report.summary.students}</p>
          <p className="text-xs text-muted-foreground">Included in this report</p>
        </div>
      </div>

      <div className="space-y-3 print:hidden">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              className={cn(
                'rounded-2xl border p-4 text-left',
                band === card.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:bg-muted/40',
              )}
              onClick={() => onBand(card.id)}
            >
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{card.count}</p>
            </button>
          ))}
        </div>
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-3 sm:grid-cols-2 xl:grid-cols-4">
          <Filter label="Attendance percentage">
            <select
              className={fieldClass}
              value={band}
              onChange={(event) => onBand(event.target.value as AttendanceBand)}
            >
              {PERCENT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Minimum percentage">
            <input
              className={fieldClass}
              inputMode="decimal"
              value={customMin}
              placeholder="0"
              onChange={(event) => onCustomMin(event.target.value)}
            />
          </Filter>
          <Filter label="Maximum percentage">
            <input
              className={fieldClass}
              inputMode="decimal"
              value={customMax}
              placeholder="100"
              onChange={(event) => onCustomMax(event.target.value)}
            />
          </Filter>
          <p className="self-end pb-2 text-xs text-muted-foreground">
            Below a cutoff means strictly under that percentage. 75% and above includes 75.
          </p>
        </div>
        {customInvalid ? (
          <p className="text-sm text-rose-600">
            Minimum attendance cannot be higher than the maximum.
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Filter label="Student name">
            <input
              className={fieldClass}
              value={nameQuery}
              placeholder="Search name"
              onChange={(event) => onName(event.target.value)}
            />
          </Filter>
          <Filter label="College roll number">
            <input
              className={fieldClass}
              value={rollQuery}
              placeholder="Search roll number"
              onChange={(event) => onRoll(event.target.value)}
            />
          </Filter>
          <Filter label="Department">
            <select
              className={fieldClass}
              value={tableDepartment}
              onChange={(event) => onDepartment(event.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Programme">
            <select
              className={fieldClass}
              value={tableProgramme}
              onChange={(event) => onProgramme(event.target.value)}
            >
              <option value="">All programmes</option>
              {programmes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Semester">
            <select
              className={fieldClass}
              value={tableSemester}
              onChange={(event) => onSemester(event.target.value)}
            >
              <option value="">All semesters</option>
              {semesters.map((item) => (
                <option key={item} value={item}>
                  Semester {item}
                </option>
              ))}
            </select>
          </Filter>
          <Filter label="Sort attendance">
            <select
              className={fieldClass}
              value={sort}
              onChange={(event) => onSort(event.target.value as SortMode)}
            >
              <option value="roll">Roll number</option>
              <option value="low">Lowest to highest</option>
              <option value="high">Highest to lowest</option>
            </select>
          </Filter>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={exporting !== null}
            onClick={() => onExport('xlsx', 'filtered')}
          >
            {exporting === 'filtered-xlsx' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Download Filtered Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting !== null}
            onClick={() => onExport('xlsx', 'all')}
          >
            {exporting === 'all-xlsx' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Download All Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting !== null}
            onClick={() => onExport('pdf', 'filtered')}
          >
            {exporting === 'pdf' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Download Filtered PDF
          </Button>
          <Button variant="outline" size="sm" onClick={onPrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print Report
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Below 50% red · 50% to below 60% light red · 60% to below 75% orange · 75% and above green
        </p>
      </div>

      {!report.rows.length ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          No attendance records are available for the selected month range.
        </p>
      ) : (
        <>
          <div className="hidden print:block">
            <table>
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Student</th>
                  <th>Department</th>
                  {report.months.map((month) => (
                    <th key={month.key}>{month.label}</th>
                  ))}
                  <th>Overall</th>
                </tr>
              </thead>
              <tbody>
                {printRows.map((row) => (
                  <tr key={row.studentId}>
                    <td>{row.rollNumber ?? '—'}</td>
                    <td>{studentLabel(row)}</td>
                    <td>{row.departmentName ?? ''}</td>
                    {row.months.map((month) => (
                      <td key={month.key}>{month.display}</td>
                    ))}
                    <td>{row.overall.display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="overflow-auto rounded-2xl border border-border print:hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-20 bg-muted px-3 py-2">Roll</th>
                  <th className="sticky left-24 z-20 bg-muted px-3 py-2">Student</th>
                  {report.months.map((month) => (
                    <th key={month.key} className="px-3 py-2">
                      {month.label}
                    </th>
                  ))}
                  <th className="px-3 py-2">Overall</th>
                  <th className="px-3 py-2 print:hidden"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.length ? (
                  rows.map((row) => (
                    <tr key={row.studentId} className="border-t border-border">
                      <td className="sticky left-0 z-10 bg-card px-3 py-2 font-mono text-xs">
                        {row.rollNumber ?? '—'}
                      </td>
                      <td className="sticky left-24 z-10 bg-card px-3 py-2">
                        <div className="font-medium">{studentLabel(row)}</div>
                        {row.departmentName ? (
                          <div className="text-xs text-muted-foreground">{row.departmentName}</div>
                        ) : null}
                      </td>
                      {row.months.map((month) => (
                        <td key={month.key} className="px-3 py-2">
                          <span
                            className={cn(
                              'inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
                              toneClass(month.tone),
                            )}
                          >
                            {month.display}
                          </span>
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
                            toneClass(row.overall.tone),
                          )}
                        >
                          {row.overall.display}
                        </span>
                      </td>
                      <td className="px-3 py-2 print:hidden">
                        <Button variant="outline" size="sm" onClick={() => onOpen(row)}>
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={report.months.length + 3}
                      className="px-3 py-8 text-center text-sm text-muted-foreground"
                    >
                      No students match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {total > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground print:hidden">
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
        </>
      )}
    </div>
  );
}
