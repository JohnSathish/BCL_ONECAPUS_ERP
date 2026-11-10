'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Download, Printer, Search, Smartphone } from 'lucide-react';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { printInstallationNotice } from '@/lib/administration/app-installation-notice';
import {
  downloadInstallationExport,
  fetchInstallationReport,
  type InstallationDepartment,
  type InstallationFilters,
  type InstallationPerson,
  type InstallationReport,
  type InstallScope,
  type InstallStatus,
} from '@/services/app-installation-report';
import { fetchAcademicYears, fetchDepartments } from '@/services/organization';
import { apiErrorMessage } from '@/utils/api-error';

const fieldClass =
  'h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground';

function tone(percent: number) {
  if (percent >= 80) return 'bg-emerald-600';
  if (percent >= 50) return 'bg-amber-500';
  return 'bg-rose-600';
}

function formatDay(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function StatusPill({ status }: { status: InstallStatus }) {
  if (status === 'INSTALLED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
        Installed
      </span>
    );
  }
  if (status === 'UNVERIFIED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
        Unverified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
      Not installed
    </span>
  );
}

function PeopleTable({ people }: { people: InstallationPerson[] }) {
  if (!people.length) {
    return <p className="px-4 py-3 text-sm text-muted-foreground">No users in this list.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[980px] w-full text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Sl.</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Roll / Staff ID</th>
            <th className="px-3 py-2">Designation / Semester</th>
            <th className="px-3 py-2">Official Email</th>
            <th className="px-3 py-2">Mobile</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Last Login</th>
            <th className="px-3 py-2">Last Active</th>
          </tr>
        </thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.id} className="border-t border-border">
              <td className="px-3 py-2 text-muted-foreground">{person.serial}</td>
              <td className="px-3 py-2 font-medium">{person.name}</td>
              <td className="px-3 py-2">{person.identifier}</td>
              <td className="px-3 py-2">{person.roleLabel}</td>
              <td className="px-3 py-2">{person.email ?? '—'}</td>
              <td className="px-3 py-2">{person.mobile ?? '—'}</td>
              <td className="px-3 py-2">
                <StatusPill status={person.status} />
              </td>
              <td className="px-3 py-2">{formatDay(person.lastLoginAt)}</td>
              <td className="px-3 py-2">{formatDay(person.lastActiveAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AppInstallationReport() {
  const [filters, setFilters] = useState<InstallationFilters>({
    category: 'ALL',
    status: 'ALL',
  });
  const [search, setSearch] = useState('');
  const [yearId, setYearId] = useState<string>();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);
  const semesterLocked = filters.category === 'TEACHING' || filters.category === 'NON_TEACHING';
  const queryFilters = useMemo<InstallationFilters>(
    () => ({
      academicYearId: yearId,
      departmentId: filters.departmentId,
      semester: semesterLocked ? undefined : filters.semester,
      shift: filters.shift,
      category: filters.category,
      status: filters.status,
      search: debouncedSearch.trim() || undefined,
    }),
    [yearId, filters, semesterLocked, debouncedSearch],
  );

  const reportQ = useQuery({
    queryKey: ['app-installation-report', queryFilters],
    queryFn: () => fetchInstallationReport(queryFilters),
  });
  const yearsQ = useQuery({ queryKey: ['academic-years'], queryFn: fetchAcademicYears });
  const departmentsQ = useQuery({
    queryKey: ['departments', 'installation-report'],
    queryFn: () => fetchDepartments(),
  });

  const report = reportQ.data;
  const selectedYear = yearId ?? report?.academicYear?.id ?? '';

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    setNotice(null);
    try {
      await task();
    } catch (error) {
      setNotice(apiErrorMessage(error, 'Could not prepare the report.'));
    } finally {
      setBusy(null);
    }
  }

  async function exportFile(format: 'pdf' | 'xlsx', scope: InstallScope, departmentId?: string) {
    await downloadInstallationExport({
      ...queryFilters,
      departmentId: departmentId ?? queryFilters.departmentId,
      status: scope === 'pending' ? undefined : queryFilters.status,
      format,
      scope,
    });
  }

  function printReport(scope: InstallScope, source?: InstallationReport) {
    const current = source ?? report;
    if (!current) return;
    printInstallationNotice(current, scope);
  }

  function printDepartment(department: InstallationDepartment) {
    if (!report) return;
    const summary = {
      total: department.total,
      installed: department.installed,
      notInstalled: department.notInstalled,
      unverified: department.unverified,
      percent: department.percent,
      highest: {
        id: department.id,
        name: department.name,
        percent: department.percent,
        total: department.total,
      },
      lowest: {
        id: department.id,
        name: department.name,
        percent: department.percent,
        total: department.total,
      },
    };
    printReport('department', {
      ...report,
      summary,
      departments: [{ ...department, serial: 1 }],
    });
  }

  const allOpen = Boolean(
    report && report.departments.length && report.departments.every((row) => open[row.id]),
  );

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Academic year
            <select
              className={fieldClass}
              value={selectedYear}
              onChange={(event) => setYearId(event.target.value || undefined)}
            >
              {!selectedYear ? <option value="">Current session</option> : null}
              {(yearsQ.data ?? []).map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
              {report?.academicYear &&
              !(yearsQ.data ?? []).some((year) => year.id === report.academicYear?.id) ? (
                <option value={report.academicYear.id}>{report.academicYear.name}</option>
              ) : null}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Department
            <select
              className={fieldClass}
              value={filters.departmentId ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  departmentId: event.target.value || undefined,
                }))
              }
            >
              <option value="">All departments</option>
              <option value="unassigned">Unassigned</option>
              {(departmentsQ.data ?? []).map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Semester (students)
            <select
              className={fieldClass}
              disabled={semesterLocked}
              value={semesterLocked ? '' : String(filters.semester ?? '')}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  semester: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
            >
              <option value="">All semesters</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Shift
            <select
              className={fieldClass}
              value={filters.shift ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  shift: (event.target.value || undefined) as InstallationFilters['shift'],
                }))
              }
            >
              <option value="">All shifts</option>
              <option value="MORNING">Morning</option>
              <option value="DAY">Day</option>
              <option value="EVENING">Evening</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            User category
            <select
              className={fieldClass}
              value={filters.category ?? 'ALL'}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  category: event.target.value as InstallationFilters['category'],
                }))
              }
            >
              <option value="ALL">All categories</option>
              <option value="TEACHING">Teaching staff</option>
              <option value="NON_TEACHING">Non-teaching staff</option>
              <option value="STUDENTS">Students</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Installation status
            <select
              className={fieldClass}
              value={filters.status ?? 'ALL'}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  status: event.target.value as InstallationFilters['status'],
                }))
              }
            >
              <option value="ALL">All</option>
              <option value="INSTALLED">Installed</option>
              <option value="NOT_INSTALLED">Not installed</option>
              <option value="UNVERIFIED">Unverified</option>
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">
            Search name, roll number or staff ID
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="pl-9"
              />
            </span>
          </label>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Semester applies to students. Choosing a semester leaves staff out of this view. Morning,
          Day and Evening include staff marked for both Morning and Day when either of those shifts
          is selected.
        </p>
      </section>

      {reportQ.isError ? (
        <QueryErrorPanel error={reportQ.error} onRetry={() => void reportQ.refetch()} />
      ) : null}
      {notice ? (
        <p
          className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          role="alert"
        >
          {notice}
        </p>
      ) : null}

      {reportQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading live installation records…</p>
      ) : null}

      {report ? (
        <>
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Stat
              label="Total registered users"
              value={report.summary.total}
              hint="Students on the rolls and staff in service"
            />
            <Stat
              label="App installed"
              value={report.summary.installed}
              hint="Active device with a valid push token"
              bar={report.summary.percent}
              toneClass="bg-emerald-600"
            />
            <Stat
              label="Not installed"
              value={report.summary.notInstalled}
              hint="No college app device registration"
              bar={share(report.summary.notInstalled, report.summary.total)}
              toneClass="bg-rose-600"
            />
            <Stat
              label="Unverified"
              value={report.summary.unverified}
              hint="Device record without a usable token"
              bar={share(report.summary.unverified, report.summary.total)}
              toneClass="bg-slate-500"
            />
            <Stat
              label="Installation percentage"
              value={`${report.summary.percent.toFixed(1)}%`}
              hint="Installed divided by registered users"
              bar={report.summary.percent}
              toneClass={tone(report.summary.percent)}
            />
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Department rates
              </p>
              <p className="mt-2 text-sm">
                Highest:{' '}
                <span className="font-semibold">
                  {report.summary.highest
                    ? `${report.summary.highest.name} (${report.summary.highest.percent.toFixed(1)}%)`
                    : '—'}
                </span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-emerald-600"
                  style={{ width: `${report.summary.highest?.percent ?? 0}%` }}
                />
              </div>
              <p className="mt-3 text-sm">
                Lowest:{' '}
                <span className="font-semibold">
                  {report.summary.lowest
                    ? `${report.summary.lowest.name} (${report.summary.lowest.percent.toFixed(1)}%)`
                    : '—'}
                </span>
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${tone(report.summary.lowest?.percent ?? 0)}`}
                  style={{ width: `${report.summary.lowest?.percent ?? 0}%` }}
                />
              </div>
            </div>
          </section>

          <p className="text-sm text-muted-foreground">{report.populationNote}</p>
          <p className="text-sm text-muted-foreground">{report.basis}</p>
          <p className="text-xs text-muted-foreground">
            {report.collegeName} · {report.academicYear?.name ?? 'Academic year not set'} ·
            Generated {report.generatedLabel}
            {reportQ.isFetching ? ' · Updating…' : ''}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={Boolean(busy)}
              title="A4 notice for the current year, department, semester, shift, category, and search. Lists people who have not installed the app. Phone numbers and email addresses are left off this copy."
              onClick={() => void run('notice-pdf', () => exportFile('pdf', 'pending'))}
            >
              <Download className="mr-2 h-4 w-4" />
              {busy === 'notice-pdf' ? 'Preparing…' : 'Notice PDF'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => void run('detail-pdf', () => exportFile('pdf', 'detailed'))}
            >
              <Download className="mr-2 h-4 w-4" />
              {busy === 'detail-pdf' ? 'Preparing…' : 'Detailed PDF'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() => void run('excel', () => exportFile('xlsx', 'detailed'))}
            >
              <Download className="mr-2 h-4 w-4" />
              {busy === 'excel' ? 'Preparing…' : 'Excel'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!report}
              onClick={() => printReport('summary')}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print summary
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!report}
              onClick={() => printReport('detailed')}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print detailed
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={() =>
                void run('print-pending', async () => {
                  const pending = await fetchInstallationReport({
                    ...queryFilters,
                    status: undefined,
                    presentation: 'pending',
                  });
                  printInstallationNotice(pending, 'pending');
                })
              }
            >
              <Printer className="mr-2 h-4 w-4" />
              {busy === 'print-pending' ? 'Preparing…' : 'Print pending'}
            </Button>
          </div>

          <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Department-wise report</h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (!report.departments.length) return;
                  if (allOpen) {
                    setOpen({});
                    return;
                  }
                  setOpen(Object.fromEntries(report.departments.map((row) => [row.id, true])));
                }}
              >
                {allOpen ? 'Collapse all' : 'Expand all'}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Sl. No.</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2 text-right">Total users</th>
                    <th className="px-3 py-2 text-right">Installed</th>
                    <th className="px-3 py-2 text-right">Not installed</th>
                    <th className="px-3 py-2">Installation %</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {report.departments.map((department) => {
                    const expanded = Boolean(open[department.id]);
                    return (
                      <DepartmentBlock
                        key={department.id}
                        department={department}
                        expanded={expanded}
                        busy={busy}
                        onToggle={() =>
                          setOpen((current) => ({
                            ...current,
                            [department.id]: !current[department.id],
                          }))
                        }
                        onPrint={() => printDepartment(department)}
                        onPdf={() =>
                          void run(`pdf-${department.id}`, () =>
                            exportFile('pdf', 'department', department.id),
                          )
                        }
                      />
                    );
                  })}
                  {!report.departments.length ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                        No users match these filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function share(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function Stat({
  label,
  value,
  hint,
  bar,
  toneClass = 'bg-primary',
}: {
  label: string;
  value: string | number;
  hint: string;
  bar?: number;
  toneClass?: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {bar != null ? (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full ${toneClass}`}
            style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
          />
        </div>
      ) : null}
    </article>
  );
}

function DepartmentBlock({
  department,
  expanded,
  busy,
  onToggle,
  onPrint,
  onPdf,
}: {
  department: InstallationDepartment;
  expanded: boolean;
  busy: string | null;
  onToggle: () => void;
  onPrint: () => void;
  onPdf: () => void;
}) {
  return (
    <>
      <tr className="border-t border-border">
        <td className="px-3 py-3">{department.serial}</td>
        <td className="px-3 py-3">
          <button
            type="button"
            className="inline-flex items-center gap-1 font-medium"
            onClick={onToggle}
          >
            <ChevronRight className={`h-4 w-4 transition ${expanded ? 'rotate-90' : ''}`} />
            {department.name}
          </button>
        </td>
        <td className="px-3 py-3 text-right">{department.total}</td>
        <td className="px-3 py-3 text-right text-emerald-700">{department.installed}</td>
        <td className="px-3 py-3 text-right text-rose-700">{department.notInstalled}</td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${tone(department.percent)}`}
                style={{ width: `${department.percent}%` }}
              />
            </div>
            <span className="font-medium">{department.percent.toFixed(1)}%</span>
          </div>
          {department.unverified ? (
            <p className="mt-1 text-xs text-slate-500">{department.unverified} unverified</p>
          ) : null}
        </td>
        <td className="px-3 py-3">
          <div className="flex justify-end gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={onPrint}>
              Print
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={Boolean(busy)}
              onClick={onPdf}
            >
              {busy === `pdf-${department.id}` ? '…' : 'PDF'}
            </Button>
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={7} className="p-0">
            <PeopleTable people={department.people} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
