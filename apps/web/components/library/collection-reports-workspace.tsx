'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  downloadCatalogueReport,
  fetchCatalogueDashboard,
  fetchCatalogueReport,
  fetchCatalogueReportDefinitions,
  fetchCatalogueReportOptions,
} from '@/services/library';
import { apiErrorMessage } from '@/utils/api-error';

type Filters = {
  search: string;
  collectionCode: string;
  status: string;
  departmentId: string;
  from: string;
  to: string;
  author: string;
};

const EMPTY: Filters = {
  search: '',
  collectionCode: '',
  status: '',
  departmentId: '',
  from: '',
  to: '',
  author: '',
};

export function CollectionReportsWorkspace() {
  const enabled = useAuthQueryEnabled();
  const params = useSearchParams();
  const [key, setKey] = useState(params.get('report') || 'department-summary');
  const initialFilters = { ...EMPTY, departmentId: params.get('departmentId') || '' };
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState('');

  const definitions = useQuery({
    queryKey: ['library', 'catalogue-reports', 'definitions'],
    queryFn: fetchCatalogueReportDefinitions,
    enabled,
  });
  const options = useQuery({
    queryKey: ['library', 'catalogue-reports', 'options'],
    queryFn: fetchCatalogueReportOptions,
    enabled,
  });
  const dashboard = useQuery({
    queryKey: ['library', 'catalogue-reports', 'dashboard'],
    queryFn: fetchCatalogueDashboard,
    enabled,
  });
  const queryParams = useMemo(() => compact({ ...filters, page, limit: 50 }), [filters, page]);
  const report = useQuery({
    queryKey: ['library', 'catalogue-reports', key, queryParams],
    queryFn: () => fetchCatalogueReport(key, queryParams),
    enabled,
  });

  const groups = groupReports(definitions.data?.reports ?? []);
  const snapshot = dashboard.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Library collection reports</h1>
          <p className="text-sm text-muted-foreground">
            Titles and physical copies are counted separately from the live catalogue.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setKey('principal-summary');
            setPage(1);
          }}
        >
          Principal&apos;s Library Summary
        </Button>
      </div>

      {snapshot ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Distinct titles"
            value={snapshot.distinctTitles}
            report="total-titles"
            onOpen={open}
          />
          <Stat
            label="Physical copies"
            value={snapshot.physicalCopies}
            report="total-copies"
            onOpen={open}
          />
          <Stat
            label="Available copies"
            value={snapshot.availableCopies}
            report="available"
            onOpen={open}
          />
          <Stat label="Issued copies" value={snapshot.issuedCopies} report="issued" onOpen={open} />
          <Stat
            label="Overdue copies"
            value={snapshot.overdueCopies}
            report="overdue"
            onOpen={open}
          />
          <Stat label="Lost copies" value={snapshot.lostCopies} report="lost" onOpen={open} />
          <Stat
            label="Damaged copies"
            value={snapshot.damagedCopies}
            report="damaged"
            onOpen={open}
          />
          <Stat
            label="Titles without a department"
            value={snapshot.titlesWithoutDepartment}
            report="unmapped"
            onOpen={open}
          />
        </div>
      ) : null}

      {snapshot?.departments.length ? (
        <div className="h-64 rounded-lg border p-3">
          <p className="mb-2 text-sm font-medium">Physical copies by department or collection</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={snapshot.departments} layout="vertical" margin={{ left: 24 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="department" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="copies" fill="#1e3a5f" radius={2} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="space-y-4">
          {groups.map(([group, items]) => (
            <div key={group}>
              <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">{group}</p>
              <div className="space-y-1">
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`block w-full rounded px-2 py-1 text-left text-sm ${item.key === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                    onClick={() => {
                      setKey(item.key);
                      setPage(1);
                      setMessage('');
                    }}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <form
            className="grid gap-2 md:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              setFilters(draft);
              setPage(1);
            }}
          >
            <Input
              placeholder="Title, author, accession, barcode"
              value={draft.search}
              onChange={(event) => setDraft({ ...draft, search: event.target.value })}
            />
            <select
              className="rounded-md border bg-background px-2 text-sm"
              value={draft.collectionCode}
              onChange={(event) => setDraft({ ...draft, collectionCode: event.target.value })}
            >
              <option value="">All collections</option>
              {(options.data?.collections ?? []).map((collection) => (
                <option key={collection.code || 'blank'} value={collection.code || '(Unmapped)'}>
                  {collection.code || '(Unmapped)'} ({collection.copies})
                </option>
              ))}
            </select>
            <select
              className="rounded-md border bg-background px-2 text-sm"
              value={draft.departmentId}
              onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })}
            >
              <option value="">All departments</option>
              {(options.data?.departments ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border bg-background px-2 text-sm"
              value={draft.status}
              onChange={(event) => setDraft({ ...draft, status: event.target.value })}
            >
              <option value="">Any status</option>
              {(options.data?.statuses ?? []).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Input
              placeholder="Author"
              value={draft.author}
              onChange={(event) => setDraft({ ...draft, author: event.target.value })}
            />
            <Input
              type="date"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            />
            <Input
              type="date"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Apply
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setDraft(EMPTY);
                  setFilters(EMPTY);
                  setPage(1);
                }}
              >
                Clear
              </Button>
            </div>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-medium">{report.data?.title ?? 'Report'}</h2>
              <p className="text-xs text-muted-foreground">
                {report.data ? `${report.data.institutionName} · ${report.data.filters}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void save('xlsx')}>
                Excel
              </Button>
              <Button size="sm" variant="outline" onClick={() => void save('csv')}>
                CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => void save('pdf')}>
                PDF
              </Button>
              <Button size="sm" variant="outline" onClick={() => void save('pdf', true)}>
                Print
              </Button>
            </div>
          </div>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          {report.data?.notes.map((note) => (
            <p key={note} className="text-xs text-muted-foreground">
              {note}
            </p>
          ))}
          {report.isError ? (
            <p className="text-sm text-destructive">{apiErrorMessage(report.error)}</p>
          ) : null}
          <div className="overflow-x-auto rounded-lg border print:border-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  {(report.data?.columns ?? []).map((column) => (
                    <th key={column.key} className="px-2 py-2 font-medium">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(report.data?.rows ?? []).map((row, index) => (
                  <tr key={index} className="border-t">
                    {(report.data?.columns ?? []).map((column) => (
                      <td key={column.key} className="px-2 py-1 align-top">
                        {String(row[column.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>{report.data ? `${report.data.total} records` : ''}</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((value) => value - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!report.data || page * report.data.limit >= report.data.total}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function open(reportKey: string) {
    setKey(reportKey);
    setPage(1);
  }

  async function save(format: 'xlsx' | 'csv' | 'pdf', print = false) {
    try {
      const blob = await downloadCatalogueReport(key, format, compact(filters));
      const url = URL.createObjectURL(blob);
      if (print) {
        const popup = window.open(url);
        popup?.addEventListener('load', () => popup.print());
        return;
      }
      const link = document.createElement('a');
      link.href = url;
      link.download = `${key}.${format === 'xlsx' ? 'xlsx' : format}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
  }
}

function Stat({
  label,
  value,
  report,
  onOpen,
}: {
  label: string;
  value: number;
  report: string;
  onOpen: (key: string) => void;
}) {
  return (
    <button
      type="button"
      className="rounded-lg border px-3 py-2 text-left"
      onClick={() => onOpen(report)}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </button>
  );
}

function groupReports(reports: { key: string; title: string; group: string }[]) {
  const map = new Map<string, { key: string; title: string; group: string }[]>();
  for (const report of reports) {
    const list = map.get(report.group) ?? [];
    list.push(report);
    map.set(report.group, list);
  }
  return [...map.entries()];
}

function compact(filters: Filters & { page?: number; limit?: number }) {
  const params: Record<string, string | number | undefined> = { ...filters };
  for (const key of Object.keys(params)) {
    if (params[key] === '' || params[key] == null) delete params[key];
  }
  return params;
}
