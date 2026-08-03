'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Download,
  FileCheck,
  GraduationCap,
  Layers,
  Mail,
  Megaphone,
  Plus,
  Settings2,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchAdmissionsFunnel,
  fetchAdmissionsSummary,
  fetchApplications,
  fetchCycles,
  fetchDailyRegistrations,
  fetchIntakes,
  fetchMeritLists,
  fetchProgramBreakdown,
  fetchShiftFillRate,
  type AdmissionCycle,
} from '@/services/admissions';
import { cn } from '@/utils/cn';
import { formatDisplayDate } from '@/utils/format-date';

const WORKFLOW = [
  {
    phase: 1,
    phaseLabel: 'Admission Workflow',
    steps: [
      {
        key: 'applications',
        label: 'Application Form',
        href: '/admin/admissions/applications',
        action: 'Review',
        icon: ClipboardList,
      },
      {
        key: 'documents',
        label: 'Document Verification',
        href: '/admin/admissions/documents',
        action: 'Verify',
        icon: FileCheck,
      },
      {
        key: 'payments',
        label: 'Payment Verification',
        href: '/admin/admissions/payments',
        action: 'Verify',
        icon: CreditCard,
      },
    ],
  },
  {
    phase: 2,
    phaseLabel: 'Admission Selection',
    steps: [
      {
        key: 'merit',
        label: 'Merit & Selection',
        href: '/admin/admissions/merit',
        action: 'Manage',
        icon: Trophy,
      },
      {
        key: 'seats',
        label: 'Seat Allocation',
        href: '/admin/admissions/merit',
        action: 'Allocate',
        icon: Layers,
      },
    ],
  },
  {
    phase: 3,
    phaseLabel: 'Enrollment',
    steps: [
      {
        key: 'fees',
        label: 'Admission Fee',
        href: '/admin/admissions/admission-fees',
        action: 'Collect',
        icon: Wallet,
      },
      {
        key: 'admitted',
        label: 'Admitted Students',
        href: '/admin/admissions/admitted',
        action: 'View',
        icon: GraduationCap,
      },
      {
        key: 'records',
        label: 'Student Records',
        href: '/admin/students',
        action: 'Create',
        icon: Users,
      },
    ],
  },
] as const;

const QUICK_ACTIONS = [
  {
    label: 'Download Applications',
    href: '/admin/admissions/applications',
    icon: Download,
  },
  { label: 'Export Reports', href: '/admin/admissions/analytics', icon: BarChart3 },
  { label: 'Send SMS / Email', href: '/admin/admissions/cycles', icon: Mail },
  { label: 'Publish Notice', href: '/admin/admissions/cycles', icon: Megaphone },
  { label: 'Generate Merit List', href: '/admin/admissions/merit', icon: Trophy },
  { label: 'Cycles & Settings', href: '/admin/admissions/cycles', icon: Settings2 },
] as const;

function daysLeft(iso?: string | null) {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / 86400000);
}

function pickActiveCycle(cycles: AdmissionCycle[], selectedId: string) {
  if (selectedId) {
    const found = cycles.find((c) => c.id === selectedId);
    if (found) return found;
  }
  return (
    cycles.find((c) => c.status === 'OPEN' || c.status === 'PUBLISHED') ??
    cycles.find((c) => c.status === 'ACTIVE') ??
    cycles[0] ??
    null
  );
}

function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const size = 104;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, percent));
  const offset = c - (clamped / 100) * c;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[104px] w-[104px] shrink-0">
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#0d9488"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-slate-900">{clamped}%</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Complete
          </span>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Admission Progress
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-800">{label}</p>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  tone: 'blue' | 'amber' | 'emerald' | 'violet' | 'teal' | 'rose';
}) {
  const tones = {
    blue: 'from-blue-500/15 via-white to-white text-blue-700',
    amber: 'from-amber-500/15 via-white to-white text-amber-700',
    emerald: 'from-emerald-500/15 via-white to-white text-emerald-700',
    violet: 'from-violet-500/15 via-white to-white text-violet-700',
    teal: 'from-teal-500/15 via-white to-white text-teal-700',
    rose: 'from-rose-500/15 via-white to-white text-rose-700',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border border-slate-200/80 bg-gradient-to-br p-4 shadow-sm',
        tones[tone],
      )}
    >
      <p className="text-xs font-medium text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-[11px] font-medium opacity-80">{hint}</p>
    </motion.div>
  );
}

export function AdmissionsControlCenterDashboard() {
  const session = useRequireAuth();
  const [cycleId, setCycleId] = useState('');

  const cyclesQ = useQuery({
    queryKey: ['admission-cycles'],
    queryFn: () => fetchCycles(),
    enabled: Boolean(session),
  });

  const activeCycle = useMemo(
    () => pickActiveCycle(cyclesQ.data ?? [], cycleId),
    [cyclesQ.data, cycleId],
  );
  const activeCycleId = activeCycle?.id;

  const summaryQ = useQuery({
    queryKey: ['admissions', 'summary'],
    queryFn: fetchAdmissionsSummary,
    enabled: Boolean(session),
  });

  const funnelQ = useQuery({
    queryKey: ['admissions-funnel', activeCycleId],
    queryFn: () => fetchAdmissionsFunnel(activeCycleId),
    enabled: Boolean(session),
  });

  const programsQ = useQuery({
    queryKey: ['admissions-programs', activeCycleId],
    queryFn: () => fetchProgramBreakdown(activeCycleId),
    enabled: Boolean(session),
  });

  const shiftFillQ = useQuery({
    queryKey: ['admissions-shift-fill', activeCycleId],
    queryFn: () => fetchShiftFillRate(activeCycleId!),
    enabled: Boolean(session && activeCycleId),
  });

  const dailyQ = useQuery({
    queryKey: ['admissions-daily', activeCycleId],
    queryFn: () => fetchDailyRegistrations(activeCycleId!, 7),
    enabled: Boolean(session && activeCycleId),
  });

  const intakesQ = useQuery({
    queryKey: ['admissions', 'intakes'],
    queryFn: fetchIntakes,
    enabled: Boolean(session),
  });

  const recentAppsQ = useQuery({
    queryKey: ['admissions', 'recent-apps', activeCycleId],
    queryFn: () =>
      fetchApplications({
        page: 1,
        limit: 8,
        cycleId: activeCycleId,
      }),
    enabled: Boolean(session),
  });

  const pendingDocsQ = useQuery({
    queryKey: ['admissions', 'pending-docs', activeCycleId],
    queryFn: () =>
      fetchApplications({
        page: 1,
        limit: 1,
        cycleId: activeCycleId,
        documentPending: true,
      }),
    enabled: Boolean(session),
  });

  const pendingPayQ = useQuery({
    queryKey: ['admissions', 'pending-pay', activeCycleId],
    queryFn: () =>
      fetchApplications({
        page: 1,
        limit: 1,
        cycleId: activeCycleId,
        paymentPending: true,
      }),
    enabled: Boolean(session),
  });

  const pendingFeeQ = useQuery({
    queryKey: ['admissions', 'pending-fee', activeCycleId],
    queryFn: () =>
      fetchApplications({
        page: 1,
        limit: 1,
        cycleId: activeCycleId,
        admissionFeePending: true,
      }),
    enabled: Boolean(session),
  });

  const rejectedQ = useQuery({
    queryKey: ['admissions', 'rejected', activeCycleId],
    queryFn: () =>
      fetchApplications({
        page: 1,
        limit: 1,
        cycleId: activeCycleId,
        status: 'rejected',
      }),
    enabled: Boolean(session),
  });

  const meritQ = useQuery({
    queryKey: ['admissions', 'merit-lists'],
    queryFn: () => fetchMeritLists(),
    enabled: Boolean(session),
  });

  const seatRows = useMemo(() => {
    if (shiftFillQ.data?.length) {
      return shiftFillQ.data.map((row) => {
        const total = row.shifts.reduce((s, x) => s + x.totalSeats, 0);
        const filled = row.shifts.reduce((s, x) => s + x.allocated, 0);
        return {
          name: row.intake.program?.code || row.intake.name,
          filled,
          total,
          pct: total > 0 ? Math.round((filled / total) * 100) : 0,
        };
      });
    }
    return (programsQ.data ?? []).slice(0, 6).map((row) => {
      const allottedStatus = row.byStatus.allotted ?? 0;
      const enrolledStatus = row.byStatus.enrolled ?? 0;
      const filled = allottedStatus + enrolledStatus;
      const total = Math.max(row.total, filled);
      return {
        name: row.program.code,
        filled,
        total,
        pct: total > 0 ? Math.round((filled / total) * 100) : 0,
      };
    });
  }, [shiftFillQ.data, programsQ.data]);

  const trendData = useMemo(() => {
    const map = new Map((dailyQ.data ?? []).map((d) => [d.date, d.count]));
    const out: Array<{ label: string; count: number }> = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        count: map.get(key) ?? 0,
      });
    }
    return out;
  }, [dailyQ.data]);

  if (!session) return null;

  const summary = summaryQ.data;
  const funnel = funnelQ.data;
  const appsTotal = summary?.applications ?? funnel?.registered ?? 0;
  const pendingReview = summary?.pendingReview ?? 0;
  const verified = funnel?.verified ?? 0;
  const rejected = rejectedQ.data?.meta.total ?? 0;
  const allotted = funnel?.allotted ?? summary?.activeAllocations ?? 0;
  const enrolled = funnel?.enrolled ?? 0;

  const intakeSeats = (intakesQ.data ?? []).reduce((sum, i) => sum + (i.totalSeats || 0), 0);
  const intakeFilled = (intakesQ.data ?? []).reduce(
    (sum, i) => sum + (i._count?.allocations || 0),
    0,
  );
  const seatsFilledPct =
    intakeSeats > 0 ? Math.round((intakeFilled / intakeSeats) * 100) : allotted > 0 ? null : 0;

  const pendingDocs = pendingDocsQ.data?.meta.total ?? 0;
  const pendingPay = pendingPayQ.data?.meta.total ?? 0;
  const pendingFee = pendingFeeQ.data?.meta.total ?? 0;
  const draftMerit = (meritQ.data ?? []).filter((m) => m.status !== 'published').length;
  const publishedMerit = (meritQ.data ?? []).filter((m) => m.status === 'published').length;

  const windowOpen =
    activeCycle?.status === 'OPEN' ||
    activeCycle?.status === 'PUBLISHED' ||
    activeCycle?.status === 'ACTIVE';
  const closeDate = activeCycle?.applicationDeadline || activeCycle?.registrationClosesAt || null;
  const opensAt = activeCycle?.registrationOpensAt || null;
  const left = daysLeft(closeDate);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayApps = (dailyQ.data ?? []).find((d) => d.date === todayKey)?.count ?? 0;

  const stepMeta = [
    { key: 'applications', pending: appsTotal, done: (funnel?.submitted ?? 0) > 0 },
    { key: 'documents', pending: pendingDocs, done: verified > 0 && pendingDocs === 0 },
    { key: 'payments', pending: pendingPay, done: (funnel?.paid ?? 0) > 0 && pendingPay === 0 },
    {
      key: 'merit',
      pending: draftMerit,
      done: publishedMerit > 0 && draftMerit === 0,
    },
    {
      key: 'seats',
      pending: Math.max(0, (funnel?.shortlisted ?? 0) - allotted),
      done: allotted > 0,
    },
    { key: 'fees', pending: pendingFee, done: pendingFee === 0 && allotted > 0 },
    { key: 'admitted', pending: Math.max(0, allotted - enrolled), done: enrolled > 0 },
  ] as const;

  let currentStep = stepMeta.findIndex((s) => s.pending > 0);
  if (currentStep < 0) currentStep = stepMeta.filter((s) => s.done).length - 1;
  if (currentStep < 0) currentStep = 0;
  const progressPct = Math.round(
    ((stepMeta.filter((s) => s.done).length + (stepMeta[currentStep]?.pending ? 0.4 : 0)) /
      stepMeta.length) *
      100,
  );
  const currentStepLabel = `Step ${currentStep + 1} of ${stepMeta.length} – ${
    WORKFLOW.flatMap((p) => p.steps).find((s) => s.key === stepMeta[currentStep]?.key)?.label ??
    'In progress'
  }`;

  const workflowCounts: Record<string, string> = {
    applications: `${appsTotal} apps`,
    documents: `${pendingDocs} pending`,
    payments: `${pendingPay} pending`,
    merit: `${draftMerit} drafts`,
    seats: `${allotted} allocated`,
    fees: `${pendingFee} pending`,
    admitted: `${enrolled} enrolled`,
    records: `${Math.max(0, allotted - enrolled)} pending`,
  };

  const funnelBars = funnel
    ? [
        { label: 'Applications', value: funnel.registered },
        { label: 'Submitted', value: funnel.submitted },
        { label: 'Paid', value: funnel.paid },
        { label: 'Verified', value: funnel.verified },
        { label: 'Allotted', value: funnel.allotted },
        { label: 'Admitted', value: funnel.enrolled },
      ]
    : [];
  const funnelMax = Math.max(1, ...funnelBars.map((b) => b.value));

  const deadlines = [
    {
      label: 'Application Closing',
      date: closeDate,
      tone: 'rose' as const,
    },
    {
      label: 'Payment Deadline',
      date: activeCycle?.paymentDeadline ?? null,
      tone: 'amber' as const,
    },
    {
      label: 'Registration Opens',
      date: opensAt,
      tone: 'emerald' as const,
    },
  ];

  const recent = recentAppsQ.data?.data ?? [];

  return (
    <DashboardShell role="admin" title="Admissions">
      <div className="space-y-5 pb-10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Don Bosco ERP · Online admission
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Admission control center
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Manage the full admission workflow — applications, verification, merit, and enrollment
              — from one workspace.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm"
              value={activeCycleId ?? ''}
              onChange={(e) => setCycleId(e.target.value)}
            >
              {(cyclesQ.data ?? []).length === 0 ? (
                <option value="">No cycles</option>
              ) : (
                (cyclesQ.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.academicYear?.name || c.title} ({c.status})
                  </option>
                ))
              )}
            </select>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link href="/admin/admissions/intakes">
                <Plus className="mr-1.5 h-4 w-4" />
                New Intake
              </Link>
            </Button>
            <Button className="rounded-xl bg-blue-600 hover:bg-blue-700" asChild>
              <Link href="/admin/admissions/applications">Open application list</Link>
            </Button>
          </div>
        </div>

        {/* Progress strip */}
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1.2fr_1fr_1fr_1.1fr]">
          <ProgressRing percent={progressPct} label={currentStepLabel} />
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Application Window
            </p>
            <span
              className={cn(
                'mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold',
                windowOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700',
              )}
            >
              {windowOpen ? 'OPEN' : activeCycle?.status || '—'}
            </span>
            <p className="mt-2 text-sm font-medium text-slate-700">
              {opensAt || closeDate
                ? `${opensAt ? formatDisplayDate(opensAt) : '—'} – ${
                    closeDate ? formatDisplayDate(closeDate) : '—'
                  }`
                : 'Dates not configured'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Last Date
            </p>
            <p className="mt-2 text-lg font-bold text-slate-900">
              {closeDate ? formatDisplayDate(closeDate) : '—'}
            </p>
            <p
              className={cn(
                'mt-1 text-sm font-semibold',
                left != null && left >= 0 ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {left == null
                ? 'No deadline set'
                : left >= 0
                  ? `${left} days left`
                  : `${Math.abs(left)} days overdue`}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Today&apos;s Snapshot
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <SnapCell label="Applications" value={todayApps} />
              <SnapCell label="Payments due" value={pendingPay} />
              <SnapCell label="Verified" value={verified} />
              <SnapCell label="Enrolled" value={enrolled} />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <KpiCard
            title="Total Applications"
            value={String(appsTotal)}
            hint={todayApps ? `+${todayApps} today` : 'Across current scope'}
            tone="blue"
          />
          <KpiCard
            title="Pending Review"
            value={String(pendingReview)}
            hint="Requires attention"
            tone="amber"
          />
          <KpiCard
            title="Verified Applications"
            value={String(verified)}
            hint="Ready for merit"
            tone="emerald"
          />
          <KpiCard
            title="Seats Filled"
            value={seatsFilledPct != null ? `${seatsFilledPct}%` : '—'}
            hint={
              intakeSeats > 0 ? `${intakeFilled} / ${intakeSeats} seats` : `${allotted} allocations`
            }
            tone="violet"
          />
          <KpiCard
            title="Active Allocations"
            value={String(summary?.activeAllocations ?? allotted)}
            hint={`${publishedMerit} published merit lists`}
            tone="teal"
          />
          <KpiCard
            title="Rejected Applications"
            value={String(rejected)}
            hint="Needs follow-up"
            tone="rose"
          />
        </div>

        {/* Workflow + activity */}
        <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Admission Workflow</h2>
              <Link
                href="/admin/admissions/analytics"
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Full analytics
              </Link>
            </div>
            <div className="space-y-5">
              {WORKFLOW.map((phase) => (
                <div key={phase.phase}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {phase.phase}. {phase.phaseLabel}
                  </p>
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
                    {phase.steps.map((step, idx) => {
                      const Icon = step.icon;
                      return (
                        <div key={step.key} className="flex flex-1 items-stretch gap-2">
                          <Link
                            href={step.href}
                            className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 transition hover:border-teal-300 hover:bg-teal-50/40"
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-teal-700 shadow-sm ring-1 ring-slate-100">
                              <Icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-800">
                                {step.label}
                              </p>
                              <p className="text-xs text-slate-500">
                                {workflowCounts[step.key] ?? '—'}
                              </p>
                            </div>
                            <span className="text-xs font-semibold text-blue-600">
                              {step.action}
                            </span>
                          </Link>
                          {idx < phase.steps.length - 1 ? (
                            <ArrowRight className="hidden h-4 w-4 shrink-0 self-center text-slate-300 lg:block" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-900">Recent Activities</h2>
            </div>
            <ul className="space-y-3">
              {recent.length ? (
                recent.map((app) => (
                  <li
                    key={app.id}
                    className="flex gap-3 border-b border-slate-100 pb-3 last:border-0"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                      {(app.firstName?.[0] ?? 'A').toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {app.firstName} {app.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {app.applicationNumber} · {app.status.replaceAll('_', ' ')}
                        {app.submittedAt ? ` · ${formatDisplayDate(app.submittedAt)}` : ''}
                      </p>
                    </div>
                  </li>
                ))
              ) : (
                <li className="text-sm text-slate-500">No recent applications yet.</li>
              )}
            </ul>
          </div>
        </div>

        {/* Funnel / seats / deadlines / trend */}
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-1">
            <h2 className="text-sm font-semibold text-slate-900">Admission Funnel</h2>
            <div className="mt-4 space-y-2">
              {funnelBars.length ? (
                funnelBars.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-slate-500">{row.label}</span>
                      <span className="font-semibold text-slate-800">{row.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-500 to-blue-500"
                        style={{ width: `${Math.max(6, (row.value / funnelMax) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Funnel data unavailable.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Seat Occupancy</h2>
            <div className="mt-4 space-y-3">
              {seatRows.length ? (
                seatRows.map((row) => (
                  <div key={row.name}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{row.name}</span>
                      <span className="text-slate-500">
                        {row.pct}% ({row.filled}/{row.total || '—'})
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-violet-500"
                        style={{ width: `${Math.min(100, row.pct)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Configure intakes / shift seats to see occupancy.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming Deadlines</h2>
            <ul className="mt-3 space-y-3">
              {deadlines.map((d) => {
                const leftDays = daysLeft(d.date);
                return (
                  <li key={d.label} className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg',
                        d.tone === 'rose' && 'bg-rose-50 text-rose-600',
                        d.tone === 'amber' && 'bg-amber-50 text-amber-600',
                        d.tone === 'emerald' && 'bg-emerald-50 text-emerald-600',
                      )}
                    >
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-slate-800">{d.label}</p>
                      <p className="text-xs text-slate-500">
                        {d.date ? formatDisplayDate(d.date) : 'Not set'}
                        {leftDays != null
                          ? leftDays >= 0
                            ? ` · ${leftDays}d left`
                            : ` · ${Math.abs(leftDays)}d overdue`
                          : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Applications Trend</h2>
            <div className="mt-2 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="admTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0d9488" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={28}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#0d9488"
                    fill="url(#admTrend)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Quick Actions</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700 transition hover:border-teal-300 hover:bg-teal-50/50"
              >
                <Icon className="h-4 w-4 text-teal-700" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {(summaryQ.isError || funnelQ.isError) && (
          <p className="text-sm text-amber-700">
            Some widgets could not load. Check admissions permissions and try refreshing.
          </p>
        )}
      </div>
    </DashboardShell>
  );
}

function SnapCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-slate-100">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value}</p>
    </div>
  );
}
