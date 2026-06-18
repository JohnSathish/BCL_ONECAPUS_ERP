'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  History,
  Mail,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Users,
  Wallet,
} from 'lucide-react';

import { BarChartWidget } from '@/components/analytics/charts/bar-chart-widget';
import { DonutChartWidget } from '@/components/analytics/charts/donut-chart-widget';
import { payScaleLabel } from '@/components/hr-module/pay-scale-utils';
import {
  buildPeriodParams,
  currentFinancialYearStart,
  type PeriodPreset,
} from '@/components/hr-module/payslip-period-utils';
import { GlassCard } from '@/components/erp/glass-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/utils/api-error';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { fetchDepartments } from '@/services/organization';
import { fetchAllStaff } from '@/services/staff';
import {
  downloadEmployeeMergedPayslips,
  downloadMergedPayslips,
  downloadPayslipsZip,
  downloadSalaryCertificate,
  emailPayrollRunPayslips,
  emailPayslip,
  exportBulkSalarySheet,
  exportSalaryRegister,
  fetchEmployeePayslipHistory,
  fetchPayrollRuns,
  fetchPayslipAnalytics,
  fetchPayslips,
  fetchPayslipStats,
  openPayslipPdf,
  publishPayrollRun,
  regenerateAllPayslips,
  regeneratePayslip,
} from '@/services/payroll';
import type { Payslip, PayslipListParams } from '@/types/payroll';
import { PAY_SCALE_TYPES } from '@/types/payroll';
import { cn } from '@/utils/cn';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function SummaryCard({
  label,
  value,
  hint,
  tone = 'default',
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'info' | 'danger';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const tones = {
    default: 'from-slate-50 to-white border-slate-200/80 text-slate-700',
    success: 'from-emerald-50 to-white border-emerald-200/80 text-emerald-700',
    warning: 'from-amber-50 to-white border-amber-200/80 text-amber-700',
    info: 'from-blue-50 to-white border-blue-200/80 text-blue-700',
    danger: 'from-red-50 to-white border-red-200/80 text-red-700',
  };
  return (
    <div className={cn('rounded-xl border bg-gradient-to-br px-4 py-3 shadow-sm', tones[tone])}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
          {hint ? <p className="mt-0.5 text-[10px] opacity-70">{hint}</p> : null}
        </div>
        <Icon className="h-6 w-6 shrink-0 opacity-60" />
      </div>
    </div>
  );
}

function displayStatus(p: Payslip): 'draft' | 'published' | 'paid' | 'cancelled' {
  if (p.status === 'CANCELLED') return 'cancelled';
  if (p.status === 'DRAFT') return 'draft';
  if (p.payrollRun?.paidAt) return 'paid';
  if (p.status === 'PUBLISHED') return 'published';
  return 'draft';
}

function StatusBadge({ status }: { status: ReturnType<typeof displayStatus> }) {
  const map = {
    draft: { label: 'Draft', className: 'bg-amber-100 text-amber-800 border-amber-200' },
    published: {
      label: 'Published',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
    paid: { label: 'Paid', className: 'bg-blue-100 text-blue-800 border-blue-200' },
    cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800 border-red-200' },
  };
  const cfg = map[status];
  return (
    <Badge variant="outline" className={cn('font-medium', cfg.className)}>
      {cfg.label}
    </Badge>
  );
}

function exportPayslipRowCsv(p: Payslip) {
  const rows = [
    ['Employee', p.staffProfile?.fullName ?? ''],
    ['Employee ID', p.staffProfile?.employeeCode ?? ''],
    ['Department', p.staffProfile?.department?.name ?? ''],
    ['Period', `${MONTHS_FULL[p.month - 1]} ${p.year}`],
    ['Gross', String(p.grossSalary)],
    ['Deductions', String(p.totalDeductions)],
    ['Net', String(p.netSalary)],
    ['Status', p.status],
  ];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payslip-${p.staffProfile?.employeeCode ?? p.id}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PayslipsPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [filters, setFilters] = useState<PayslipListParams>({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [searchInput, setSearchInput] = useState('');
  const [customFrom, setCustomFrom] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });
  const [customTo, setCustomTo] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const queryParams = useMemo(
    () => ({ ...filters, search: searchInput.trim() || undefined }),
    [filters, searchInput],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['payroll', 'payslips'] });
  };

  const payslipsQ = useQuery({
    queryKey: ['payroll', 'payslips', 'list', queryParams],
    queryFn: () => fetchPayslips(queryParams),
  });
  const statsQ = useQuery({
    queryKey: ['payroll', 'payslips', 'stats', queryParams],
    queryFn: () => fetchPayslipStats(queryParams),
  });
  const analyticsQ = useQuery({
    queryKey: ['payroll', 'payslips', 'analytics', queryParams],
    queryFn: () => fetchPayslipAnalytics(queryParams),
  });

  const loadError =
    payslipsQ.error || statsQ.error || analyticsQ.error
      ? apiErrorMessage(
          payslipsQ.error ?? statsQ.error ?? analyticsQ.error,
          'Failed to load payslips',
        )
      : '';
  const runsQ = useQuery({
    queryKey: ['payroll', 'runs', filters.month, filters.year],
    queryFn: () => fetchPayrollRuns({ month: filters.month, year: filters.year }),
  });
  const deptQ = useQuery({ queryKey: ['departments'], queryFn: () => fetchDepartments() });
  const staffQ = useQuery({
    queryKey: ['staff', 'payslip-filter', filters.departmentId],
    queryFn: () => fetchAllStaff({ status: 'ACTIVE', departmentId: filters.departmentId }),
  });
  const historyQ = useQuery({
    queryKey: ['payroll', 'payslips', 'history', filters.staffProfileId],
    queryFn: () => fetchEmployeePayslipHistory(filters.staffProfileId!),
    enabled: !!filters.staffProfileId,
  });

  const downloadPeriod = (
    preset: PeriodPreset,
    staffProfileId?: string,
    refMonth?: number,
    refYear?: number,
  ) => {
    const params = buildPeriodParams(
      preset,
      {
        month: refMonth ?? filters.month,
        year: refYear ?? filters.year,
        staffProfileId: staffProfileId ?? filters.staffProfileId,
        departmentId: filters.departmentId,
      },
      preset === 'custom'
        ? {
            fromMonth: customFrom.month,
            fromYear: customFrom.year,
            toMonth: customTo.month,
            toYear: customTo.year,
          }
        : undefined,
    );
    if (staffProfileId) downloadEmployeeMergedPayslips(staffProfileId, params);
    else downloadMergedPayslips(params);
  };

  const actionMut = useMutation({
    mutationFn: async (action: { type: string; payslipId?: string }) => {
      if (action.type === 'regenerate-one' && action.payslipId)
        return regeneratePayslip(action.payslipId);
      if (action.type === 'email-one' && action.payslipId) return emailPayslip(action.payslipId);
      if (action.type === 'generate-all') return regenerateAllPayslips(queryParams);
      if (action.type === 'publish-all') {
        const runs = runsQ.data ?? [];
        const pending = runs.filter((r) => r.status !== 'PUBLISHED');
        for (const r of pending) await publishPayrollRun(r.id);
        return { published: pending.length };
      }
      if (action.type === 'email-all') {
        const runs = (runsQ.data ?? []).filter((r) => r.status === 'PUBLISHED');
        for (const r of runs) await emailPayrollRunPayslips(r.id);
        return { emailed: runs.length };
      }
    },
    onSuccess: () => {
      setMessage('Action completed');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Action failed')),
  });

  const stats = statsQ.data;
  const analytics = analyticsQ.data;
  const primaryRun = runsQ.data?.[0];
  const scaleFilterHint =
    filters.payScaleType && !payslipsQ.isLoading && !payslipsQ.data?.length
      ? primaryRun?.payScaleType && primaryRun.payScaleType !== filters.payScaleType
        ? `Payroll for ${MONTHS[(filters.month ?? 1) - 1] ?? '—'} ${filters.year ?? ''} was calculated only for ${payScaleLabel(primaryRun.payScaleType)} (${primaryRun.employeeCount} payslips). Create and calculate a ${payScaleLabel(filters.payScaleType)} payroll run in HR → Payroll Runs, then return here.`
        : `No payslips for ${payScaleLabel(filters.payScaleType)} in this period. Run payroll for that scale in HR → Payroll Runs → Calculate.`
      : null;

  const handleBulkExportExcel = () => {
    if (!primaryRun) {
      setError('No payroll run for selected period');
      return;
    }
    exportSalaryRegister(primaryRun.id);
  };

  const handleBankSheet = () => {
    if (!primaryRun?.payScaleType) {
      setError('No payroll run for selected period');
      return;
    }
    exportBulkSalarySheet(
      primaryRun.id,
      primaryRun.payScaleType,
      primaryRun.payScaleType === 'COLLEGE_NON_TEACHING' ? 'DBC_NON_TEACHING' : undefined,
    );
  };

  return (
    <div className="space-y-4">
      {(message || error || loadError) && (
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-sm',
            error || loadError
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700',
          )}
        >
          {error || loadError || message}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Payslips</h2>
          <p className="text-sm text-muted-foreground">
            Enterprise payroll payslip management — generate, publish, and distribute salary slips.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={actionMut.isPending}
            onClick={() => actionMut.mutate({ type: 'generate-all' })}
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" /> Generate All
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={actionMut.isPending}
            onClick={() => actionMut.mutate({ type: 'publish-all' })}
          >
            <Send className="mr-1 h-3.5 w-3.5" /> Publish All
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadPayslipsZip(queryParams)}>
            <Download className="mr-1 h-3.5 w-3.5" /> Download ZIP
          </Button>
          <Button size="sm" variant="outline" onClick={handleBulkExportExcel}>
            <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Export Excel
          </Button>
          <Button size="sm" variant="outline" onClick={handleBankSheet}>
            <Banknote className="mr-1 h-3.5 w-3.5" /> Bank Sheet
          </Button>
          <Button
            size="sm"
            disabled={actionMut.isPending}
            onClick={() => actionMut.mutate({ type: 'email-all' })}
          >
            <Mail className="mr-1 h-3.5 w-3.5" /> Email All Staff
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <SummaryCard label="Total Payslips" value={String(stats?.totalCount ?? '—')} icon={Users} />
        <SummaryCard
          label="Teaching Payroll"
          value={inr(stats?.teachingNet ?? 0)}
          hint={`${stats?.teachingCount ?? 0} staff`}
          tone="info"
          icon={Users}
        />
        <SummaryCard
          label="Non-Teaching"
          value={inr(stats?.nonTeachingNet ?? 0)}
          hint={`${stats?.nonTeachingCount ?? 0} staff`}
          tone="info"
          icon={Users}
        />
        <SummaryCard label="Gross Payroll" value={inr(stats?.grossTotal ?? 0)} icon={Wallet} />
        <SummaryCard
          label="Total Deductions"
          value={inr(stats?.deductionsTotal ?? 0)}
          tone="warning"
          icon={Wallet}
        />
        <SummaryCard
          label="Net Payroll"
          value={inr(stats?.netTotal ?? 0)}
          tone="success"
          icon={Banknote}
        />
        <SummaryCard
          label="Pending"
          value={String(stats?.pendingCount ?? 0)}
          tone="warning"
          icon={RefreshCw}
        />
        <SummaryCard
          label="Published"
          value={String((stats?.publishedCount ?? 0) + (stats?.paidCount ?? 0))}
          tone="success"
          icon={Send}
        />
      </div>

      <GlassCard className="p-4 space-y-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <select
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            value={filters.month ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, month: Number(e.target.value) || undefined }))
            }
          >
            <option value="">All months</option>
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            value={filters.year ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, year: Number(e.target.value) || undefined }))
            }
          >
            <option value="">All years</option>
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            value={filters.departmentId ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, departmentId: e.target.value || undefined }))
            }
          >
            <option value="">All departments</option>
            {(deptQ.data ?? []).map((d: { id: string; name: string }) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            value={filters.staffProfileId ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, staffProfileId: e.target.value || undefined }))
            }
          >
            <option value="">All employees</option>
            {(staffQ.data?.data ?? []).map(
              (s: { id: string; fullName: string; employeeCode: string }) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.employeeCode})
                </option>
              ),
            )}
          </select>
          <select
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            value={filters.staffType ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, staffType: e.target.value || undefined }))}
          >
            <option value="">Teaching / Non-Teaching</option>
            <option value="TEACHING">Teaching</option>
            <option value="NON_TEACHING">Non-Teaching</option>
          </select>
          <select
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            value={filters.payScaleType ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, payScaleType: e.target.value || undefined }))
            }
          >
            <option value="">All salary scales</option>
            {PAY_SCALE_TYPES.map((s) => (
              <option key={s} value={s}>
                {payScaleLabel(s)}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border bg-background px-2 py-1.5 text-sm"
            value={filters.status ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value || undefined }))}
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
          <div className="relative">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 text-sm"
              placeholder="Search name, ID…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t pt-3">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Custom range — From</p>
            <div className="flex gap-1">
              <select
                className="rounded-md border bg-background px-2 py-1 text-sm"
                value={customFrom.month}
                onChange={(e) => setCustomFrom((c) => ({ ...c, month: Number(e.target.value) }))}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border bg-background px-2 py-1 text-sm"
                value={customFrom.year}
                onChange={(e) => setCustomFrom((c) => ({ ...c, year: Number(e.target.value) }))}
              >
                {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">To</p>
            <div className="flex gap-1">
              <select
                className="rounded-md border bg-background px-2 py-1 text-sm"
                value={customTo.month}
                onChange={(e) => setCustomTo((c) => ({ ...c, month: Number(e.target.value) }))}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border bg-background px-2 py-1 text-sm"
                value={customTo.year}
                onChange={(e) => setCustomTo((c) => ({ ...c, year: Number(e.target.value) }))}
              >
                {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => downloadPeriod('custom')}>
            <Download className="mr-1 h-3.5 w-3.5" /> Merged PDF (Custom Range)
          </Button>
          {filters.staffProfileId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                downloadSalaryCertificate(filters.staffProfileId!, currentFinancialYearStart())
              }
            >
              Salary Certificate (FY)
            </Button>
          )}
        </div>
      </GlassCard>

      {filters.staffProfileId && historyQ.data && (
        <GlassCard className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <History className="h-4 w-4" />
              Salary History — {historyQ.data.staff.fullName}
            </h3>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded bg-muted px-2 py-0.5">
                {historyQ.data.periodCount} periods
              </span>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800">
                Net {inr(historyQ.data.totals.net)}
              </span>
            </div>
          </div>
          <div className="max-h-48 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1">Period</th>
                  <th>Gross</th>
                  <th>Net</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {historyQ.data.payslips.map((h) => (
                  <tr key={h.id} className="border-b">
                    <td className="py-1.5">{h.label}</td>
                    <td>{inr(h.grossSalary)}</td>
                    <td className="font-medium text-emerald-700">{inr(h.netSalary)}</td>
                    <td>
                      <StatusBadge
                        status={h.status === 'DRAFT' ? 'draft' : h.paidAt ? 'paid' : 'published'}
                      />
                    </td>
                    <td>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7"
                        onClick={() => openPayslipPdf(h.id)}
                      >
                        PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3">Employee</th>
                <th className="px-3 py-3">Department</th>
                <th className="px-3 py-3">Scale</th>
                <th className="px-3 py-3 text-right">Gross</th>
                <th className="px-3 py-3 text-right">Deduction</th>
                <th className="px-3 py-3 text-right">Net Salary</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(payslipsQ.data ?? []).map((p) => {
                const photo = resolveUploadAssetUrl(p.staffProfile?.photoUrl);
                const status = displayStatus(p);
                const mobile = p.staffProfile?.mobile?.replace(/\D/g, '');
                return (
                  <tr key={p.id} className="border-b transition-colors hover:bg-muted/20">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        {photo ? (
                          <img
                            src={photo}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover ring-1 ring-border"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                            {(p.staffProfile?.fullName ?? '?')
                              .split(' ')
                              .map((w) => w[0])
                              .slice(0, 2)
                              .join('')}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold leading-tight">{p.staffProfile?.fullName}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.staffProfile?.employeeCode}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.staffProfile?.designation?.label ?? '—'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {p.staffProfile?.department?.name ?? '—'}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {payScaleLabel(p.payScaleType)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {inr(Number(p.grossSalary))}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-amber-700">
                      {inr(Number(p.totalDeductions))}
                    </td>
                    <td className="px-3 py-3 text-right text-base font-bold tabular-nums text-emerald-700">
                      {inr(Number(p.netSalary))}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          title="View"
                          onClick={() => openPayslipPdf(p.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 gap-1 px-2">
                              <Download className="h-3.5 w-3.5" />
                              Download
                              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => openPayslipPdf(p.id)}>
                              Current Month Payslip
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                downloadPeriod('current', p.staffProfile?.id, p.month, p.year)
                              }
                            >
                              Current Month (Merged)
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                downloadPeriod('3m', p.staffProfile?.id, p.month, p.year)
                              }
                            >
                              Last 3 Months Payslips
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                downloadPeriod('6m', p.staffProfile?.id, p.month, p.year)
                              }
                            >
                              Last 6 Months Payslips
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                downloadPeriod('12m', p.staffProfile?.id, p.month, p.year)
                              }
                            >
                              Last 12 Months Payslips
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                downloadPeriod('fy', p.staffProfile?.id, p.month, p.year)
                              }
                            >
                              Financial Year Statement
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => downloadPeriod('custom', p.staffProfile?.id)}
                            >
                              Custom Date Range
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => exportPayslipRowCsv(p)}>
                              Excel Payslip
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPayslipPdf(p.id)}>
                              Print
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                actionMut.mutate({ type: 'email-one', payslipId: p.id })
                              }
                            >
                              Email Copy
                            </DropdownMenuItem>
                            {p.staffProfile?.id && (
                              <DropdownMenuItem
                                onClick={() =>
                                  downloadSalaryCertificate(
                                    p.staffProfile!.id!,
                                    currentFinancialYearStart(),
                                  )
                                }
                              >
                                Salary Certificate
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          title="Email"
                          onClick={() => actionMut.mutate({ type: 'email-one', payslipId: p.id })}
                        >
                          <Mail className="h-4 w-4" />
                        </Button>
                        {mobile ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2"
                            title="WhatsApp"
                            asChild
                          >
                            <a
                              href={`https://wa.me/91${mobile}?text=${encodeURIComponent(`Your ${MONTHS_FULL[p.month - 1]} ${p.year} payslip (Net: ${inr(Number(p.netSalary))}) is ready.`)}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          title="Regenerate"
                          onClick={() =>
                            actionMut.mutate({ type: 'regenerate-one', payslipId: p.id })
                          }
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!payslipsQ.data?.length && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {payslipsQ.isLoading
                ? 'Loading payslips…'
                : scaleFilterHint
                  ? scaleFilterHint
                  : searchInput.trim()
                    ? `No payslips for "${searchInput.trim()}" in ${MONTHS[(filters.month ?? 1) - 1] ?? '—'} ${filters.year ?? ''}. Try the Employee dropdown, another month, or clear search.`
                    : 'No payslips match the current filters. Run payroll for this month first (HR → Payroll Runs → Calculate).'}
            </p>
          )}
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Monthly Payroll Trend</h3>
          {analytics?.monthlyPayrollTrend?.length ? (
            <BarChartWidget
              data={analytics.monthlyPayrollTrend.map((r) => ({ label: r.label, value: r.value }))}
              height={220}
            />
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No trend data.</p>
          )}
        </GlassCard>
        <GlassCard className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Department-wise Salary Cost</h3>
          {analytics?.departmentWise?.length ? (
            <BarChartWidget data={analytics.departmentWise} height={220} layout="vertical" />
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No department data.</p>
          )}
        </GlassCard>
        <GlassCard className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Teaching vs Non-Teaching Payroll</h3>
          {analytics?.teachingVsNonTeaching?.some((r) => r.value > 0) ? (
            <DonutChartWidget data={analytics.teachingVsNonTeaching} height={220} />
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No split data.</p>
          )}
        </GlassCard>
        <GlassCard className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Loan Recovery & PF Summary</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border bg-amber-50/50 p-3">
              <p className="text-xs text-muted-foreground">Loan Recovery</p>
              <p className="text-lg font-bold text-amber-800">
                {inr(analytics?.loanRecovery ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-emerald-50/50 p-3">
              <p className="text-xs text-muted-foreground">Total PF</p>
              <p className="text-lg font-bold text-emerald-800">
                {inr(analytics?.pfContribution?.total ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Employer PF</p>
              <p className="font-semibold">{inr(analytics?.pfContribution?.employer ?? 0)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Employee PF</p>
              <p className="font-semibold">{inr(analytics?.pfContribution?.employee ?? 0)}</p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
