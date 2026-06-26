'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Save } from 'lucide-react';

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
  createSavedReport,
  fetchReportFieldRegistry,
  fetchSavedReports,
} from '@/services/student-reports';
import { apiErrorMessage } from '@/utils/api-error';

export default function ReportBuilderPage() {
  const [filters, setFilters] = useState(emptyReportFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const [reportName, setReportName] = useState('');
  const [message, setMessage] = useState('');
  const filterOptions = useStudentReportFilterOptions();

  const registryQuery = useQuery({
    queryKey: ['report-field-registry'],
    queryFn: () => fetchReportFieldRegistry(),
  });

  const savedQuery = useQuery({
    queryKey: ['saved-reports'],
    queryFn: () => fetchSavedReports(),
  });

  const fields = registryQuery.data?.fields ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, typeof fields>();
    for (const field of fields) {
      const list = map.get(field.group) ?? [];
      list.push(field);
      map.set(field.group, list);
    }
    return [...map.entries()];
  }, [fields]);

  const saveMut = useMutation({
    mutationFn: () =>
      createSavedReport({
        name: reportName.trim(),
        columns: selected,
        filters: toApiFilters(filters),
      }),
    onSuccess: () => {
      setMessage('Report saved.');
      setReportName('');
      savedQuery.refetch();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Save failed')),
  });

  function toggleField(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Custom Report Builder"
        description="Pick fields and filters, then save a reusable custom report definition."
      >
        <StudentReportFiltersBar
          filters={filters}
          onChange={(p) => setFilters((f) => ({ ...f, ...p }))}
          extended
          {...filterOptions}
        />

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <CompactCard>
            <CompactCardHeader
              title="Available fields"
              description="Select columns for your custom master report export."
            />
            <CompactCardBody className="space-y-4">
              {registryQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading field registry…</p>
              ) : (
                grouped.map(([group, groupFields]) => (
                  <div key={group}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {groupFields.map((field) => {
                        const active = selected.includes(field.key);
                        return (
                          <button
                            key={field.key}
                            type="button"
                            onClick={() => toggleField(field.key)}
                            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                              active
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {field.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </CompactCardBody>
          </CompactCard>

          <div className="space-y-4">
            <CompactCard>
              <CompactCardHeader title="Save report" />
              <CompactCardBody className="space-y-3">
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Report name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {selected.length} field{selected.length === 1 ? '' : 's'} selected
                </p>
                <Button
                  size="sm"
                  disabled={!reportName.trim() || selected.length === 0 || saveMut.isPending}
                  onClick={() => saveMut.mutate()}
                >
                  <Save className="mr-1 h-3.5 w-3.5" />
                  Save custom report
                </Button>
                {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
              </CompactCardBody>
            </CompactCard>

            <CompactCard>
              <CompactCardHeader title="Templates & saved" />
              <CompactCardBody className="space-y-2">
                {(savedQuery.data ?? []).map((report) => (
                  <div
                    key={report.id}
                    className="rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <p className="font-medium">{report.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.isSystemTemplate ? 'Built-in template' : 'Custom report'} ·{' '}
                      {Array.isArray(report.columns) ? report.columns.length : 0} columns
                    </p>
                  </div>
                ))}
                {!savedQuery.data?.length && !savedQuery.isLoading ? (
                  <p className="text-sm text-muted-foreground">No saved reports yet.</p>
                ) : null}
              </CompactCardBody>
            </CompactCard>
          </div>
        </div>
      </StudentReportsShell>
    </DashboardShell>
  );
}
