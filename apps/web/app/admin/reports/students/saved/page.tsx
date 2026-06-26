'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Play, Star, Trash2 } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import {
  emptyReportFilters,
  StudentReportFiltersBar,
  toApiFilters,
} from '@/components/student-reports/student-report-filters';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';
import { useStudentReportFilterOptions } from '@/components/student-reports/use-student-report-filters';
import {
  deleteSavedReport,
  exportSavedReport,
  fetchSavedReports,
  previewSavedReport,
  toggleSavedReportFavorite,
  type SavedReport,
  type StudentReportFilters,
} from '@/services/student-reports';
import { apiErrorMessage } from '@/utils/api-error';

function reportTypeLabel(report: SavedReport) {
  if (report.isSystemTemplate) return 'Built-in template';
  if (report.reportKind === 'BUILTIN') return 'System report';
  return 'Custom report';
}

function reportHref(report: SavedReport) {
  if (report.builtinKey === 'student-master') return '/admin/reports/students/master';
  if (report.builtinKey === 'subject-summary') {
    return '/admin/reports/students/subject-registration';
  }
  if (report.builtinKey === 'subject-papers') return '/admin/reports/students/subject-papers';
  return '/admin/reports/students/builder';
}

export default function SavedReportsPage() {
  const [filters, setFilters] = useState(emptyReportFilters);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const filterOptions = useStudentReportFilterOptions();
  const queryClient = useQueryClient();
  const apiFilters = toApiFilters(filters) as StudentReportFilters;

  const savedQuery = useQuery({
    queryKey: ['saved-reports'],
    queryFn: () => fetchSavedReports(),
  });

  const previewQuery = useQuery({
    queryKey: ['saved-report-preview', activeId, apiFilters],
    queryFn: () => previewSavedReport(activeId!, apiFilters),
    enabled: Boolean(activeId),
  });

  const reports = savedQuery.data ?? [];
  const favorites = useMemo(() => reports.filter((r) => r.isFavorite), [reports]);
  const others = useMemo(() => reports.filter((r) => !r.isFavorite), [reports]);

  const favoriteMut = useMutation({
    mutationFn: (id: string) => toggleSavedReportFavorite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-reports'] }),
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not update favorite')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteSavedReport(id),
    onSuccess: () => {
      setMessage('Report removed.');
      setActiveId(null);
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Delete failed')),
  });

  const exportMut = useMutation({
    mutationFn: ({ id, format }: { id: string; format: 'xlsx' | 'csv' }) =>
      exportSavedReport(id, format, apiFilters),
    onSuccess: () => setMessage('Export downloaded.'),
    onError: (e) => setMessage(apiErrorMessage(e, 'Export failed')),
  });

  const preview = previewQuery.data;
  const columnDefs = normalizeColumns(preview?.columns);
  const previewRows = (preview?.rows ?? []).slice(0, 20);

  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Saved Reports"
        description="Run built-in templates and your saved custom reports with shared filters."
      >
        <StudentReportFiltersBar
          filters={filters}
          onChange={(p) => setFilters((f) => ({ ...f, ...p }))}
          extended
          {...filterOptions}
        />

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-4">
            <ReportSection
              title="Favorites"
              reports={favorites}
              activeId={activeId}
              onSelect={setActiveId}
              onFavorite={(id) => favoriteMut.mutate(id)}
              onDelete={(id) => deleteMut.mutate(id)}
            />
            <ReportSection
              title="All reports"
              reports={others}
              activeId={activeId}
              onSelect={setActiveId}
              onFavorite={(id) => favoriteMut.mutate(id)}
              onDelete={(id) => deleteMut.mutate(id)}
            />
          </div>

          <CompactCard>
            <CompactCardHeader
              title="Preview"
              description={
                activeId
                  ? 'Optional filters above override saved defaults for this run.'
                  : 'Select a report to preview.'
              }
            />
            <CompactCardBody className="space-y-3">
              {activeId ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => previewQuery.refetch()}
                    disabled={previewQuery.isFetching}
                  >
                    <Play className="mr-1 h-3.5 w-3.5" />
                    Run preview
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={exportMut.isPending}
                    onClick={() => exportMut.mutate({ id: activeId, format: 'xlsx' })}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={exportMut.isPending}
                    onClick={() => exportMut.mutate({ id: activeId, format: 'csv' })}
                  >
                    CSV
                  </Button>
                </div>
              ) : null}

              {previewQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading preview…</p>
              ) : previewQuery.isError ? (
                <p className="text-sm text-destructive">
                  {apiErrorMessage(previewQuery.error, 'Preview failed')}
                </p>
              ) : preview ? (
                <div className="overflow-x-auto">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {preview.rowCount} of {preview.total} rows
                    {preview.truncated ? ' (export capped at 10,000)' : ''}
                  </p>
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="border-b bg-muted/40">
                      <tr>
                        {columnDefs.map((col) => (
                          <th key={col.key} className="px-2 py-1.5 font-medium">
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, idx) => (
                        <tr key={idx} className="border-b border-border/40">
                          {columnDefs.map((col) => (
                            <td key={col.key} className="px-2 py-1.5 align-top">
                              {formatCell(row[col.key])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pick a saved report from the list to run it here.
                </p>
              )}
            </CompactCardBody>
          </CompactCard>
        </div>
      </StudentReportsShell>
    </DashboardShell>
  );
}

function ReportSection({
  title,
  reports,
  activeId,
  onSelect,
  onFavorite,
  onDelete,
}: {
  title: string;
  reports: SavedReport[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!reports.length) return null;

  return (
    <CompactCard>
      <CompactCardHeader title={title} />
      <CompactCardBody className="space-y-2">
        {reports.map((report) => (
          <div
            key={report.id}
            className={`rounded-lg border px-3 py-2 ${
              activeId === report.id ? 'border-primary bg-primary/5' : 'border-border/60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <button type="button" className="text-left" onClick={() => onSelect(report.id)}>
                <p className="text-sm font-medium">{report.name}</p>
                <p className="text-xs text-muted-foreground">
                  {reportTypeLabel(report)} ·{' '}
                  {Array.isArray(report.columns) ? report.columns.length : 0} columns
                </p>
              </button>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => onFavorite(report.id)}
                  title={report.isFavorite ? 'Remove favorite' : 'Add favorite'}
                >
                  <Star
                    className={`h-3.5 w-3.5 ${report.isFavorite ? 'fill-amber-400 text-amber-500' : ''}`}
                  />
                </Button>
                {!report.isSystemTemplate ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => onDelete(report.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>
            <Link
              href={reportHref(report)}
              className="mt-1 inline-block text-xs text-primary hover:underline"
            >
              Open full page →
            </Link>
          </div>
        ))}
      </CompactCardBody>
    </CompactCard>
  );
}

function normalizeColumns(
  columns?: string[] | { key: string; label: string }[],
): { key: string; label: string }[] {
  if (!columns?.length) return [];
  if (typeof columns[0] === 'string') {
    return (columns as string[]).map((key) => ({ key, label: key }));
  }
  return columns as { key: string; label: string }[];
}

function formatCell(value: unknown) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
