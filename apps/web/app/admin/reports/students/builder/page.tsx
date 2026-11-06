'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Save, Search } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import {
  emptyReportFilters,
  StudentReportFiltersBar,
} from '@/components/student-reports/student-report-filters';
import { StudentReportsShell } from '@/components/student-reports/student-reports-shell';
import {
  useStudentReportFilterOptions,
  useStudentReportFilterState,
} from '@/components/student-reports/use-student-report-filters';
import {
  createSavedReport,
  deleteSavedReport,
  exportCustomReport,
  exportSavedReport,
  fetchReportFieldRegistry,
  fetchSavedReports,
  previewCustomReport,
  updateSavedReport,
  type ReportFieldDef,
  type TabularReportPreview,
} from '@/services/student-reports';
import { apiErrorMessage } from '@/utils/api-error';

export default function ReportBuilderPage() {
  const qc = useQueryClient();
  const { filters, setFilters, patchFilters, apiFilters, hideShiftFilter } =
    useStudentReportFilterState();
  const [selected, setSelected] = useState<string[]>([]);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [reportName, setReportName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
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
  const labels = registryQuery.data?.groupLabels ?? {};
  const order = registryQuery.data?.groupOrder ?? [];
  const byKey = useMemo(() => new Map(fields.map((field) => [field.key, field])), [fields]);
  const query = search.trim().toLowerCase();

  const grouped = useMemo(() => {
    const map = new Map<string, ReportFieldDef[]>();
    for (const field of fields) {
      if (
        query &&
        !`${field.label} ${field.key} ${labels[field.group] ?? field.group}`
          .toLowerCase()
          .includes(query)
      ) {
        continue;
      }
      const list = map.get(field.group) ?? [];
      list.push(field);
      map.set(field.group, list);
    }
    const keys = order.length ? order.filter((group) => map.has(group)) : [...map.keys()];
    return keys.map((group) => [group, map.get(group) ?? []] as const);
  }, [fields, labels, order, query]);

  const detailSheets = selected
    .map((key) => byKey.get(key)?.detailSheet)
    .filter((name, index, list): name is string => Boolean(name) && list.indexOf(name) === index);

  const previewQuery = useQuery({
    queryKey: ['custom-report-preview', selected, apiFilters],
    queryFn: () => previewCustomReport({ columns: selected, limit: 10, filters: apiFilters }),
    enabled: false,
  });

  const saveMut = useMutation({
    mutationFn: () =>
      editingId
        ? updateSavedReport(editingId, {
            name: reportName.trim(),
            columns: selected,
            filters: apiFilters,
          })
        : createSavedReport({ name: reportName.trim(), columns: selected, filters: apiFilters }),
    onSuccess: async () => {
      setMessage(editingId ? 'Report updated.' : 'Report saved.');
      if (!editingId) setReportName('');
      await qc.invalidateQueries({ queryKey: ['saved-reports'] });
    },
    onError: (error) => setMessage(apiErrorMessage(error, 'Save failed')),
  });

  const exportMut = useMutation({
    mutationFn: (format: 'xlsx' | 'csv') =>
      exportCustomReport({
        columns: selected,
        name: reportName.trim() || 'Customised Student Information Report',
        format,
        filters: apiFilters,
      }),
    onSuccess: () => setMessage('Export downloaded.'),
    onError: (error) => setMessage(apiErrorMessage(error, 'Export failed')),
  });

  function toggleField(key: string) {
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function toggleGroup(group: string, groupFields: ReportFieldDef[], on: boolean) {
    setSelected((current) => {
      const keys = new Set(current);
      for (const field of groupFields) {
        if (on) keys.add(field.key);
        else keys.delete(field.key);
      }
      return [...keys];
    });
  }

  function useReport(report: {
    id: string;
    name: string;
    columns: string[];
    isSystemTemplate: boolean;
    filters: Record<string, unknown>;
  }) {
    const known = report.columns.filter((key) => byKey.has(key));
    if (!known.length) {
      setMessage(
        'That template uses a dedicated report page. Its columns are not master-sheet fields.',
      );
      return;
    }
    setSelected(known);
    setReportName(report.isSystemTemplate ? '' : report.name);
    setEditingId(report.isSystemTemplate ? null : report.id);
    setMessage(`${known.length} fields loaded from ${report.name}.`);
  }

  function moveSelected(from: number, to: number) {
    if (to < 0 || to >= selected.length || from === to) return;
    setSelected((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  return (
    <DashboardShell title="Student Reports">
      <StudentReportsShell
        title="Custom Report Builder"
        description="Choose any student field, arrange the columns, preview the rows, then export Excel."
      >
        <StudentReportFiltersBar
          filters={filters}
          onChange={patchFilters}
          hideShiftFilter={hideShiftFilter}
          extended
          {...filterOptions}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setFilters(emptyReportFilters)}>
            Reset filters
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selected.length || previewQuery.isFetching}
            onClick={() => void previewQuery.refetch()}
          >
            {previewQuery.isFetching ? 'Previewing…' : 'Preview'}
          </Button>
          {previewQuery.data ? (
            <span className="self-center text-sm text-muted-foreground">
              {previewQuery.data.total.toLocaleString()} matching students · {selected.length}{' '}
              fields
            </span>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
          <CompactCard>
            <CompactCardHeader
              title="Available fields"
              description={`${fields.length} fields from the student database. Blank values stay in the export.`}
            />
            <CompactCardBody className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative min-w-[16rem] flex-1">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    className="h-9 w-full rounded-lg border border-border bg-background pl-7 pr-2 text-sm"
                    placeholder="Search available fields"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(fields.map((field) => field.key))}
                >
                  Select all fields
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                  Deselect all
                </Button>
                <span className="text-xs text-muted-foreground">{selected.length} selected</span>
              </div>
              {registryQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading field registry…</p>
              ) : null}
              {grouped.map(([group, groupFields]) => {
                const defaultOpen =
                  group === 'identity' || group === 'personal' || group === 'contact';
                const open = query ? true : (openGroups[group] ?? defaultOpen);
                const selectedInGroup = groupFields.filter((field) =>
                  selected.includes(field.key),
                ).length;
                return (
                  <section key={group} className="rounded-xl border border-border/70">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left"
                      onClick={() =>
                        setOpenGroups((current) => ({
                          ...current,
                          [group]: !(current[group] ?? defaultOpen),
                        }))
                      }
                    >
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {labels[group] ?? group} ({groupFields.length} fields)
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {open ? 'Hide' : 'Show'} · {selectedInGroup} selected
                      </span>
                    </button>
                    {open ? (
                      <div className="space-y-2 border-t border-border/60 px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="text-xs font-medium text-blue-700"
                            onClick={() => toggleGroup(group, groupFields, true)}
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            className="text-xs text-slate-500"
                            onClick={() => toggleGroup(group, groupFields, false)}
                          >
                            Clear
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {groupFields.map((field) => {
                            const active = selected.includes(field.key);
                            return (
                              <button
                                key={field.key}
                                type="button"
                                title={field.description}
                                onClick={() => toggleField(field.key)}
                                className={`rounded-full border px-2.5 py-1 text-xs ${
                                  active
                                    ? 'border-blue-700 bg-blue-50 font-semibold text-blue-800'
                                    : 'border-border text-muted-foreground'
                                }`}
                              >
                                {field.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </CompactCardBody>
          </CompactCard>

          <div className="space-y-4">
            <CompactCard>
              <CompactCardHeader
                title="Selected fields"
                description="Drag to set the Excel column order."
              />
              <CompactCardBody className="space-y-2">
                {!selected.length ? (
                  <p className="text-sm text-muted-foreground">No fields selected.</p>
                ) : null}
                <ol className="max-h-80 space-y-1 overflow-auto">
                  {selected.map((key, index) => {
                    const field = byKey.get(key);
                    return (
                      <li
                        key={key}
                        draggable
                        onDragStart={() => setDragIndex(index)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (dragIndex != null) moveSelected(dragIndex, index);
                          setDragIndex(null);
                        }}
                        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
                      >
                        <span className="w-5 text-xs text-slate-400">{index + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{field?.label ?? key}</span>
                          <span className="block text-[11px] text-slate-500">
                            {labels[field?.group ?? ''] ?? field?.group}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="text-xs text-rose-700"
                          onClick={() => toggleField(key)}
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {detailSheets.length ? (
                  <p className="text-xs text-slate-500">
                    Detail worksheets: {detailSheets.join(', ')}. The student sheet stays one row
                    per student.
                  </p>
                ) : null}
              </CompactCardBody>
            </CompactCard>

            <CompactCard>
              <CompactCardHeader title="Save report" />
              <CompactCardBody className="space-y-3">
                <input
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Report name"
                  value={reportName}
                  onChange={(event) => setReportName(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={!reportName.trim() || !selected.length || saveMut.isPending}
                    onClick={() => saveMut.mutate()}
                  >
                    <Save className="mr-1 h-3.5 w-3.5" />
                    {editingId ? 'Update report' : 'Save custom report'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selected.length || exportMut.isPending}
                    onClick={() => exportMut.mutate('xlsx')}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    Excel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!selected.length || exportMut.isPending}
                    onClick={() => exportMut.mutate('csv')}
                  >
                    CSV
                  </Button>
                </div>
                {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
              </CompactCardBody>
            </CompactCard>

            <CompactCard>
              <CompactCardHeader title="Templates and saved reports" />
              <CompactCardBody className="max-h-96 space-y-2 overflow-auto">
                {(savedQuery.data ?? []).map((report) => (
                  <div
                    key={report.id}
                    className="rounded-lg border border-border/60 px-3 py-2 text-sm"
                  >
                    <p className="font-medium">{report.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {report.isSystemTemplate ? 'Template' : 'Custom report'} ·{' '}
                      {report.columns.length} columns
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-700"
                        onClick={() => useReport(report)}
                      >
                        Use fields
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-700"
                        onClick={() =>
                          createSavedReport({
                            name: `Copy of ${report.name}`,
                            columns: report.columns,
                            filters: report.filters,
                          }).then(() => {
                            setMessage(`Duplicated ${report.name}.`);
                            return qc.invalidateQueries({ queryKey: ['saved-reports'] });
                          })
                        }
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-700"
                        onClick={() =>
                          exportSavedReport(report.id, 'xlsx', apiFilters, report.name)
                        }
                      >
                        Generate
                      </button>
                      {!report.isSystemTemplate ? (
                        <button
                          type="button"
                          className="text-xs text-rose-700"
                          onClick={() =>
                            deleteSavedReport(report.id).then(() =>
                              qc.invalidateQueries({ queryKey: ['saved-reports'] }),
                            )
                          }
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </CompactCardBody>
            </CompactCard>
          </div>
        </div>

        <CompactCard>
          <CompactCardHeader
            title="Preview"
            description="First 10 matching students. Empty profile values are left blank."
          />
          <CompactCardBody>
            {previewQuery.isError ? (
              <p className="text-sm text-rose-700">
                {apiErrorMessage(previewQuery.error, 'Preview failed')}
              </p>
            ) : null}
            {!previewQuery.data ? (
              <p className="text-sm text-muted-foreground">Choose fields, then click Preview.</p>
            ) : null}
            {previewQuery.data ? (
              <PreviewTable
                columns={previewQuery.data.columns ?? []}
                rows={previewQuery.data.rows ?? []}
              />
            ) : null}
          </CompactCardBody>
        </CompactCard>
      </StudentReportsShell>
    </DashboardShell>
  );
}

function PreviewTable({
  columns,
  rows,
}: {
  columns: TabularReportPreview['columns'];
  rows: Record<string, unknown>[];
}) {
  const defs = columns.map((column) =>
    typeof column === 'string' ? { key: column, label: column } : column,
  );
  return (
    <div className="overflow-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-blue-800 text-left text-xs text-white">
          <tr>
            {defs.map((column) => (
              <th key={column.key} className="px-2 py-2">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((row, index) => (
            <tr key={index} className="border-t border-slate-100">
              {defs.map((column) => (
                <td key={column.key} className="px-2 py-1.5">
                  {String(row[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
