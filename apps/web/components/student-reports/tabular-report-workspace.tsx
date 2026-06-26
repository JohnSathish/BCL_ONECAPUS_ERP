'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import {
  emptyReportFilters,
  StudentReportFiltersBar,
  toApiFilters,
} from '@/components/student-reports/student-report-filters';
import { useStudentReportFilterOptions } from '@/components/student-reports/use-student-report-filters';
import {
  exportBuiltinReport,
  previewBuiltinReport,
  type BuiltinReportKey,
  type StudentReportFilters,
} from '@/services/student-reports';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  reportKey: BuiltinReportKey;
  title: string;
  description: string;
};

export function TabularReportWorkspace({ reportKey, title, description }: Props) {
  const [filters, setFilters] = useState(emptyReportFilters);
  const [message, setMessage] = useState('');
  const filterOptions = useStudentReportFilterOptions();
  const apiFilters = toApiFilters(filters) as StudentReportFilters;

  const previewQuery = useQuery({
    queryKey: ['builtin-report-preview', reportKey, apiFilters],
    queryFn: () => previewBuiltinReport(reportKey, apiFilters),
  });

  const exportMut = useMutation({
    mutationFn: (format: 'xlsx' | 'csv') => exportBuiltinReport(reportKey, format, apiFilters),
    onSuccess: () => setMessage('Export downloaded.'),
    onError: (e) => setMessage(apiErrorMessage(e, 'Export failed')),
  });

  const preview = previewQuery.data;
  const columnDefs = normalizeColumns(preview?.columns);
  const previewRows = (preview?.rows ?? []).slice(0, 25);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>

      <StudentReportFiltersBar
        filters={filters}
        onChange={(p) => setFilters((f) => ({ ...f, ...p }))}
        extended
        {...filterOptions}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => previewQuery.refetch()}
          disabled={previewQuery.isFetching}
        >
          <RefreshCw className="mr-1 h-3.5 w-3.5" />
          Refresh preview
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={exportMut.isPending}
          onClick={() => exportMut.mutate('xlsx')}
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          Excel
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={exportMut.isPending}
          onClick={() => exportMut.mutate('csv')}
        >
          CSV
        </Button>
        {preview ? (
          <span className="text-xs text-muted-foreground">
            Showing {preview.rowCount} of {preview.total} students
            {preview.truncated ? ' (export capped at 10,000)' : ''}
          </span>
        ) : null}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <CompactCard>
        <CompactCardHeader title={title} description="First 25 rows of the filtered result" />
        <CompactCardBody className="overflow-x-auto p-0">
          {previewQuery.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading preview…</p>
          ) : previewQuery.isError ? (
            <p className="p-4 text-sm text-destructive">
              {apiErrorMessage(previewQuery.error, 'Preview failed')}
            </p>
          ) : (
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="border-b bg-muted/40">
                <tr>
                  {columnDefs.map((col) => (
                    <th key={col.key} className="px-3 py-2 font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-border/40">
                    {columnDefs.map((col) => (
                      <td key={col.key} className="px-3 py-2 align-top">
                        {formatCell(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
                {!previewRows.length ? (
                  <tr>
                    <td
                      colSpan={columnDefs.length || 1}
                      className="px-3 py-6 text-center text-muted-foreground"
                    >
                      No rows match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </CompactCardBody>
      </CompactCard>
    </div>
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
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}
