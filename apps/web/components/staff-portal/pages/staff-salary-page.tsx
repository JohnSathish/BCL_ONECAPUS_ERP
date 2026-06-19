'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Download, History, Receipt, TrendingUp, Wallet } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  buildPeriodParams,
  currentFinancialYearStart,
  type PeriodPreset,
} from '@/components/hr-module/payslip-period-utils';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useStaffDashboard } from '@/components/staff-portal/hooks/use-staff-dashboard';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import {
  downloadMyMergedPayslips,
  downloadMyPayslipPdf,
  downloadMyPayslipsZip,
  downloadMySalaryCertificate,
  fetchMyLoans,
  fetchMyPayslips,
  fetchMyPfSummary,
  fetchMySalaryHistory,
  fetchMyTaxSummary,
} from '@/services/payroll';
import { cn } from '@/utils/cn';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TABS = ['overview', 'payslips', 'history', 'tax'] as const;

function inr(n: number) {
  return `₹${n.toLocaleString('en-IN')}`;
}

export function StaffPortalSalaryPage() {
  useRequireStaffPortal();
  const now = new Date();
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview');
  const [taxYear, setTaxYear] = useState(now.getFullYear());

  const dashQ = useStaffDashboard();
  const salary = dashQ.data?.kpis.salary;

  const payslipsQ = useQuery({ queryKey: ['staff', 'payslips'], queryFn: fetchMyPayslips });
  const historyQ = useQuery({
    queryKey: ['staff', 'salary-history'],
    queryFn: fetchMySalaryHistory,
  });
  const taxQ = useQuery({
    queryKey: ['staff', 'tax-summary', taxYear],
    queryFn: () => fetchMyTaxSummary(taxYear),
  });
  const loansQ = useQuery({ queryKey: ['staff', 'loans'], queryFn: fetchMyLoans });
  const pfQ = useQuery({ queryKey: ['staff', 'pf'], queryFn: fetchMyPfSummary });

  const latestPayslip = payslipsQ.data?.[0];
  const assignment = historyQ.data?.currentAssignment;

  const downloadMyPeriod = (preset: PeriodPreset) => {
    const ref = latestPayslip ?? { month: now.getMonth() + 1, year: now.getFullYear() };
    downloadMyMergedPayslips(buildPeriodParams(preset, { month: ref.month, year: ref.year }));
  };

  return (
    <DashboardShell role="staff" title="Salary & Payslips">
      <div className="mb-4 flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            className={cn(
              'rounded-md px-3 py-1.5 text-sm capitalize transition-colors',
              tab === t
                ? 'bg-background shadow-sm font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
            onClick={() => setTab(t)}
          >
            {t === 'history' ? 'Salary History' : t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <ErpWorkspace className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Current Salary</h2>
                <p className="mt-2 text-3xl font-bold">
                  {inr(assignment?.basicPay ?? salary?.currentMonthSalary ?? 0)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Basic pay · {assignment?.payScaleType ?? '—'}
                </p>
                {assignment?.structureName && (
                  <p className="text-xs text-muted-foreground">{assignment.structureName}</p>
                )}
              </div>
              <TrendingUp className="h-8 w-8 text-primary opacity-70" />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Last payment:{' '}
              {latestPayslip
                ? `${MONTHS[latestPayslip.month - 1]} ${latestPayslip.year}`
                : salary?.lastPaymentDate
                  ? new Date(salary.lastPaymentDate).toLocaleDateString('en-IN')
                  : '—'}
            </p>
            {latestPayslip && (
              <p className="text-sm">
                Latest net: <strong>{inr(Number(latestPayslip.netSalary))}</strong>
              </p>
            )}
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold">YTD Summary ({taxYear})</h2>
            {taxQ.data ? (
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Gross</span>
                  <p className="font-semibold">{inr(taxQ.data.ytdGross)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Net</span>
                  <p className="font-semibold">{inr(taxQ.data.ytdNet)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">TDS</span>
                  <p className="font-semibold">{inr(taxQ.data.ytdTds)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Prof. Tax</span>
                  <p className="font-semibold">{inr(taxQ.data.ytdProfessionalTax)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
            )}
            {pfQ.data && (
              <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                PF (YTD employee): {inr(Number(pfQ.data.pfEmployee ?? 0))} · CPF:{' '}
                {inr(Number(pfQ.data.cpfEmployee ?? 0))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Wallet className="h-5 w-5" /> Active Loans
            </h2>
            <div className="mt-4 space-y-2 text-sm">
              {(loansQ.data ?? [])
                .filter((l) => l.status === 'ACTIVE')
                .map((l) => (
                  <div key={l.id} className="rounded border px-3 py-2">
                    <div className="font-medium">{l.loanType}</div>
                    <div className="text-muted-foreground">
                      Balance {inr(Number(l.balanceAmount))} · EMI {inr(Number(l.monthlyDeduction))}
                    </div>
                  </div>
                ))}
              {!loansQ.data?.filter((l) => l.status === 'ACTIVE').length && (
                <p className="text-muted-foreground">No active loans.</p>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold">Quick Actions</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {latestPayslip && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadMyPayslipPdf(latestPayslip.id)}
                >
                  <Download className="mr-1 h-3 w-3" /> Latest Payslip
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setTab('payslips')}>
                All Payslips
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTab('history')}>
                Salary History
              </Button>
            </div>
          </GlassCard>
        </ErpWorkspace>
      )}

      {tab === 'payslips' && (
        <GlassCard className="p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Receipt className="h-5 w-5" /> Published Payslips
          </h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-2">Period</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(payslipsQ.data ?? []).map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">
                      {MONTHS[p.month - 1]} {p.year}
                    </td>
                    <td>{inr(Number(p.grossSalary))}</td>
                    <td>{inr(Number(p.totalDeductions))}</td>
                    <td className="font-medium">{inr(Number(p.netSalary))}</td>
                    <td>
                      <Button size="sm" variant="ghost" onClick={() => downloadMyPayslipPdf(p.id)}>
                        PDF
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!payslipsQ.data?.length && (
              <p className="py-8 text-center text-muted-foreground">No published payslips yet.</p>
            )}
          </div>
        </GlassCard>
      )}

      {tab === 'history' && (
        <div className="space-y-4">
          <GlassCard className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <History className="h-5 w-5" /> Salary History
              </h2>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1">
                    <Download className="h-3.5 w-3.5" /> Download{' '}
                    <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    onClick={() => latestPayslip && downloadMyPayslipPdf(latestPayslip.id)}
                  >
                    Current Month Payslip
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadMyPeriod('3m')}>
                    Last 3 Months (Merged PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadMyPeriod('6m')}>
                    Last 6 Months (Merged PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadMyPeriod('12m')}>
                    Last 12 Months (Merged PDF)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadMyPeriod('fy')}>
                    Financial Year Statement
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      downloadMyPayslipsZip(
                        buildPeriodParams('12m', {
                          month: latestPayslip?.month,
                          year: latestPayslip?.year,
                        }),
                      )
                    }
                  >
                    Download ZIP
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => downloadMySalaryCertificate(currentFinancialYearStart())}
                  >
                    Salary Certificate
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </GlassCard>
          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard className="p-6">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                <History className="h-5 w-5" /> Salary Revisions
              </h2>
              <div className="max-h-80 space-y-2 overflow-auto text-sm">
                {(historyQ.data?.revisions ?? []).map((r) => (
                  <div key={r.id} className="rounded border px-3 py-2">
                    <div className="font-medium">{r.revisionType}</div>
                    <div className="text-xs text-muted-foreground">
                      Effective {r.effectiveFrom.slice(0, 10)}
                      {r.previousBasicPay != null && r.newBasicPay != null && (
                        <>
                          {' '}
                          · {inr(r.previousBasicPay)} →{' '}
                          <span className="text-emerald-700">{inr(r.newBasicPay)}</span>
                        </>
                      )}
                    </div>
                    {r.notes && <p className="mt-1 text-xs">{r.notes}</p>}
                  </div>
                ))}
                {!historyQ.data?.revisions.length && (
                  <p className="text-muted-foreground">No salary revisions recorded.</p>
                )}
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <h2 className="mb-4 text-lg font-semibold">Payment Timeline</h2>
              <div className="max-h-80 space-y-2 overflow-auto text-sm">
                {(historyQ.data?.payslipTimeline ?? []).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded border px-3 py-2"
                  >
                    <div>
                      <div className="font-medium">{p.label}</div>
                      <div className="text-xs text-muted-foreground">
                        Gross {inr(p.grossSalary)} · Net {inr(p.netSalary)}
                        {p.paidAt && ` · Paid ${new Date(p.paidAt).toLocaleDateString()}`}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => downloadMyPayslipPdf(p.id)}>
                      PDF
                    </Button>
                  </div>
                ))}
                {!historyQ.data?.payslipTimeline.length && (
                  <p className="text-muted-foreground">No payment history yet.</p>
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {tab === 'tax' && (
        <GlassCard className="p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Tax Summary</h2>
            <select
              className="rounded border px-2 py-1 text-sm"
              value={taxYear}
              onChange={(e) => setTaxYear(Number(e.target.value))}
            >
              {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {taxQ.data && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded border p-3">
                  <p className="text-xs text-muted-foreground">YTD Gross</p>
                  <p className="font-bold">{inr(taxQ.data.ytdGross)}</p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-xs text-muted-foreground">YTD TDS</p>
                  <p className="font-bold">{inr(taxQ.data.ytdTds)}</p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-xs text-muted-foreground">Prof. Tax</p>
                  <p className="font-bold">{inr(taxQ.data.ytdProfessionalTax)}</p>
                </div>
                <div className="rounded border p-3">
                  <p className="text-xs text-muted-foreground">Projected Annual Tax</p>
                  <p className="font-bold">{inr(taxQ.data.projectedAnnualTax)}</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Month</th>
                    <th>Gross</th>
                    <th>TDS</th>
                    <th>Prof. Tax</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {taxQ.data.monthlyBreakdown.map((m) => (
                    <tr key={m.month} className="border-b">
                      <td className="py-2">{m.label}</td>
                      <td>{inr(m.gross)}</td>
                      <td>{inr(m.tds)}</td>
                      <td>{inr(m.professionalTax)}</td>
                      <td>{inr(m.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-xs text-muted-foreground">{taxQ.data.note}</p>
              {taxQ.data.form16Available && (
                <p className="mt-2 text-sm text-emerald-700">
                  TDS records available for Form 16 when certificate generation is enabled.
                </p>
              )}
            </>
          )}
        </GlassCard>
      )}
    </DashboardShell>
  );
}
