'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  Download,
  FileSpreadsheet,
  FileText,
  LineChart,
  Loader2,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { exportFeeReport, fetchFeeReconciliationReport } from '@/services/fee-cycle';
import { fetchFeeDashboard, fetchFeeReport } from '@/services/fees';
import {
  ALL_FEE_REPORTS,
  DEFAULT_SAVED_TEMPLATES,
  FEE_REPORT_CATEGORIES,
  SCHEDULE_PRESETS,
  type FeeReportDefinition,
  type FeeReportId,
} from '@/components/fees-module/financial-reports.constants';
import { cn } from '@/utils/cn';

type ReportFilters = {
  from: string;
  to: string;
  semester: string;
  programme: string;
  department: string;
  shift: string;
  category: string;
  feeHead: string;
  paymentMode: string;
  status: string;
};

type SavedTemplate = { id: string; name: string; reportId: FeeReportId };
type ScheduledReport = {
  id: string;
  label: string;
  frequency: string;
  recipients: string;
  enabled: boolean;
};

const TEMPLATES_KEY = 'fee-report-templates-v1';
const SCHEDULE_KEY = 'fee-report-schedules-v1';

function money(value?: number | string | null) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
}

function formatCell(key: string, value: unknown) {
  if (value == null || value === '') return '—';
  if (
    [
      'amount',
      'total',
      'collected',
      'outstanding',
      'demanded',
      'paid',
      'pending',
      'balanceAmount',
      'amountDue',
      'lateFee',
      'amountWaived',
      'balance',
      'admission',
      'monthly',
      'fine',
      'other',
      'totalDemand',
    ].includes(key)
  ) {
    return money(Number(value));
  }
  if (key === 'paidAt' || key === 'performedAt' || key === 'date') {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-IN');
  }
  return String(value);
}

async function downloadReport(
  apiType: string,
  format: 'csv' | 'xlsx' | 'pdf',
  params: Record<string, string>,
) {
  try {
    if (format === 'csv') {
      const res = (await exportFeeReport(apiType, 'csv', params)) as {
        content?: string;
        filename?: string;
      };
      const blob = new Blob([res.content ?? ''], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename ?? `${apiType}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const blob = (await exportFeeReport(apiType, format, params)) as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${apiType}-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    window.alert(message);
  }
}

export function FinancialReportsCenter() {
  const [tab, setTab] = useState<'reports' | 'analytics' | 'saved' | 'scheduled'>('reports');
  const [categoryId, setCategoryId] = useState(FEE_REPORT_CATEGORIES[0].id);
  const [activeReportId, setActiveReportId] = useState<FeeReportId>('daily-collection');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ReportFilters>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
    semester: '',
    programme: '',
    department: '',
    shift: '',
    category: '',
    feeHead: '',
    paymentMode: '',
    status: '',
  });
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>(DEFAULT_SAVED_TEMPLATES);
  const [schedules, setSchedules] = useState<ScheduledReport[]>(
    SCHEDULE_PRESETS.map((s) => ({
      id: s.id,
      label: s.label,
      frequency: s.frequency,
      recipients: 'principal@college.edu, accounts@college.edu',
      enabled: false,
    })),
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(TEMPLATES_KEY);
      if (raw) setSavedTemplates(JSON.parse(raw) as SavedTemplate[]);
      const sched = localStorage.getItem(SCHEDULE_KEY);
      if (sched) setSchedules(JSON.parse(sched) as ScheduledReport[]);
    } catch {
      /* ignore */
    }
  }, []);

  const activeReport = useMemo(
    () => ALL_FEE_REPORTS.find((r) => r.id === activeReportId) ?? ALL_FEE_REPORTS[0],
    [activeReportId],
  );

  const queryParams = useMemo(
    () => ({
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
    [filters.from, filters.to],
  );

  const dashboardQ = useQuery({ queryKey: ['fees', 'dashboard'], queryFn: fetchFeeDashboard });
  const reconciliationQ = useQuery({
    queryKey: ['fees', 'reconciliation-summary'],
    queryFn: () => fetchFeeReconciliationReport(),
  });

  const reportQ = useQuery({
    queryKey: ['fees', 'financial-report', activeReport.apiType, queryParams],
    queryFn: () => fetchFeeReport(activeReport.apiType, queryParams),
    enabled: Boolean(activeReport.apiType) && !activeReport.link && !activeReport.soon,
  });

  const kpis = dashboardQ.data?.kpis;
  const pendingVerification =
    (kpis as { externalPendingVerification?: number } | undefined)?.externalPendingVerification ??
    reconciliationQ.data?.pendingVerification?.count ??
    0;
  const defaulterCount =
    (kpis as { defaulterCount?: number } | undefined)?.defaulterCount ??
    dashboardQ.data?.defaulters?.length ??
    0;

  const rows = (reportQ.data as { rows?: Record<string, unknown>[] } | undefined)?.rows ?? [];
  const reportTotal = (reportQ.data as { total?: number } | undefined)?.total ?? 0;
  const cashSummary = (reportQ.data as { summary?: Record<string, number> } | undefined)?.summary;

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return FEE_REPORT_CATEGORIES;
    return FEE_REPORT_CATEGORIES.map((cat) => ({
      ...cat,
      reports: cat.reports.filter(
        (r) => r.label.toLowerCase().includes(q) || r.description.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.reports.length > 0);
  }, [search]);

  function persistTemplates(next: SavedTemplate[]) {
    setSavedTemplates(next);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(next));
  }

  function persistSchedules(next: ScheduledReport[]) {
    setSchedules(next);
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
  }

  function selectReport(report: FeeReportDefinition) {
    if (report.link) {
      window.location.assign(report.link);
      return;
    }
    setActiveReportId(report.id);
    setCategoryId(
      FEE_REPORT_CATEGORIES.find((c) => c.reports.some((r) => r.id === report.id))?.id ??
        categoryId,
    );
  }

  function saveCurrentTemplate() {
    const name = window.prompt('Name this report template');
    if (!name?.trim()) return;
    persistTemplates([
      ...savedTemplates,
      { id: `tpl-${Date.now()}`, name: name.trim(), reportId: activeReportId },
    ]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financial Reports & Analytics Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate audit-ready fee reports with filters and one-click PDF, Excel, and CSV export.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          label="Today's Collection"
          value={money(kpis?.todayCollection)}
          icon={Wallet}
          tone="emerald"
        />
        <KpiCard
          label="Monthly Collection"
          value={money(kpis?.monthlyCollection)}
          icon={BarChart3}
          tone="blue"
        />
        <KpiCard
          label="Academic Year Collection"
          value={money(kpis?.totalCollected)}
          icon={TrendingUp}
          tone="violet"
        />
        <KpiCard
          label="Outstanding"
          value={money(kpis?.outstanding)}
          icon={AlertTriangle}
          tone="rose"
        />
        <KpiCard
          label="Defaulters"
          value={String(defaulterCount)}
          icon={AlertTriangle}
          tone="amber"
        />
        <KpiCard
          label="Pending Verifications"
          value={String(pendingVerification)}
          icon={FileText}
          tone="slate"
        />
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border bg-muted/30 p-1">
        {(
          [
            ['reports', 'Reports'],
            ['analytics', 'Analytics'],
            ['saved', 'Saved Templates'],
            ['scheduled', 'Scheduled Reports'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === id
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'reports' ? (
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Find a report</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search reports…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              {filteredCategories.map((cat) => (
                <Card
                  key={cat.id}
                  className={cn(categoryId === cat.id && 'ring-1 ring-primary/30')}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <cat.icon className="h-4 w-4 text-primary" />
                      {cat.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {cat.reports.map((report) => (
                      <button
                        key={report.id}
                        type="button"
                        onClick={() => {
                          setCategoryId(cat.id);
                          selectReport(report);
                        }}
                        className={cn(
                          'w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted/70',
                          activeReportId === report.id && 'bg-primary/10 font-medium text-primary',
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <report.icon className="h-3.5 w-3.5 shrink-0" />
                          {report.label}
                          {report.soon ? (
                            <Badge variant="secondary" className="ml-auto text-[10px]">
                              Soon
                            </Badge>
                          ) : null}
                        </span>
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {report.description}
                        </p>
                      </button>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-4 xl:col-span-9">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Global report filters</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FilterField
                  label="Date from"
                  type="date"
                  value={filters.from}
                  onChange={(v) => setFilters((f) => ({ ...f, from: v }))}
                />
                <FilterField
                  label="Date to"
                  type="date"
                  value={filters.to}
                  onChange={(v) => setFilters((f) => ({ ...f, to: v }))}
                />
                <FilterField
                  label="Semester"
                  value={filters.semester}
                  onChange={(v) => setFilters((f) => ({ ...f, semester: v }))}
                  placeholder="All semesters"
                />
                <FilterField
                  label="Programme"
                  value={filters.programme}
                  onChange={(v) => setFilters((f) => ({ ...f, programme: v }))}
                  placeholder="All programmes"
                />
                <FilterField
                  label="Department"
                  value={filters.department}
                  onChange={(v) => setFilters((f) => ({ ...f, department: v }))}
                  placeholder="All departments"
                />
                <FilterField
                  label="Shift"
                  value={filters.shift}
                  onChange={(v) => setFilters((f) => ({ ...f, shift: v }))}
                  placeholder="All shifts"
                />
                <FilterField
                  label="Student category"
                  value={filters.category}
                  onChange={(v) => setFilters((f) => ({ ...f, category: v }))}
                  placeholder="All categories"
                />
                <FilterField
                  label="Payment mode"
                  value={filters.paymentMode}
                  onChange={(v) => setFilters((f) => ({ ...f, paymentMode: v }))}
                  placeholder="All modes"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                <div>
                  <CardTitle className="text-base">{activeReport.label}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{activeReport.description}</p>
                </div>
                {activeReport.exportable ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void downloadReport(
                          activeReport.apiType,
                          'csv',
                          queryParams as Record<string, string>,
                        )
                      }
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void downloadReport(
                          activeReport.apiType,
                          'xlsx',
                          queryParams as Record<string, string>,
                        )
                      }
                    >
                      <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                      Excel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        void downloadReport(
                          activeReport.apiType,
                          'pdf',
                          queryParams as Record<string, string>,
                        )
                      }
                    >
                      <FileText className="mr-1 h-3.5 w-3.5" />
                      PDF
                    </Button>
                    <Button size="sm" variant="ghost" onClick={saveCurrentTemplate}>
                      <Bookmark className="mr-1 h-3.5 w-3.5" />
                      Save template
                    </Button>
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                {activeReport.soon ? (
                  <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    Compliance report packs (NAAC, UGC, management) are being prepared. Use
                    Collection and Fee Head reports for current audit needs.
                  </p>
                ) : activeReport.link ? (
                  <p className="text-sm text-muted-foreground">
                    Open the dedicated workspace:{' '}
                    <Link href={activeReport.link} className="font-medium text-primary underline">
                      {activeReport.label}
                    </Link>
                  </p>
                ) : reportQ.isLoading ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading report…
                  </div>
                ) : (
                  <>
                    <div className="mb-4 grid gap-3 sm:grid-cols-3">
                      <SummaryTile label="Report total" value={money(reportTotal)} />
                      <SummaryTile label="Rows" value={String(rows.length)} />
                      {cashSummary ? (
                        <SummaryTile label="Closing balance" value={money(cashSummary.closing)} />
                      ) : (
                        <SummaryTile label="Fines accrued" value={money(kpis?.fines)} />
                      )}
                    </div>

                    {cashSummary ? (
                      <div className="mb-4 grid gap-2 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-5">
                        <span>
                          Opening: <strong>{money(cashSummary.opening)}</strong>
                        </span>
                        <span>
                          Collections: <strong>{money(cashSummary.collections)}</strong>
                        </span>
                        <span>
                          Refunds: <strong>{money(cashSummary.refunds)}</strong>
                        </span>
                        <span>
                          Adjustments: <strong>{money(cashSummary.adjustments)}</strong>
                        </span>
                        <span>
                          Closing: <strong>{money(cashSummary.closing)}</strong>
                        </span>
                      </div>
                    ) : null}

                    <div className="overflow-auto rounded-lg border">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                          <tr>
                            {activeReport.columns.map((col) => (
                              <th
                                key={col.key}
                                className={cn('px-3 py-2', col.align === 'right' && 'text-right')}
                              >
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length ? (
                            rows.slice(0, 100).map((row, idx) => (
                              <tr
                                key={String(row.id ?? row.transactionNo ?? row.receiptNo ?? idx)}
                                className="border-t"
                              >
                                {activeReport.columns.map((col) => (
                                  <td
                                    key={col.key}
                                    className={cn(
                                      'px-3 py-2',
                                      col.align === 'right' && 'text-right font-medium',
                                    )}
                                  >
                                    {formatCell(col.key, row[col.key])}
                                  </td>
                                ))}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={activeReport.columns.length || 1}
                                className="px-3 py-8 text-center text-muted-foreground"
                              >
                                No records for the selected filters.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {rows.length > 100 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Showing first 100 of {rows.length} rows. Export for the full dataset.
                      </p>
                    ) : null}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === 'analytics' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <AnalyticsCard title="Monthly collection trend" data={dashboardQ.data?.trends ?? []} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Finance analytics</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Insight label="Top admission collection" value={money(kpis?.admissionCollection)} />
              <Insight label="Top monthly collection" value={money(kpis?.monthlyCollection)} />
              <Insight label="Admission outstanding" value={money(kpis?.admissionOutstanding)} />
              <Insight label="Monthly outstanding" value={money(kpis?.monthlyOutstanding)} />
              <Insight
                label="Collection efficiency"
                value={
                  kpis?.totalDemanded
                    ? `${Math.round((Number(kpis.totalCollected) / Number(kpis.totalDemanded)) * 100)}%`
                    : '—'
                }
              />
              <Insight label="Defaulter students" value={String(defaulterCount)} />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Payment mode split</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {reconciliationQ.data?.totals
                  ? Object.entries(reconciliationQ.data.totals as Record<string, number>)
                      .filter(([, v]) => Number(v) > 0)
                      .map(([mode, amount]) => (
                        <div key={mode} className="rounded-lg border px-3 py-2">
                          <p className="text-xs text-muted-foreground">{mode.replace(/_/g, ' ')}</p>
                          <p className="font-semibold">{money(amount)}</p>
                        </div>
                      ))
                  : null}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'saved' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved report templates</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {savedTemplates.map((tpl) => {
              const def = ALL_FEE_REPORTS.find((r) => r.id === tpl.reportId);
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setTab('reports');
                    if (def) selectReport(def);
                  }}
                  className="rounded-xl border p-4 text-left hover:bg-muted/40"
                >
                  <p className="font-semibold">{tpl.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{def?.label ?? tpl.reportId}</p>
                </button>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'scheduled' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scheduled reports</CardTitle>
            <p className="text-sm text-muted-foreground">
              Configure auto-email to Principal, Vice Principal, Bursar, and Accounts. Delivery
              integrates with institution notification settings.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedules.map((sched, idx) => (
              <div key={sched.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{sched.label}</p>
                    <p className="text-xs text-muted-foreground">{sched.frequency}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={sched.enabled}
                      onChange={(e) => {
                        const next = [...schedules];
                        next[idx] = { ...sched, enabled: e.target.checked };
                        persistSchedules(next);
                      }}
                    />
                    Enabled
                  </label>
                </div>
                <div className="mt-3">
                  <Label className="text-xs">Email recipients</Label>
                  <Input
                    className="mt-1"
                    value={sched.recipients}
                    onChange={(e) => {
                      const next = [...schedules];
                      next[idx] = { ...sched, recipients: e.target.value };
                      persistSchedules(next);
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  tone: 'emerald' | 'blue' | 'violet' | 'rose' | 'amber' | 'slate';
}) {
  const tones = {
    emerald: 'text-emerald-600 bg-emerald-50',
    blue: 'text-blue-600 bg-blue-50',
    violet: 'text-violet-600 bg-violet-50',
    rose: 'text-rose-600 bg-rose-50',
    amber: 'text-amber-600 bg-amber-50',
    slate: 'text-slate-600 bg-slate-50',
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-5">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        className="mt-1"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function AnalyticsCard({
  title,
  data,
}: {
  title: string;
  data: Array<{ month: string; collected: number }>;
}) {
  const max = Math.max(...data.map((d) => d.collected), 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <LineChart className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length ? (
          <div className="flex h-40 items-end gap-2">
            {data.map((d) => (
              <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${Math.max(8, (d.collected / max) * 100)}%` }}
                  title={money(d.collected)}
                />
                <span className="text-[10px] text-muted-foreground">{d.month.slice(5)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No trend data yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
