'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Database,
  FileSpreadsheet,
  GraduationCap,
  HardDrive,
  IndianRupee,
  Library,
  Mail,
  Megaphone,
  RefreshCw,
  Search,
  Server,
  Settings,
  UserPlus,
  Users,
  Wallet,
  Clock,
  BookMarked,
  Award,
  UserCheck,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardAiAssistant } from '@/components/dashboard/dashboard-ai-assistant';
import { ShiftOperationsSection } from '@/components/dashboard/shift-operations-cards';
import { fetchOperationsCenter } from '@/services/dashboard-analytics';
import { useEffectiveShiftId } from '@/hooks/use-bind-workspace-shift';
import { useShiftScope } from '@/hooks/use-shift-scope';
import { useOptionalWorkspaceContext } from '@/providers/workspace-provider';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import type { OperationsActionItem, OperationsCenter } from '@/types/dashboard-analytics';
import {
  ArrowLink,
  CircularProgress,
  DeptProgressBar,
  FeeBarChart,
  KpiCard,
  OpsSkeleton,
  PriorityBadge,
  QuickActionCard,
  SaaSCard,
  SectionTitle,
  StatusDot,
  fadeUp,
  money,
  pct,
  staggerContainer,
} from '@/components/dashboard/command-center-ui';
import { cn } from '@/utils/cn';
import { getTimeGreeting } from '@/utils/time-greeting';

const ACTION_ICONS: Record<string, typeof AlertTriangle> = {
  attendance: Users,
  fees: Wallet,
  'monthly-fees': Wallet,
  admissions: GraduationCap,
  registrations: ClipboardList,
  leave: CalendarDays,
  notices: Megaphone,
  exams: BookOpen,
};

const QUICK_ACTIONS = [
  { label: 'New Admission', href: '/admin/admissions', icon: GraduationCap, primary: true },
  { label: 'Collect Fee', href: '/admin/fees/collections', icon: Wallet, primary: true },
  { label: 'Add Student', href: '/admin/students', icon: UserPlus },
  { label: 'Mark Attendance', href: '/admin/academics/attendance', icon: ClipboardList },
  { label: 'Generate Report', href: '/admin/fees/reports', icon: FileSpreadsheet },
  { label: 'Send Notice', href: '/admin/communication', icon: Megaphone },
  { label: 'Add Faculty', href: '/admin/hr', icon: Users },
  { label: 'Settings', href: '/admin/organization', icon: Settings },
];

type HealthStatus = 'healthy' | 'warning' | 'critical';

const SYSTEM_HEALTH_GROUPS: Array<{
  title: string;
  items: Array<{ id: string; label: string; status: HealthStatus; meta?: string }>;
}> = [
  {
    title: 'Infrastructure',
    items: [
      { id: 'db', label: 'Database', status: 'healthy', meta: 'PostgreSQL' },
      { id: 'api', label: 'API', status: 'healthy', meta: 'NestJS' },
      { id: 'redis', label: 'Redis', status: 'healthy', meta: 'Cache & queues' },
      { id: 'queue', label: 'Queue', status: 'healthy', meta: 'Background jobs' },
    ],
  },
  {
    title: 'Communication',
    items: [
      { id: 'email', label: 'Email', status: 'healthy' },
      { id: 'sms', label: 'SMS', status: 'warning', meta: 'Check gateway' },
      { id: 'wa', label: 'WhatsApp', status: 'healthy' },
    ],
  },
  {
    title: 'Storage',
    items: [
      { id: 'pg-store', label: 'PostgreSQL', status: 'healthy' },
      { id: 'backup', label: 'Backups', status: 'healthy', meta: 'Last run OK' },
      { id: 'cloud', label: 'Cloud storage', status: 'healthy' },
    ],
  },
];

const SHORTCUT_GROUPS: Array<{
  title: string;
  permissionAny?: string[];
  items: Array<{ label: string; href: string; icon: typeof Search; permissionAny?: string[] }>;
}> = [
  {
    title: 'Student',
    permissionAny: ['students:read', 'admissions:read', 'certificates:read'],
    items: [
      {
        label: 'Student Search',
        href: '/admin/students',
        icon: Search,
        permissionAny: ['students:read'],
      },
      {
        label: 'Admission',
        href: '/admin/admissions',
        icon: GraduationCap,
        permissionAny: ['admissions:read'],
      },
      {
        label: 'Certificates',
        href: '/admin/certificates',
        icon: Award,
        permissionAny: ['certificates:read'],
      },
      {
        label: 'Subject Registration',
        href: '/admin/academics/registration',
        icon: ClipboardList,
        permissionAny: ['academic:read'],
      },
    ],
  },
  {
    title: 'Academic',
    permissionAny: ['academic:read', 'academic:manage'],
    items: [
      {
        label: 'Curriculum',
        href: '/admin/programs',
        icon: BookMarked,
        permissionAny: ['academic:read'],
      },
      {
        label: 'Timetable',
        href: '/admin/academics/timetable',
        icon: CalendarDays,
        permissionAny: ['academic:read'],
      },
      {
        label: 'Faculty Allocation',
        href: '/admin/hr',
        icon: UserCheck,
        permissionAny: ['staff:read', 'hr:read'],
      },
      {
        label: 'Attendance',
        href: '/admin/academics/attendance',
        icon: BookOpen,
        permissionAny: ['academic:read'],
      },
    ],
  },
  {
    title: 'Finance',
    permissionAny: ['fees:read', 'fees:manage'],
    items: [
      {
        label: 'Fee Collection',
        href: '/admin/fees/collections',
        icon: IndianRupee,
        permissionAny: ['fees:read'],
      },
      {
        label: 'Receipts',
        href: '/admin/fees/reports',
        icon: FileSpreadsheet,
        permissionAny: ['fees:read'],
      },
      {
        label: 'Scholarships',
        href: '/admin/fees/reports',
        icon: Wallet,
        permissionAny: ['fees:read'],
      },
    ],
  },
  {
    title: 'HR',
    permissionAny: ['staff:read', 'hr:read', 'hr:manage'],
    items: [
      {
        label: 'Staff Directory',
        href: '/admin/hr',
        icon: Users,
        permissionAny: ['staff:read', 'hr:read'],
      },
      { label: 'Leave', href: '/admin/hr', icon: CalendarDays, permissionAny: ['hr:read'] },
      {
        label: 'Recruitment',
        href: '/admin/hr/recruitment',
        icon: UserPlus,
        permissionAny: ['hr:read'],
      },
    ],
  },
];

const NOTIFICATION_ICONS = [Bell, GraduationCap, Wallet, ClipboardList, Library];

function sparkTrend(values: number[]) {
  if (values.length < 2) return { pct: 0, up: true };
  const last = values[values.length - 1] ?? 0;
  const prev = values[values.length - 2] ?? 0;
  if (!prev) return { pct: 0, up: last >= 0 };
  const change = Math.round(((last - prev) / prev) * 1000) / 10;
  return { pct: Math.abs(change), up: change >= 0 };
}

function actionDescription(action: OperationsActionItem) {
  const map: Record<string, string> = {
    attendance: 'Review attendance defaulters and condonation cases',
    fees: 'Follow up on outstanding fee balances',
    'monthly-fees': 'Monthly tuition demands awaiting payment',
    admissions: 'Applications submitted and awaiting committee review',
    registrations: 'Semester registrations pending approval',
    leave: 'Staff leave requests need HR action',
    notices: 'Recently published institutional notices',
    exams: 'Examination schedule and preparation status',
  };
  return map[action.id] ?? 'Tap to open the related module';
}

function hasAnyPermission(permissions: string[] | undefined, required?: string[]) {
  if (!required?.length) return true;
  // While session permissions are loading, show full shortcut set.
  if (!permissions?.length) return true;
  const set = new Set(permissions);
  if (set.has('*') || set.has('admin:*')) return true;
  return required.some((p) => set.has(p));
}

export function OperationsCommandCenter({ userName }: { userName?: string }) {
  const { branding } = useInstitutionBranding();
  const workspace = useOptionalWorkspaceContext();
  const shiftScope = useShiftScope();
  const effectiveShiftId = useEffectiveShiftId(undefined);
  const permissions = useAuthStore((s) => s.session?.user?.permissions);
  const [clock, setClock] = useState('');

  const opsQ = useQuery({
    queryKey: ['dashboard', 'operations', effectiveShiftId, workspace?.kind],
    queryFn: () => fetchOperationsCenter(effectiveShiftId ? { shiftId: effectiveShiftId } : {}),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const ops = opsQ.data;
  const dayGreeting = getTimeGreeting();
  const displayName = userName ?? ops?.greeting.userName ?? 'Admin';
  const institutionName = branding?.displayName ?? 'Don Bosco College, Tura';

  useEffect(() => {
    const tick = () => {
      setClock(
        new Date().toLocaleString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const collectionTrend = useMemo(
    () => sparkTrend(ops?.finance.collectionSparkline ?? []),
    [ops?.finance.collectionSparkline],
  );

  const notifications = useMemo(() => {
    if (!ops) return [];
    const items: Array<{
      id: string;
      icon: typeof Bell;
      message: string;
      timestamp: string;
      href: string;
      count?: number;
    }> = [];

    if (ops.admissions?.pendingReview) {
      items.push({
        id: 'adm',
        icon: GraduationCap,
        message: 'Pending admissions',
        timestamp: 'Review applications',
        href: '/admin/admissions',
        count: ops.admissions.pendingReview,
      });
    }
    if (ops.finance.defaulters > 0) {
      items.push({
        id: 'fees',
        icon: Wallet,
        message: 'Fee approvals / defaulters',
        timestamp: 'Outstanding balances',
        href: '/admin/fees/defaulters',
        count: ops.finance.defaulters,
      });
    }
    for (const action of ops.actions) {
      if (action.id === 'leave') {
        items.push({
          id: 'leave',
          icon: CalendarDays,
          message: 'Leave requests',
          timestamp: action.message,
          href: action.href,
          count: action.count,
        });
      }
      if (action.id === 'registrations') {
        items.push({
          id: 'reg',
          icon: ClipboardList,
          message: 'Registration tasks',
          timestamp: action.message,
          href: action.href,
          count: action.count,
        });
      }
    }
    for (const [i, a] of ops.announcements.slice(0, 2).entries()) {
      items.push({
        id: `ann-${i}`,
        icon: NOTIFICATION_ICONS[i % NOTIFICATION_ICONS.length],
        message: a.title,
        timestamp: a.date,
        href: a.href ?? '/admin',
      });
    }
    return items.slice(0, 6);
  }, [ops]);

  const shortcutGroups = useMemo(
    () =>
      SHORTCUT_GROUPS.filter((g) => hasAnyPermission(permissions, g.permissionAny))
        .map((g) => ({
          ...g,
          items: g.items.filter((item) => hasAnyPermission(permissions, item.permissionAny)),
        }))
        .filter((g) => g.items.length > 0),
    [permissions],
  );

  return (
    <div className="min-h-full space-y-6 rounded-2xl bg-[#F8FAFC] pb-6 dark:bg-background">
      {/* Section 1 — Header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-border/60 dark:bg-card"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-foreground">
              {dayGreeting}, {displayName} 👋
            </h1>
            <p className="mt-1 text-sm font-semibold text-[#2563EB]">{institutionName}</p>
            {shiftScope.hideShiftSelectors && shiftScope.activeShiftName ? (
              <p className="mt-1 text-xs font-medium text-[#64748B]">
                Workspace:{' '}
                <span className="text-[#0F172A] dark:text-foreground">
                  {shiftScope.activeShiftName}
                </span>
              </p>
            ) : null}
            {ops ? (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#475569]">
                <span>
                  Academic Year:{' '}
                  <strong className="text-[#0F172A]">{ops.institution.academicYear}</strong>
                </span>
                <span>
                  {(ops.institution.activeSemesters?.length ?? 0) > 1 ? 'Semesters' : 'Semester'}:{' '}
                  <strong className="text-[#0F172A]">{ops.institution.semester}</strong>
                </span>
                {ops.institution.cycle ? (
                  <span>
                    Cycle: <strong className="text-[#0F172A]">{ops.institution.cycle}</strong>
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#64748B]">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {clock}
              </span>
              {ops?.updatedAt ? (
                <span>
                  Last sync:{' '}
                  {new Date(ops.updatedAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative hidden w-64 lg:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
              <Input
                readOnly
                placeholder="Search students, staff, fees, reports..."
                className="h-9 rounded-xl border-slate-200 bg-slate-50 pl-9 text-sm"
                onFocus={() => {
                  document.dispatchEvent(
                    new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
                  );
                }}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => void opsQ.refetch()}
              disabled={opsQ.isFetching}
            >
              <RefreshCw className={cn('mr-2 h-4 w-4', opsQ.isFetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </motion.header>

      {opsQ.isLoading && !ops ? <OpsSkeleton /> : null}

      {ops ? (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          <ShiftOperationsSection />

          {/* KPI strip */}
          <div className="grid items-stretch gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Students"
              value={ops.institution.studentCount.toLocaleString('en-IN')}
              subValue={`${ops.admissions?.approved ?? 0} new admissions`}
              hint="Active enrollment"
              icon={Users}
              tone="purple"
              href="/admin/students"
            />
            <KpiCard
              label="Faculty / Staff"
              value={ops.institution.staffCount.toLocaleString('en-IN')}
              subValue="On record"
              hint="Teaching & non-teaching"
              icon={UserCheck}
              tone="blue"
              href="/admin/hr"
            />
            <KpiCard
              label="Today's Attendance"
              value={ops.academic.dataSource === 'live' ? pct(ops.pulse.attendanceTodayPct) : '—'}
              subValue={
                ops.academic.dataSource === 'live'
                  ? `${ops.academic.studentsPresent.toLocaleString('en-IN')} present`
                  : 'Awaiting session data'
              }
              hint={`${ops.academic.classesCompleted}/${ops.academic.classesScheduled} classes marked`}
              icon={BookOpen}
              tone="blue"
              href="/admin/academics/attendance"
            />
            <KpiCard
              label="Today's Collection"
              value={money(ops.finance.todayCollection)}
              subValue={`${money(ops.finance.monthCollection)} this month`}
              hint={`${pct(ops.finance.collectionRate)} collection rate`}
              icon={IndianRupee}
              tone="green"
              href="/admin/fees/collections"
              trend={collectionTrend}
            />
            <KpiCard
              label="Pending Fees"
              value={money(ops.pulse.pendingDues)}
              subValue={`${ops.finance.defaulters} defaulters`}
              hint={`${ops.finance.monthlyTuitionPending} monthly pending`}
              icon={AlertTriangle}
              tone="red"
              href="/admin/fees/defaulters"
            />
            <KpiCard
              label="Admissions"
              value={String(ops.admissions?.pendingReview ?? ops.admissions?.submitted ?? 0)}
              subValue="Pending reviews"
              hint={`${ops.admissions?.received ?? 0} applications received`}
              icon={GraduationCap}
              tone="orange"
              href="/admin/admissions"
            />
          </div>

          {/* Hero — OneCampus AI Assistant */}
          <DashboardAiAssistant variant="hero" />

          {/* Operational widgets */}
          <div className="grid gap-4 lg:grid-cols-3">
            <SystemHealthPanel />
            <SmartShortcutsPanel groups={shortcutGroups} />
            <NotificationsPanel items={notifications} actions={ops.actions} />
          </div>

          {/* Analytics */}
          <div className="grid gap-4 lg:grid-cols-3">
            <AdmissionsOverview ops={ops} />
            <FeeOverview ops={ops} />
            <AttendanceOverview ops={ops} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SaaSCard>
              <SectionTitle
                title="Department Strength"
                subtitle="Students and attendance by department"
                action={<ArrowLink href="/admin/analytics" label="Full analytics" />}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                {ops.departments.length ? (
                  ops.departments.map((d) => (
                    <DeptProgressBar
                      key={d.name}
                      name={d.name}
                      value={d.attendancePct}
                      metric={`${d.students} students`}
                    />
                  ))
                ) : (
                  <p className="text-sm text-[#64748B]">No department data available.</p>
                )}
              </div>
            </SaaSCard>

            <SaaSCard id="action-center">
              <SectionTitle
                title="Pending Approvals"
                subtitle="Tasks requiring attention"
                action={
                  ops.actions.length ? (
                    <span className="rounded-full bg-[#2563EB]/10 px-3 py-1 text-xs font-bold text-[#2563EB]">
                      {ops.actions.length} pending
                    </span>
                  ) : null
                }
              />
              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {ops.actions.length ? (
                  ops.actions.map((action) => <ActionRow key={action.id} action={action} />)
                ) : (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-800">
                    All clear — no urgent actions today.
                  </p>
                )}
              </div>
            </SaaSCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SaaSCard>
              <SectionTitle
                title="Upcoming Events"
                action={<ArrowLink href="/admin/academics/examinations" label="Calendar" />}
              />
              <div className="space-y-2">
                {ops.upcomingEvents.length ? (
                  ops.upcomingEvents.map((ev, i) => (
                    <Link
                      key={`${ev.label}-${i}`}
                      href={ev.href ?? '#'}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition-all hover:border-[#2563EB]/30 hover:shadow-sm"
                    >
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-[#2563EB]/10 text-[#2563EB]">
                        <span className="text-[10px] font-bold uppercase">
                          {ev.date.split(' ').pop()}
                        </span>
                        <span className="text-sm font-extrabold leading-none">
                          {ev.date.split(' ')[0]}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[#0F172A]">{ev.label}</p>
                        <p className="text-xs text-[#64748B]">Institutional calendar event</p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-[#64748B]" />
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-[#64748B]">No upcoming events scheduled.</p>
                )}
              </div>
            </SaaSCard>

            <SaaSCard>
              <SectionTitle title="Quick Actions" subtitle="One-click operations" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {QUICK_ACTIONS.map((action) => (
                  <QuickActionCard key={action.href} {...action} />
                ))}
              </div>
            </SaaSCard>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}

function SystemHealthPanel() {
  return (
    <SaaSCard className="h-full">
      <SectionTitle title="System Health" subtitle="Infrastructure & integrations" />
      <div className="space-y-4">
        {SYSTEM_HEALTH_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
              {group.title}
            </p>
            <div className="grid gap-1.5">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#0F172A]">{item.label}</p>
                    {item.meta ? <p className="text-[10px] text-[#64748B]">{item.meta}</p> : null}
                  </div>
                  <StatusDot status={item.status} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-[10px] text-[#64748B]">
          <div className="flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5" /> CPU / Memory OK
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5" /> Disk healthy
          </div>
          <div className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" /> DB online
          </div>
          <div className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Jobs running
          </div>
        </div>
      </div>
    </SaaSCard>
  );
}

function SmartShortcutsPanel({
  groups,
}: {
  groups: Array<{
    title: string;
    items: Array<{ label: string; href: string; icon: typeof Search }>;
  }>;
}) {
  return (
    <SaaSCard className="h-full">
      <SectionTitle title="Smart Shortcuts" subtitle="Role-aware module access" />
      <div className="max-h-[340px] space-y-3 overflow-y-auto pr-1">
        {groups.length ? (
          groups.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                {group.title}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {group.items.map((item) => (
                  <Link
                    key={`${group.title}-${item.href}-${item.label}`}
                    href={item.href}
                    className="flex items-center gap-2 rounded-lg border border-slate-100 px-2 py-2 text-left transition-all hover:border-[#2563EB]/30 hover:bg-[#2563EB]/5"
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-[#2563EB]" />
                    <span className="text-[11px] font-semibold text-[#334155]">{item.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-[#64748B]">No shortcuts for your role.</p>
        )}
      </div>
    </SaaSCard>
  );
}

function NotificationsPanel({
  items,
  actions,
}: {
  items: Array<{
    id: string;
    icon: typeof Bell;
    message: string;
    timestamp: string;
    href: string;
    count?: number;
  }>;
  actions: OperationsActionItem[];
}) {
  return (
    <SaaSCard className="h-full">
      <SectionTitle
        title="Notifications"
        subtitle="Pending work & alerts"
        action={
          actions.length ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {actions.length} open
            </span>
          ) : null
        }
      />
      <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
        {items.length ? (
          items.map((n) => (
            <Link
              key={n.id}
              href={n.href}
              className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2563EB]/10">
                <n.icon className="h-4 w-4 text-[#2563EB]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#0F172A]">{n.message}</p>
                  {n.count != null ? (
                    <span className="rounded-full bg-[#0F172A] px-2 py-0.5 text-[10px] font-bold text-white">
                      {n.count}
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] text-[#64748B]">{n.timestamp}</p>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-sm text-[#64748B]">No pending notifications.</p>
        )}
      </div>
    </SaaSCard>
  );
}

function ActionRow({ action }: { action: OperationsActionItem }) {
  const Icon = ACTION_ICONS[action.icon] ?? AlertTriangle;

  return (
    <motion.div variants={fadeUp}>
      <Link
        href={action.href}
        className="group flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-4 transition-all hover:border-[#2563EB]/30 hover:shadow-md"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
          <Icon className="h-5 w-5 text-[#475569]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[#0F172A]">{action.message}</p>
            <PriorityBadge priority={action.priority} />
          </div>
          <p className="mt-0.5 text-xs text-[#64748B]">{actionDescription(action)}</p>
        </div>
        {action.count != null ? (
          <span className="rounded-full bg-[#0F172A] px-2.5 py-1 text-xs font-bold text-white">
            {action.count}
          </span>
        ) : null}
        <ArrowRight className="h-4 w-4 shrink-0 text-[#64748B] transition-transform group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}

function AdmissionsOverview({ ops }: { ops: OperationsCenter }) {
  const adm = ops.admissions;
  const completion = adm?.completionPct ?? 0;

  return (
    <motion.div variants={fadeUp}>
      <SaaSCard className="h-full">
        <SectionTitle
          title="Admissions Overview"
          action={adm ? <ArrowLink href="/admin/admissions" label="View dashboard" /> : undefined}
        />
        {adm ? (
          <>
            <div className="flex justify-center py-2">
              <CircularProgress
                value={completion}
                label="Admission completion"
                sublabel="filled"
                color="#F59E0B"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <MetricPill label="Total seats" value={String(adm.totalSeats)} />
              <MetricPill label="Seats filled" value={String(adm.seatsFilled)} />
              <MetricPill label="Applications" value={String(adm.received)} />
              <MetricPill label="Pending" value={String(adm.pendingReview)} highlight />
            </div>
          </>
        ) : (
          <p className="text-sm text-[#64748B]">No active admission season.</p>
        )}
      </SaaSCard>
    </motion.div>
  );
}

function FeeOverview({ ops }: { ops: OperationsCenter }) {
  return (
    <motion.div variants={fadeUp}>
      <SaaSCard className="h-full">
        <SectionTitle
          title="Fee Collection Overview"
          action={<ArrowLink href="/admin/fees/reports" label="Reports" />}
        />
        <div className="grid grid-cols-2 gap-2 text-sm">
          <MetricPill label="Today" value={money(ops.finance.todayCollection)} highlight />
          <MetricPill label="This month" value={money(ops.finance.monthCollection)} />
          <MetricPill label="Outstanding" value={money(ops.finance.pendingDues)} />
          <MetricPill label="Collection rate" value={pct(ops.finance.collectionRate)} />
        </div>
        <p className="mb-2 mt-4 text-xs font-semibold text-[#64748B]">7-day collection trend</p>
        <FeeBarChart values={ops.finance.collectionSparkline} />
      </SaaSCard>
    </motion.div>
  );
}

function AttendanceOverview({ ops }: { ops: OperationsCenter }) {
  const studentPct = ops.academic.dataSource === 'live' ? ops.academic.studentAttendancePct : 0;
  const facultyPct = ops.academic.facultyAttendancePct;

  return (
    <motion.div variants={fadeUp}>
      <SaaSCard className="h-full">
        <SectionTitle
          title="Attendance Overview"
          action={<ArrowLink href="/admin/academics/attendance" label="Open" />}
        />
        <div className="flex justify-around gap-2 py-2">
          <CircularProgress
            value={studentPct}
            label="Student attendance"
            color="#2563EB"
            size={100}
          />
          <CircularProgress
            value={facultyPct}
            label="Faculty attendance"
            color="#16A34A"
            size={100}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <MetricPill label="Classes conducted" value={String(ops.academic.classesCompleted)} />
          <MetricPill label="Classes pending" value={String(ops.academic.classesPending)} />
          <MetricPill
            label="Students present"
            value={String(ops.academic.studentsPresent)}
            highlight
          />
          <MetricPill label="Students absent" value={String(ops.academic.studentsAbsent)} />
        </div>
      </SaaSCard>
    </motion.div>
  );
}

function MetricPill({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">{label}</p>
      <p className={cn('text-sm font-bold', highlight ? 'text-[#2563EB]' : 'text-[#0F172A]')}>
        {value}
      </p>
    </div>
  );
}
