'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Clock,
  FileSpreadsheet,
  FileText,
  Layers,
  Library,
  Link2,
  Monitor,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchAcademicYears } from '@/services/organization';
import {
  downloadLibraryNaacReport,
  fetchCatalogueReportOptions,
  fetchLibraryNaacReportSummary,
  linkLibraryNaacEvidence,
} from '@/services/library';
import type { LibraryNaacReportBundle } from '@/types/library';
import { apiErrorMessage } from '@/utils/api-error';
import { downloadBlob } from '@/utils/download-blob';

const currentYear = new Date().getFullYear();
const defaultFrom = `${currentYear}-01-01`;
const defaultTo = new Date().toISOString().slice(0, 10);
const METRICS = [
  { code: '4.2.1', label: '4.2.1 (NAAC)' },
  { code: '4.2.3', label: '4.2.3 Library titles' },
];
const TABS = [
  ['overview', 'Collection Overview'],
  ['usage', 'Usage Statistics'],
  ['digital', 'E-Resources'],
  ['departments', 'Department-wise'],
  ['years', 'Year-wise Growth'],
  ['members', 'Member Statistics'],
  ['metrics', 'NAAC Metrics'],
  ['export', 'Export & Evidence'],
] as const;
const COLORS = ['#2563eb', '#14b8a6', '#f59e0b', '#a78bfa', '#ec4899', '#94a3b8', '#22c55e'];

type Medium = 'ALL' | 'PHYSICAL' | 'DIGITAL';
type Tab = (typeof TABS)[number][0];
type Filters = {
  from: string;
  to: string;
  academicYear: string;
  departmentId: string;
  categoryId: string;
  medium: Medium;
  metricCode: string;
};

const INITIAL: Filters = {
  from: defaultFrom,
  to: defaultTo,
  academicYear: '',
  departmentId: '',
  categoryId: '',
  medium: 'ALL',
  metricCode: '4.2.1',
};

export function LibraryNaacReportsWorkspace() {
  const enabled = useAuthQueryEnabled();
  const [draft, setDraft] = useState<Filters>(INITIAL);
  const [applied, setApplied] = useState<Filters>(INITIAL);
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  const years = useQuery({
    queryKey: ['organization', 'academic-years'],
    queryFn: fetchAcademicYears,
    enabled,
  });
  const options = useQuery({
    queryKey: ['library', 'catalogue-reports', 'options'],
    queryFn: fetchCatalogueReportOptions,
    enabled,
  });
  const summary = useQuery({
    queryKey: ['library', 'naac-reports', applied],
    queryFn: () =>
      fetchLibraryNaacReportSummary({
        from: applied.from,
        to: applied.to,
        academicYear: applied.academicYear || undefined,
        departmentId: applied.departmentId || undefined,
        categoryId: applied.categoryId || undefined,
        medium: applied.medium === 'ALL' ? undefined : applied.medium,
      }),
    enabled,
  });

  const exportParams = {
    from: applied.from,
    to: applied.to,
    academicYear: applied.academicYear || undefined,
    departmentId: applied.departmentId || undefined,
    categoryId: applied.categoryId || undefined,
    medium: applied.medium === 'ALL' ? undefined : applied.medium,
  };
  const exportMut = useMutation({
    mutationFn: async (format: 'pdf' | 'xlsx' | 'csv') => {
      const blob = await downloadLibraryNaacReport(format, exportParams);
      downloadBlob(blob, `library-naac-${applied.to}.${format === 'csv' ? 'zip' : format}`);
    },
    onSuccess: (_, format) =>
      setMessage(
        `Downloaded the ${format.toUpperCase()} bundle for ${applied.from} to ${applied.to}.`,
      ),
    onError: (error) => setMessage(apiErrorMessage(error)),
  });
  const linkMut = useMutation({
    mutationFn: () =>
      linkLibraryNaacEvidence({
        academicYear: applied.academicYear || draft.academicYear,
        from: applied.from,
        to: applied.to,
        criterion: 4,
        metricCode: applied.metricCode,
        format: 'pdf',
        evidenceNotes: `Library NAAC bundle ${applied.from} to ${applied.to}`,
      }),
    onSuccess: (result) =>
      setMessage(`Linked the PDF to IQAC evidence (${result.tag.id.slice(0, 8)}).`),
    onError: (error) => setMessage(apiErrorMessage(error)),
  });

  const bundle = summary.data;
  const overview = bundle?.overview;
  const departments = departmentChart(overview?.departments ?? []);
  const visibleDepartments = (overview?.departments ?? []).filter((row) =>
    row.department.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const yearsShown = (overview?.years ?? []).slice(-12);

  function applyYear(id: string) {
    const year = (years.data ?? []).find((item) => item.id === id);
    setDraft((current) => ({
      ...current,
      academicYear: year?.name ?? '',
      from: year?.startDate?.slice(0, 10) || current.from,
      to: year?.endDate?.slice(0, 10) || current.to,
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Library / Reports / NAAC Library Reports</p>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <FileText className="h-5 w-5 text-blue-600" />
            NAAC Library Reports
          </h1>
          <p className="text-sm text-slate-500">
            Audit-ready reports for NAAC Criterion 4 – Infrastructure and Learning Resources
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={exportMut.isPending} onClick={() => exportMut.mutate('pdf')}>
            <FileText className="mr-2 h-4 w-4" /> Export PDF
          </Button>
          <Button
            variant="outline"
            disabled={exportMut.isPending}
            onClick={() => exportMut.mutate('xlsx')}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Export Excel
          </Button>
          <Button
            variant="outline"
            disabled={exportMut.isPending}
            onClick={() => exportMut.mutate('csv')}
          >
            CSV (ZIP)
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={linkMut.isPending || !(applied.academicYear || draft.academicYear)}
            onClick={() => linkMut.mutate()}
          >
            <Link2 className="mr-2 h-4 w-4" /> Generate NAAC Report
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Stat
          icon={BookOpen}
          label="Total Titles (Distinct)"
          value={overview?.titles}
          growth={overview?.growth.titles}
          hint="Unique book titles"
          tone="bg-blue-50 text-blue-700"
        />
        <Stat
          icon={Layers}
          label="Total Physical Copies"
          value={overview?.copies}
          growth={overview?.growth.copies}
          hint="Total copies in collection"
          tone="bg-emerald-50 text-emerald-700"
        />
        <Stat
          icon={Monitor}
          label="E-Resources"
          value={overview?.digital}
          growth={overview?.growth.digital}
          hint="Published digital resources"
          tone="bg-violet-50 text-violet-700"
        />
        <Stat
          icon={Users}
          label="Registered Members"
          value={overview?.members}
          growth={overview?.growth.members}
          hint="Students and staff with a library record"
          tone="bg-orange-50 text-orange-700"
        />
        <Stat
          icon={Library}
          label="Total Visits (Period)"
          value={overview?.visits}
          growth={overview?.growth.visits}
          hint="Library footfall"
          tone="bg-rose-50 text-rose-700"
        />
        <Stat
          icon={Clock}
          label="Active Loans"
          value={overview?.activeLoans}
          hint="Currently on loan"
          tone="bg-amber-50 text-amber-700"
        />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold">Report Parameters</h2>
        <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
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
          <select
            className="rounded-md border bg-background px-2 text-sm"
            value={(years.data ?? []).find((year) => year.name === draft.academicYear)?.id ?? ''}
            onChange={(event) => applyYear(event.target.value)}
            aria-label="Academic year"
          >
            <option value="">Academic year</option>
            {(years.data ?? []).map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background px-2 text-sm"
            value={draft.metricCode}
            onChange={(event) => setDraft({ ...draft, metricCode: event.target.value })}
            aria-label="Report version"
          >
            {METRICS.map((metric) => (
              <option key={metric.code} value={metric.code}>
                {metric.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background px-2 text-sm"
            value={draft.departmentId}
            onChange={(event) => setDraft({ ...draft, departmentId: event.target.value })}
            aria-label="Department"
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
            value={draft.categoryId}
            onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}
            aria-label="Resource type"
          >
            <option value="">All resource types</option>
            {(options.data?.categories ?? []).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background px-2 text-sm"
            value={draft.medium}
            onChange={(event) => setDraft({ ...draft, medium: event.target.value as Medium })}
            aria-label="Format"
          >
            <option value="ALL">All formats</option>
            <option value="PHYSICAL">Physical books</option>
            <option value="DIGITAL">E-resources</option>
          </select>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => {
                setApplied(draft);
                setMessage('');
              }}
            >
              Generate Report
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(INITIAL);
                setApplied(INITIAL);
              }}
            >
              Reset
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Percents compare the selected dates with the stock or activity before that range.
          Department and resource type filter the collection and loans. Visits and registered
          members stay for the whole library.
        </p>
      </section>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      {summary.isError ? (
        <p className="text-sm text-destructive">{apiErrorMessage(summary.error)}</p>
      ) : null}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${tab === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {summary.isLoading ? (
        <p className="text-sm text-slate-500">Loading the library report…</p>
      ) : null}

      {bundle && overview && (tab === 'overview' || tab === 'departments' || tab === 'years') ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {tab !== 'years' ? (
            <ChartCard title="Collection Distribution by Department">
              {departments.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departments} layout="vertical" margin={{ left: 8 }}>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="copies" fill="#2563eb" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty label="No physical copies match this report." />
              )}
            </ChartCard>
          ) : null}
          {tab === 'overview' ? (
            <ChartCard title="Resource Type Distribution">
              {overview.resourceTypes.length ? (
                <div className="grid items-center gap-2 sm:grid-cols-[160px_1fr]">
                  <div className="relative h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={overview.resourceTypes}
                          dataKey="count"
                          nameKey="name"
                          innerRadius={48}
                          outerRadius={68}
                        >
                          {overview.resourceTypes.map((row, index) => (
                            <Cell key={row.name} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-sm font-semibold">
                        {(overview.copies + overview.digital).toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-500">Total resources</p>
                    </div>
                  </div>
                  <ul className="space-y-1 text-xs">
                    {overview.resourceTypes.map((row, index) => (
                      <li key={row.name} className="flex justify-between gap-2">
                        <span className="flex items-center gap-1">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          {row.name}
                        </span>
                        <span className="text-slate-500">
                          {share(row.count, overview.copies + overview.digital)}% (
                          {row.count.toLocaleString()})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Empty label="No resources match this report." />
              )}
            </ChartCard>
          ) : null}
          {tab !== 'departments' ? (
            <ChartCard
              title="Year-wise Collection Growth"
              className={tab === 'years' ? 'xl:col-span-3' : ''}
            >
              {yearsShown.length ? (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={yearsShown}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="titles" name="Titles" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                      <Bar
                        dataKey="copies"
                        name="Physical Copies"
                        fill="#2563eb"
                        radius={[3, 3, 0, 0]}
                      />
                      <Line
                        dataKey="eResources"
                        name="E-Resources"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <Empty label="Copies need an acquisition date before a year can be plotted." />
              )}
              <p className="mt-2 text-xs text-slate-500">
                Physical copies use the acquisition year. E-resources use the year they were
                published in the library.
              </p>
            </ChartCard>
          ) : null}
        </div>
      ) : null}

      {bundle && overview && (tab === 'overview' || tab === 'metrics') ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
            <h2 className="mb-3 font-semibold">Key NAAC Indicators (Criterion 4)</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Indicator
                label="Total Collections"
                value={(overview.copies + overview.digital).toLocaleString()}
                hint="Physical + digital"
                tone="bg-violet-50 text-violet-700"
              />
              <Indicator
                label="E-Resources"
                value={overview.digital.toLocaleString()}
                hint="Published digital resources"
                tone="bg-emerald-50 text-emerald-700"
              />
              <Indicator
                label="Journals & Magazines"
                value={(
                  bundle.journalSubscriptions.printJournalTitles +
                  bundle.journalSubscriptions.digitalJournalAssets
                ).toLocaleString()}
                hint="Print titles and digital journal assets"
                tone="bg-rose-50 text-rose-700"
              />
              <Indicator
                label="Library Seating Capacity"
                value={overview.seats == null ? '—' : overview.seats.toLocaleString()}
                hint="Seats saved in library settings"
                tone="bg-orange-50 text-orange-700"
              />
              <Indicator
                label="Library Area"
                value="Not recorded"
                hint="Floor area is not stored yet"
                tone="bg-sky-50 text-sky-700"
              />
              <Indicator
                label="Library Automation"
                value={
                  overview.automation.length ? overview.automation.join(', ') : 'None switched on'
                }
                hint="Entry tools saved in library settings"
                tone="bg-indigo-50 text-indigo-700"
              />
            </div>
          </section>
          {tab === 'overview' ? (
            <UsageAndStatus bundle={bundle} />
          ) : (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 font-semibold">Expenditure on record</h2>
              <dl className="space-y-2 text-sm">
                <Row
                  label="Fines collected"
                  value={`₹${bundle.expenditure.finesCollected.toLocaleString()}`}
                />
                <Row
                  label="Fines waived"
                  value={`₹${bundle.expenditure.finesWaived.toLocaleString()}`}
                />
                <Row
                  label="Catalogued book value"
                  value={`₹${bundle.expenditure.bookValueOnShelf.toLocaleString()}`}
                />
              </dl>
              <p className="mt-3 text-xs text-slate-500">{bundle.expenditure.note}</p>
            </section>
          )}
        </div>
      ) : null}

      {bundle && (tab === 'usage' || tab === 'members') ? (
        <UsagePanels bundle={bundle} tab={tab} />
      ) : null}
      {bundle && tab === 'digital' ? <DigitalPanel bundle={bundle} /> : null}
      {bundle && overview && (tab === 'overview' || tab === 'departments') ? (
        <DepartmentTable
          rows={visibleDepartments}
          search={search}
          onSearch={setSearch}
          onExport={(format) => exportMut.mutate(format)}
        />
      ) : null}
      {tab === 'export' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <h2 className="mb-2 font-semibold text-slate-900">Export & Evidence</h2>
          <p>
            PDF, Excel, and the CSV zip use the dates and filters currently applied. Generate NAAC
            Report stores the PDF in the IQAC evidence repository under Criterion 4 and the selected
            metric. Choose an academic year before linking.
          </p>
          <Link
            href="/admin/naac/evidence"
            className="mt-3 inline-block text-blue-700 hover:underline"
          >
            Open the IQAC evidence repository
          </Link>
          <Link href="/admin/library/settings" className="mt-1 block text-blue-700 hover:underline">
            Update seating and entry tools in library settings
          </Link>
        </section>
      ) : null}
    </div>
  );
}

function UsageAndStatus({ bundle }: { bundle: LibraryNaacReportBundle }) {
  const overview = bundle.overview;
  const status = statusSlices(overview);
  const total = status.reduce((sum, row) => sum + row.value, 0);
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Usage Summary (Selected Period)</h2>
        <div className="grid grid-cols-2 gap-3">
          <Indicator
            label="Total Visits"
            value={overview.visits.toLocaleString()}
            hint="Library footfall"
            tone="bg-blue-50 text-blue-700"
          />
          <Indicator
            label="Books Issued"
            value={overview.issues.toLocaleString()}
            hint="Loans opened in the period"
            tone="bg-emerald-50 text-emerald-700"
          />
          <Indicator
            label="Active Members"
            value={overview.activeMembers.toLocaleString()}
            hint="Students and staff who borrowed"
            tone="bg-violet-50 text-violet-700"
          />
          <Indicator
            label="Avg. Loan Length"
            value={overview.averageLoanDays == null ? '—' : `${overview.averageLoanDays} days`}
            hint="Completed loans issued in the period"
            tone="bg-amber-50 text-amber-700"
          />
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Collection Status</h2>
        <ul className="space-y-2 text-sm">
          {status.map((row) => (
            <li key={row.name} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                {row.name}
              </span>
              <span className="text-slate-500">
                {row.value.toLocaleString()} · {share(row.value, total)}%
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function UsagePanels({ bundle, tab }: { bundle: LibraryNaacReportBundle; tab: Tab }) {
  const overview = bundle.overview;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {tab === 'usage' ? <UsageAndStatus bundle={bundle} /> : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">
          {tab === 'members' ? 'Member records' : 'Readers in this period'}
        </h2>
        <dl className="space-y-2 text-sm">
          <Row label="Students with a library record" value={overview.students.toLocaleString()} />
          <Row label="Staff with a library record" value={overview.staff.toLocaleString()} />
          <Row label="Student visits" value={bundle.studentUsage.totalVisits.toLocaleString()} />
          <Row label="Staff visits" value={bundle.facultyUsage.totalVisits.toLocaleString()} />
          <Row label="Student issues" value={bundle.studentUsage.totalIssues.toLocaleString()} />
          <Row label="Staff issues" value={bundle.facultyUsage.totalIssues.toLocaleString()} />
          <Row
            label="Male / female / other visits"
            value={`${bundle.footfall.male} / ${bundle.footfall.female} / ${bundle.footfall.other}`}
          />
          <Row
            label="Peak hour"
            value={`${bundle.footfall.peakHour}:00 (${bundle.footfall.peakCount} visits)`}
          />
        </dl>
      </section>
      {tab === 'usage' ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="mb-3 font-semibold">Most issued books</h2>
          <Table
            headers={['Title', 'Issues']}
            rows={bundle.readingStatistics.topBooks
              .slice(0, 10)
              .map((row) => [row.title, String(row.issueCount)])}
          />
        </section>
      ) : null}
    </div>
  );
}

function DigitalPanel({ bundle }: { bundle: LibraryNaacReportBundle }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">E-resource use</h2>
        <dl className="space-y-2 text-sm">
          <Row label="Published e-resources" value={bundle.overview.digital.toLocaleString()} />
          <Row label="Downloads" value={bundle.eResourceUsage.digitalDownloads.toLocaleString()} />
          <Row label="Views" value={bundle.eResourceUsage.digitalViews.toLocaleString()} />
          <Row
            label="Research repository access"
            value={bundle.eResourceUsage.researchAccess.toLocaleString()}
          />
          <Row
            label="Print journal titles"
            value={bundle.journalSubscriptions.printJournalTitles.toLocaleString()}
          />
          <Row
            label="Digital journal assets"
            value={bundle.journalSubscriptions.digitalJournalAssets.toLocaleString()}
          />
          <Row
            label="E-journal downloads"
            value={bundle.journalSubscriptions.eJournalDownloads.toLocaleString()}
          />
        </dl>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Most used digital titles</h2>
        <Table
          headers={['Title', 'Downloads']}
          rows={bundle.eResourceUsage.topDigital.map((row) => [row.title, String(row.downloads)])}
        />
      </section>
    </div>
  );
}

function DepartmentTable({
  rows,
  search,
  onSearch,
  onExport,
}: {
  rows: LibraryNaacReportBundle['overview']['departments'];
  search: string;
  onSearch: (value: string) => void;
  onExport: (format: 'pdf' | 'xlsx' | 'csv') => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Department-wise Book Collection</h2>
          <p className="text-xs text-slate-500">
            Distinct titles and physical copies are counted separately. Issued copies are those with
            an open loan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Search departments"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            className="w-48"
          />
          <Button size="sm" variant="outline" onClick={() => onExport('xlsx')}>
            Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => onExport('pdf')}>
            PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => onExport('csv')}>
            CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {[
                '#',
                'Department',
                'Distinct Titles',
                'Total Physical Copies',
                'Available Copies',
                'Issued Copies',
                'Overdue Copies',
                'Lost/Damaged',
                'E-Resources',
                'Total Resources',
              ].map((header) => (
                <th key={header} className="px-2 py-2 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.department} className="border-t">
                <td className="px-2 py-2">{index + 1}</td>
                <td className="px-2 py-2">{row.department}</td>
                <td className="px-2 py-2">{row.titles.toLocaleString()}</td>
                <td className="px-2 py-2">{row.copies.toLocaleString()}</td>
                <td className="px-2 py-2">{row.available.toLocaleString()}</td>
                <td className="px-2 py-2">{row.issued.toLocaleString()}</td>
                <td className="px-2 py-2">{row.overdue.toLocaleString()}</td>
                <td className="px-2 py-2">{row.lostDamaged.toLocaleString()}</td>
                <td className="px-2 py-2">{row.eResources.toLocaleString()}</td>
                <td className="px-2 py-2">{(row.copies + row.eResources).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChartCard({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  growth,
  hint,
  tone,
}: {
  icon: typeof BookOpen;
  label: string;
  value?: number;
  growth?: number | null;
  hint: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
      </p>
    </div>
  );
}

function Indicator({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <div className={`rounded-xl p-3 ${tone}`}>
      <p className="text-xs">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      <p className="text-xs opacity-80">{hint}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (!rows.length)
    return <p className="text-sm text-slate-500">Nothing was recorded for this period.</p>;
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-slate-500">
        <tr>
          {headers.map((header) => (
            <th key={header} className="py-1">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-t">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="py-1">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-10 text-center text-sm text-slate-500">{label}</p>;
}

function departmentChart(rows: LibraryNaacReportBundle['overview']['departments']) {
  const shown = rows.slice(0, 7).map((row) => ({ name: row.department, copies: row.copies }));
  const others = rows.slice(7).reduce((sum, row) => sum + row.copies, 0);
  if (others > 0) shown.push({ name: 'Others', copies: others });
  return shown.filter((row) => row.copies > 0);
}

function statusSlices(overview?: LibraryNaacReportBundle['overview']) {
  if (!overview) return [];
  return [
    { name: 'Available Copies', value: overview.status.available, color: '#2563eb' },
    { name: 'Issued Copies', value: overview.status.issued, color: '#34d399' },
    { name: 'Overdue Copies', value: overview.status.overdue, color: '#f43f5e' },
    { name: 'Lost / Damaged', value: overview.status.lostDamaged, color: '#f59e0b' },
    { name: 'Other / Reserved', value: overview.status.other, color: '#94a3b8' },
  ];
}

function share(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 1000) / 10;
}
