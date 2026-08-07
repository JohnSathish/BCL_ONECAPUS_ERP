'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Loader2, Printer } from 'lucide-react';

import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  exportStudentAttendanceReport,
  fetchStudentAttendanceReport,
} from '@/services/student-attendance';
import { downloadBlob } from '@/utils/download-blob';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type ReportKind = 'monthly' | 'cumulative' | 'defaulters';

type ReportRow = {
  studentId: string;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
  fullName: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  medicalLeaveCount?: number;
  percentage: number;
  eligibilityStatus?: string;
};

type ReportPayload = {
  type: string;
  from: string;
  to: string;
  attendanceMode: string;
  aggregationUnit?: 'PERIOD' | 'DAY' | 'SESSION';
  unitLabels?: {
    working: string;
    present: string;
    absent: string;
    percentageHint: string;
  };
  shortageThresholdPct?: number;
  defaulterThresholdPct?: number;
  summary: Record<string, number>;
  rows: ReportRow[];
};

const TITLES: Record<ReportKind, string> = {
  monthly: 'Monthly Attendance Report',
  cumulative: 'Cumulative Attendance Report',
  defaulters: 'Attendance Defaulters',
};

export function AttendanceReportsWorkspace({ kind }: { kind: ReportKind }) {
  const session = useRequireAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [exporting, setExporting] = useState<'xlsx' | 'csv' | null>(null);
  const [error, setError] = useState('');

  const params = useMemo(() => {
    if (kind === 'monthly') return { month, year };
    if (kind === 'cumulative') return { from, to };
    return { from, to };
  }, [kind, month, year, from, to]);

  const reportQ = useQuery({
    queryKey: ['student-attendance', 'report', kind, params],
    queryFn: () => fetchStudentAttendanceReport(kind, params),
    enabled: Boolean(session),
  });

  if (!session) return null;

  const report = (reportQ.data ?? null) as ReportPayload | null;
  const rows = report?.rows ?? [];

  const exportReport = async (format: 'xlsx' | 'csv') => {
    setExporting(format);
    setError('');
    try {
      const blob = await exportStudentAttendanceReport(kind, params, format);
      downloadBlob(blob, `${kind}-attendance.${format === 'xlsx' ? 'xlsx' : 'csv'}`);
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
          <h1 className="text-xl font-semibold">{TITLES[kind]}</h1>
          <p className="text-sm text-muted-foreground">
            Percentages follow the institution attendance collection mode.
            {report?.attendanceMode ? ` Current mode: ${report.attendanceMode}.` : ''}
            {report?.unitLabels?.percentageHint ? ` ${report.unitLabels.percentageHint}.` : ''}
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

      <div className="flex flex-wrap gap-3 rounded-2xl border border-border bg-card p-3">
        {kind === 'monthly' ? (
          <>
            <label className="text-xs text-muted-foreground">
              Month
              <select
                className="mt-1 block h-9 rounded-lg border border-border bg-background px-2 text-sm"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2000, m - 1, 1).toLocaleString('en', { month: 'long' })}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Year
              <input
                type="number"
                className="mt-1 block h-9 w-28 rounded-lg border border-border bg-background px-2 text-sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </label>
          </>
        ) : (
          <>
            <label className="text-xs text-muted-foreground">
              From
              <input
                type="date"
                className="mt-1 block h-9 rounded-lg border border-border bg-background px-2 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              To
              <input
                type="date"
                className="mt-1 block h-9 rounded-lg border border-border bg-background px-2 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </label>
          </>
        )}
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

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Students" value={report?.summary?.students ?? rows.length} />
        <SummaryCard
          label={kind === 'defaulters' ? 'Detained' : (report?.unitLabels?.working ?? 'Sessions')}
          value={
            kind === 'defaulters'
              ? (report?.summary?.detained ?? 0)
              : (report?.summary?.sessions ?? 0)
          }
        />
        <SummaryCard
          label={kind === 'defaulters' ? 'Condonation' : 'Average %'}
          value={
            kind === 'defaulters'
              ? (report?.summary?.condonation ?? 0)
              : (report?.summary?.averagePercentage ?? 0)
          }
        />
      </div>

      <div className="overflow-auto rounded-2xl border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Roll</th>
              <th className="px-3 py-2">Student</th>
              <th className="px-3 py-2">{report?.unitLabels?.working ?? 'Sessions'}</th>
              <th className="px-3 py-2">{report?.unitLabels?.present ?? 'Present'}</th>
              <th className="px-3 py-2">{report?.unitLabels?.absent ?? 'Absent'}</th>
              <th className="px-3 py-2">%</th>
              {kind === 'defaulters' ? <th className="px-3 py-2">Status</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.studentId} className="border-t border-border">
                <td className="px-3 py-2 font-mono text-xs">{row.rollNumber ?? '—'}</td>
                <td className="px-3 py-2">{row.fullName}</td>
                <td className="px-3 py-2">{row.totalSessions}</td>
                <td className="px-3 py-2">{row.presentCount}</td>
                <td className="px-3 py-2">{row.absentCount}</td>
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
                    {Number(row.percentage).toFixed(2)}%
                  </span>
                </td>
                {kind === 'defaulters' ? (
                  <td className="px-3 py-2 text-xs">{row.eligibilityStatus ?? '—'}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {!reportQ.isLoading && rows.length === 0 ? (
          <p className="px-3 py-6 text-sm text-muted-foreground">
            No attendance rows for the selected period.
          </p>
        ) : null}
        {reportQ.isLoading ? (
          <p className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading report…
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
