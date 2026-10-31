'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BookOpen, CheckCircle2, Clock, Layers, Library } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { librarySearchPanelClass } from '@/components/library/library-search-panel';
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
  const [chart, setChart] = useState<'bar' | 'pie'>('bar');

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

  const status = snapshot ? collectionStatus(snapshot) : [];
  const departments = snapshot ? departmentChart(snapshot) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Library / Reports / Collection Reports</p>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Library className="h-5 w-5 text-blue-600" />
            Library Collection Reports
          </h1>
          <p className="text-sm text-slate-500">
            Analyse the live catalogue by title, copy, department and status
          </p>
        </div>
        <Button variant="outline" onClick={() => open('principal-summary')}>
          Principal&apos;s Library Summary
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat
          icon={BookOpen}
          label="Distinct Titles"
          value={snapshot?.distinctTitles}
          hint="Unique book titles"
          growth={snapshot?.growth?.titles}
          tone="bg-blue-50 text-blue-700"
          onClick={() => open('total-titles')}
        />
        <Stat
          icon={Layers}
          label="Physical Copies"
          value={snapshot?.physicalCopies}
          hint="Total physical books"
          growth={snapshot?.growth?.copies}
          tone="bg-emerald-50 text-emerald-700"
          onClick={() => open('total-copies')}
        />
        <Stat
          icon={CheckCircle2}
          label="Available Copies"
          value={snapshot?.availableCopies}
          hint="Currently on shelf"
          tone="bg-violet-50 text-violet-700"
          onClick={() => open('available')}
        />
        <Stat
          icon={Library}
          label="Issued Copies"
          value={snapshot?.issuedCopies}
          hint="On loan to members"
          tone="bg-amber-50 text-amber-700"
          onClick={() => open('issued')}
        />
        <Stat
          icon={Clock}
          label="Overdue Copies"
          value={snapshot?.overdueCopies}
          hint="Past due date"
          tone="bg-orange-50 text-orange-700"
          onClick={() => open('overdue')}
        />
        <Stat
          icon={AlertTriangle}
          label="Lost / Damaged"
          value={snapshot ? snapshot.lostCopies + snapshot.damagedCopies : undefined}
          hint="Need replacement"
          tone="bg-rose-50 text-rose-700"
          onClick={() => open('lost')}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Physical Copies by Department</h2>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={chart === 'bar' ? 'default' : 'outline'}
                onClick={() => setChart('bar')}
              >
                Bar chart
              </Button>
              <Button
                type="button"
                size="sm"
                variant={chart === 'pie' ? 'default' : 'outline'}
                onClick={() => setChart('pie')}
              >
                Pie chart
              </Button>
            </div>
          </div>
          {departments.length ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {chart === 'bar' ? (
                  <BarChart data={departments} layout="vertical" margin={{ left: 16 }}>
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="copies" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  </BarChart>
                ) : (
                  <PieChart>
                    <Pie data={departments} dataKey="copies" nameKey="name" outerRadius={100}>
                      {departments.map((row, index) => (
                        <Cell key={row.name} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">
              {dashboard.isLoading
                ? 'Loading the collection…'
                : 'No copies are mapped to a department.'}
            </p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Collection Status Overview</h2>
          {snapshot && status.length ? (
            <div>
              <div className="grid items-center gap-3 sm:grid-cols-[180px_1fr]">
                <div className="relative h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={status.filter((row) => row.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={52}
                        outerRadius={72}
                      >
                        {status
                          .filter((row) => row.value > 0)
                          .map((row) => (
                            <Cell key={row.name} fill={row.color} />
                          ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-lg font-semibold">
                      {snapshot.physicalCopies.toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500">Total copies</p>
                  </div>
                </div>
                <ul className="space-y-2 text-sm">
                  {status.map((row) => (
                    <li key={row.name} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                        {row.name}
                      </span>
                      <span className="text-slate-500">
                        {row.value.toLocaleString()} ·{' '}
                        {share(
                          row.value,
                          status.reduce((sum, item) => sum + item.value, 0),
                        )}
                        %
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Overdue copies are the past-due part of current loans. Other is the rest of the
                physical stock, including withdrawn and reserved copies.
              </p>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-slate-500">No copies in the catalogue.</p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="px-2 text-xs font-semibold uppercase text-slate-500">Report type</p>
          {groups.map(([group, items]) => (
            <div key={group}>
              <p className="mb-1 px-2 text-xs font-medium text-slate-400">{group}</p>
              <div className="space-y-1">
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm ${item.key === key ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-50'}`}
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

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
              <option value="">All Collections</option>
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
              <option value="">All Departments</option>
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
              <option value="">Any Status</option>
              {(options.data?.statuses ?? []).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Input
              placeholder="Author name (optional)"
              value={draft.author}
              onChange={(event) => setDraft({ ...draft, author: event.target.value })}
            />
            <Input
              type="date"
              aria-label="From date"
              value={draft.from}
              onChange={(event) => setDraft({ ...draft, from: event.target.value })}
            />
            <Input
              type="date"
              aria-label="To date"
              value={draft.to}
              onChange={(event) => setDraft({ ...draft, to: event.target.value })}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Apply Filters
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

          {key === 'department-detail' ? (
            <section className={librarySearchPanelClass}>
              <h2 className="text-base font-bold text-[#0B1F44]">
                Department-Wise Detailed Book List
              </h2>
              <p className="mt-1 text-sm text-[#0B1F44]">
                View and download the department book inventory with accession numbers, authors,
                publication details, copy status and summary counts. Choose a department above, or
                All Departments.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setFilters(draft);
                    setPage(1);
                    setMessage('The table below is the live preview for the selected department.');
                  }}
                >
                  Preview Report
                </Button>
                <Button type="button" size="sm" onClick={() => void saveExcel('selected')}>
                  Download Excel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void saveExcel('consolidated')}
                >
                  Download All Departments
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void saveExcel('sheets')}
                >
                  Export Separate Department Worksheets
                </Button>
              </div>
            </section>
          ) : null}

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

  async function saveExcel(layout: 'selected' | 'consolidated' | 'sheets') {
    setMessage('Preparing the Excel report…');
    try {
      const blob = await downloadCatalogueReport('department-detail', 'xlsx', {
        ...compact(filters),
        layout,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'department-wise-detailed-book-list.xlsx';
      link.click();
      URL.revokeObjectURL(url);
      setMessage('The Excel report downloaded. Each row is one physical copy.');
    } catch (error) {
      setMessage(apiErrorMessage(error));
    }
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

const COLORS = ['#2563eb', '#60a5fa', '#34d399', '#a78bfa', '#f59e0b', '#fb7185', '#94a3b8'];

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  growth,
  tone,
  onClick,
}: {
  icon: typeof BookOpen;
  label: string;
  value?: number;
  hint: string;
  growth?: number | null;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
      onClick={onClick}
    >
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">
        {value == null ? '—' : value.toLocaleString()}
      </p>
      <p className="text-xs text-slate-500">
        {growth == null ? null : (
          <span
            className={
              growth >= 0 ? 'mr-1 font-medium text-emerald-600' : 'mr-1 font-medium text-rose-600'
            }
          >
            {growth > 0 ? '+' : ''}
            {growth}%
          </span>
        )}
        {hint}
        {growth == null ? '' : ' · 30 days'}
      </p>
    </button>
  );
}

function collectionStatus(snapshot: {
  physicalCopies: number;
  availableCopies: number;
  issuedCopies: number;
  overdueCopies: number;
  lostCopies: number;
  damagedCopies: number;
}) {
  const issued = Math.max(0, snapshot.issuedCopies - snapshot.overdueCopies);
  const lost = snapshot.lostCopies + snapshot.damagedCopies;
  const used = snapshot.availableCopies + issued + snapshot.overdueCopies + lost;
  const other = Math.max(0, snapshot.physicalCopies - used);
  return [
    { name: 'Available Copies', value: snapshot.availableCopies, color: '#2563eb' },
    { name: 'Issued, not overdue', value: issued, color: '#34d399' },
    { name: 'Overdue Copies', value: snapshot.overdueCopies, color: '#f43f5e' },
    { name: 'Lost / Damaged', value: lost, color: '#f59e0b' },
    { name: 'Other / Reserved', value: other, color: '#94a3b8' },
  ];
}

function departmentChart(snapshot: {
  physicalCopies: number;
  departments: { department: string; copies: number }[];
}) {
  const shown = snapshot.departments
    .slice(0, 7)
    .map((row) => ({ name: row.department, copies: row.copies }));
  const others = Math.max(
    0,
    snapshot.physicalCopies - shown.reduce((sum, row) => sum + row.copies, 0),
  );
  if (others > 0) shown.push({ name: 'Others', copies: others });
  return shown;
}

function share(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
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
