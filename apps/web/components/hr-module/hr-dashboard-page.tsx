'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  Banknote,
  Briefcase,
  CalendarClock,
  GraduationCap,
  Play,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

import { BarChartWidget } from '@/components/analytics/charts/bar-chart-widget';
import { DonutChartWidget } from '@/components/analytics/charts/donut-chart-widget';
import { payScaleLabel } from '@/components/hr-module/pay-scale-utils';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { ApiError } from '@/lib/http/api-error-types';
import { fetchHrExecutiveDashboard, fetchPayrollDashboard } from '@/services/payroll';
import { fetchSubstituteDashboard } from '@/services/hr-substitute';

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: 'default' | 'warning' | 'success' | 'info';
  hint?: string;
}) {
  const tones = {
    default: 'text-primary',
    warning: 'text-amber-600',
    success: 'text-emerald-600',
    info: 'text-blue-600',
  };
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
        </div>
        <Icon className={`h-7 w-7 shrink-0 opacity-80 ${tones[tone]}`} />
      </div>
    </div>
  );
}

function ChartCard({
  title,
  children,
  empty,
}: {
  title: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <GlassCard className="p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {empty ? (
        <p className="py-8 text-center text-xs text-muted-foreground">No data yet.</p>
      ) : (
        children
      )}
    </GlassCard>
  );
}

export function HrDashboardPage() {
  const enabled = useAuthQueryEnabled();
  const dashQ = useQuery({
    queryKey: ['payroll', 'dashboard', 'executive'],
    queryFn: fetchHrExecutiveDashboard,
    enabled,
  });
  const payrollDashQ = useQuery({
    queryKey: ['payroll', 'dashboard'],
    queryFn: fetchPayrollDashboard,
    enabled,
  });
  const substituteDashQ = useQuery({
    queryKey: ['hr', 'substitute', 'dashboard'],
    queryFn: fetchSubstituteDashboard,
    enabled,
  });

  const d = dashQ.data;
  const p = payrollDashQ.data;
  const payScaleChart = (d?.staffByPayScale ?? []).map((r) => ({
    label: payScaleLabel(r.label),
    value: r.value,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">HR Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Executive overview — staff strength, payroll, leave, and workforce analytics.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/hr/payroll/runs">
            <Button size="sm" variant="outline">
              <Play className="mr-2 h-4 w-4" /> Process Payroll
            </Button>
          </Link>
          <Link href="/admin/hr/assignments">
            <Button size="sm" variant="outline">
              <Briefcase className="mr-2 h-4 w-4" /> Pay Assignments
            </Button>
          </Link>
        </div>
      </div>

      {dashQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading HR analytics…</p>
      ) : dashQ.isError ? (
        <p className="text-sm text-destructive">
          {(dashQ.error as ApiError)?.status === 403
            ? 'You do not have permission to view HR payroll analytics. Ask an administrator to grant payroll access, then sign out and back in.'
            : 'Could not load dashboard data.'}
        </p>
      ) : d ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 xl:grid-cols-10">
            <KpiCard label="Total Staff" value={d.totalStaff} icon={Users} tone="info" />
            <KpiCard label="Teaching" value={d.teachingStaff} icon={GraduationCap} />
            <KpiCard label="Non-Teaching" value={d.nonTeachingStaff} icon={Users} />
            <KpiCard label="Contract" value={d.contractStaff} icon={Briefcase} />
            <KpiCard label="Guest Faculty" value={d.guestFaculty} icon={Users} />
            <KpiCard
              label="On Leave"
              value={d.staffOnLeaveToday}
              icon={CalendarClock}
              tone="warning"
            />
            <KpiCard
              label="New Joinings"
              value={d.newJoinings}
              icon={UserPlus}
              tone="success"
              hint="Last 30 days"
            />
            <KpiCard
              label="Retiring Soon"
              value={d.retiringSoon}
              icon={AlertCircle}
              tone="warning"
              hint="Next 12 months"
            />
            <KpiCard
              label="Payroll Due"
              value={d.payrollDue}
              icon={Banknote}
              tone="warning"
              hint="Pending runs"
            />
            <KpiCard label="Active Loans" value={d.activeLoans} icon={Wallet} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Monthly Payroll"
              value={`₹${d.monthlyPayrollCost.toLocaleString('en-IN')}`}
              icon={TrendingUp}
              tone="success"
              hint="Latest published run"
            />
            <KpiCard
              label="Loan Outstanding"
              value={`₹${d.loanOutstanding.toLocaleString('en-IN')}`}
              icon={Wallet}
              tone="warning"
            />
            {p && (
              <>
                <KpiCard
                  label="Yearly Payroll"
                  value={`₹${p.yearlyPayrollCost.toLocaleString('en-IN')}`}
                  icon={TrendingUp}
                  tone="info"
                  hint="Published runs YTD"
                />
                <KpiCard
                  label="PF Liability"
                  value={`₹${p.pfLiability.toLocaleString('en-IN')}`}
                  icon={Banknote}
                  hint="Latest month"
                />
              </>
            )}
          </div>

          <GlassCard className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Replacement Faculty</h3>
              <Link
                href="/admin/hr/substitute-staff"
                className="text-xs text-primary hover:underline"
              >
                Manage substitute staff
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Active Assignments"
                value={substituteDashQ.data?.activeAssignments ?? 0}
                icon={Users}
              />
              <KpiCard
                label="Study Leave Faculty"
                value={substituteDashQ.data?.studyLeaveFaculty ?? 0}
                icon={GraduationCap}
              />
              <KpiCard
                label="Maternity Leave Faculty"
                value={substituteDashQ.data?.maternityLeaveFaculty ?? 0}
                icon={CalendarClock}
              />
              <KpiCard
                label="Expiring This Month"
                value={substituteDashQ.data?.expiringThisMonth ?? 0}
                icon={AlertCircle}
                tone="warning"
              />
            </div>
          </GlassCard>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <ChartCard title="Department-wise Staff Strength" empty={!d.departmentStrength.length}>
              <BarChartWidget data={d.departmentStrength} height={240} layout="vertical" />
            </ChartCard>
            <ChartCard title="Gender Distribution" empty={!d.genderDistribution.length}>
              <DonutChartWidget data={d.genderDistribution} height={240} />
            </ChartCard>
            <ChartCard
              title="Salary Cost by Department (Basic Pay)"
              empty={!d.salaryCostByDepartment.length}
            >
              <BarChartWidget
                data={d.salaryCostByDepartment}
                height={240}
                layout="vertical"
                color="hsl(var(--accent))"
              />
            </ChartCard>
            <ChartCard title="Age Distribution" empty={!d.ageDistribution.length}>
              <BarChartWidget data={d.ageDistribution} height={220} />
            </ChartCard>
            <ChartCard title="Experience Distribution" empty={!d.experienceDistribution.length}>
              <BarChartWidget data={d.experienceDistribution} height={220} color="#64748b" />
            </ChartCard>
            <ChartCard title="Staff by Pay Scale" empty={!payScaleChart.length}>
              <DonutChartWidget data={payScaleChart} height={240} />
            </ChartCard>
          </div>

          <ChartCard title="Monthly Payroll Trend" empty={!d.monthlyPayrollTrend.length}>
            <BarChartWidget
              data={d.monthlyPayrollTrend.map((r) => ({ label: r.label, value: r.value }))}
              height={260}
            />
            {d.monthlyPayrollTrend.length ? (
              <ul className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                {d.monthlyPayrollTrend
                  .slice(-6)
                  .reverse()
                  .map((r) => (
                    <li key={`${r.year}-${r.month}`} className="flex justify-between">
                      <span>{r.label}</span>
                      <span>
                        ₹{r.value.toLocaleString('en-IN')} · {r.employeeCount} staff
                      </span>
                    </li>
                  ))}
              </ul>
            ) : null}
          </ChartCard>

          <GlassCard className="p-4">
            <h3 className="mb-3 text-sm font-semibold">HR Module Quick Access</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Staff Directory', href: '/admin/staff' },
                { label: 'Departments', href: '/admin/staff/departments' },
                { label: 'Attendance', href: '/admin/staff/attendance' },
                { label: 'Leave Management', href: '/admin/hr/leave' },
                { label: 'Pay Assignments', href: '/admin/hr/assignments' },
                { label: 'Payroll Runs', href: '/admin/hr/payroll/runs' },
                { label: 'Loans & Advances', href: '/admin/hr/loans' },
                { label: 'Reports', href: '/admin/hr/reports' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg border border-border/60 px-3 py-2 text-sm hover:bg-muted/50"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </GlassCard>
        </>
      ) : null}
    </div>
  );
}
