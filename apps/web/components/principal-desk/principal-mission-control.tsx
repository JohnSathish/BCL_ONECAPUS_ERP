'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  Megaphone,
  ScanLine,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { AnimatedCounter } from '@/components/dashboard/animated-counter';
import {
  CircularProgress,
  SaaSCard,
  SectionTitle,
  fadeUp,
  money,
  staggerContainer,
} from '@/components/dashboard/command-center-ui';
import { PrincipalDeskNav } from '@/components/principal-desk/principal-desk-nav';
import { PrincipalMissionScanner } from '@/components/principal-desk/principal-mission-scanner';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchPrincipalDashboard } from '@/services/principal-desk';
import type { PrincipalDeskDashboard } from '@/types/principal-desk';
import { cn } from '@/utils/cn';

function formatLakhs(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)} L`;
  return money(n);
}

function healthColor(band: 'green' | 'orange' | 'red') {
  if (band === 'green') return '#16A34A';
  if (band === 'orange') return '#F59E0B';
  return '#EF4444';
}

const QUICK_ACTIONS = [
  { label: 'Approve Leave', href: '/principal-desk/leave', icon: CalendarDays, primary: true },
  {
    label: 'Student Lookup',
    href: '/principal-desk/student-lookup',
    icon: ScanLine,
    primary: true,
  },
  { label: 'Staff Lookup', href: '/principal-desk/staff', icon: Users },
  { label: 'Fee Defaulters', href: '/principal-desk/fees', icon: Wallet },
  { label: 'Attendance Risk', href: '/principal-desk/attendance', icon: ClipboardCheck },
  { label: 'Committees', href: '/principal-desk/committees', icon: Building2 },
  { label: 'Events', href: '/principal-desk/events', icon: Megaphone },
  { label: 'Reports', href: '/principal-desk/reports', icon: FileText },
];

const FLOATING_ACTIONS = [
  { label: 'Student Lookup', href: '/principal-desk/student-lookup', icon: ScanLine },
  { label: 'Staff Lookup', href: '/principal-desk/staff', icon: Users },
  { label: 'Notices', href: '/principal-desk/notices', icon: Megaphone },
  { label: 'Reports', href: '/principal-desk/reports', icon: FileText },
];

function MissionHeader({
  data,
  institutionName,
}: {
  data: PrincipalDeskDashboard;
  institutionName: string;
}) {
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-700 px-6 py-5 text-white shadow-xl shadow-indigo-900/30">
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-indigo-200">
            Principal Command Center
          </p>
          <h1 className="mt-1 text-xl font-black tracking-tight sm:text-2xl">{institutionName}</h1>
          <p className="mt-1 text-sm text-indigo-100/90">
            AY {data.institution.academicYear} · {data.institution.semester}
            {data.institution.cycle ? ` · ${data.institution.cycle}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 lg:justify-end">
          <div className="rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-wider text-indigo-200">On Campus Now</p>
            <p className="text-2xl font-black">
              <AnimatedCounter value={data.operations.activeOnCampus} />
            </p>
          </div>
          <div className="rounded-xl bg-white/10 px-4 py-2 text-right backdrop-blur-sm">
            <p className="text-sm font-semibold">{data.greeting.dateLabel}</p>
            <p className="font-mono text-2xl font-black tabular-nums">{clock}</p>
          </div>
          <CampusHealthBadge data={data} />
        </div>
      </div>
    </div>
  );
}

function CampusHealthBadge({ data }: { data: PrincipalDeskDashboard }) {
  const color = healthColor(data.campusHealth.band);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-black/20 px-4 py-2 backdrop-blur-sm">
      <div
        className="relative flex h-14 w-14 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(${color} ${data.campusHealth.score * 3.6}deg, rgba(255,255,255,0.15) 0deg)`,
        }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-900/80 text-sm font-black">
          <AnimatedCounter value={data.campusHealth.score} suffix="%" />
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-indigo-200">Campus Health</p>
        <p className="text-sm font-bold capitalize">{data.campusHealth.band} status</p>
      </div>
    </div>
  );
}

function CriticalAlertCard({
  title,
  count,
  sub,
  href,
  urgent,
}: {
  title: string;
  count: number;
  sub: string;
  href: string;
  urgent?: boolean;
}) {
  const isAlert = urgent && count > 0;
  return (
    <Link href={href}>
      <motion.div
        variants={fadeUp}
        whileHover={{ y: -2, scale: 1.01 }}
        className={cn(
          'group relative overflow-hidden rounded-2xl border p-4 transition-shadow',
          isAlert
            ? 'border-rose-300/80 bg-gradient-to-br from-rose-50 to-red-50 shadow-lg shadow-rose-200/50 hover:shadow-xl'
            : 'border-slate-200/80 bg-white shadow-sm hover:shadow-md dark:bg-card',
        )}
      >
        {isAlert && (
          <div className="absolute right-3 top-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
          </div>
        )}
        <p
          className={cn(
            'text-[10px] font-bold uppercase tracking-wider',
            isAlert ? 'text-rose-600' : 'text-slate-500',
          )}
        >
          {isAlert && '🚨 '}
          {title}
        </p>
        <p
          className={cn(
            'mt-1 text-3xl font-black tabular-nums',
            isAlert ? 'text-rose-700' : 'text-slate-800 dark:text-foreground',
          )}
        >
          <AnimatedCounter value={count} />
        </p>
        <p className={cn('mt-0.5 text-xs', isAlert ? 'text-rose-600/80' : 'text-slate-500')}>
          {sub}
        </p>
      </motion.div>
    </Link>
  );
}

function OperationsGrid({ data }: { data: PrincipalDeskDashboard }) {
  const studentPct = data.operations.studentPresentPct || data.academic.studentAttendancePct;
  const facultyPct = data.operations.facultyPresentPct;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SaaSCard className="transition-shadow hover:shadow-lg">
        <SectionTitle title="Attendance" subtitle="Live today" />
        <div className="flex justify-around gap-2 py-2">
          <CircularProgress
            value={studentPct}
            size={100}
            stroke={8}
            color="#2563EB"
            label="Students Present"
            sublabel="today"
          />
          <CircularProgress
            value={facultyPct}
            size={100}
            stroke={8}
            color="#16A34A"
            label="Faculty Present"
            sublabel="today"
          />
        </div>
      </SaaSCard>

      <SaaSCard className="transition-shadow hover:shadow-lg">
        <SectionTitle title="Fee Collection" />
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-500">Today</p>
            <p className="text-2xl font-black text-emerald-600">
              ₹<AnimatedCounter value={data.finance.todayCollection} />
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-500">This Month</p>
            <p className="text-xl font-bold text-slate-800">
              {formatLakhs(data.finance.monthCollection)}
            </p>
          </div>
        </div>
      </SaaSCard>

      <SaaSCard className="transition-shadow hover:shadow-lg">
        <SectionTitle title="Academic" />
        <div className="space-y-2">
          <Row label="Classes Scheduled" value={data.academic.classesScheduled} />
          <Row label="Completed" value={data.academic.classesCompleted} tone="green" />
          <Row label="Pending" value={data.academic.classesPending} tone="amber" />
        </div>
      </SaaSCard>

      <SaaSCard className="transition-shadow hover:shadow-lg">
        <SectionTitle title="Library" />
        <div className="space-y-2">
          <Row label="Issued Today" value={data.operations.library.issuedToday} icon={BookOpen} />
          <Row label="Returns Today" value={data.operations.library.returnsToday} tone="green" />
          <Row
            label="Overdue Books"
            value={data.operations.library.overdueBooks}
            tone={data.operations.library.overdueBooks > 0 ? 'red' : undefined}
          />
        </div>
      </SaaSCard>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone?: 'green' | 'amber' | 'red';
  icon?: typeof BookOpen;
}) {
  const toneClass =
    tone === 'green'
      ? 'text-emerald-600'
      : tone === 'amber'
        ? 'text-amber-600'
        : tone === 'red'
          ? 'text-rose-600'
          : 'text-slate-800';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className={cn('font-black tabular-nums', toneClass)}>
        <AnimatedCounter value={value} />
      </span>
    </div>
  );
}

function ActionCenter() {
  return (
    <SaaSCard>
      <SectionTitle title="Principal Action Center" subtitle="One-click decisions" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} href={action.href}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors',
                  action.primary
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-900 hover:bg-indigo-100'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white hover:shadow-sm',
                )}
              >
                <Icon
                  className={cn('h-5 w-5', action.primary ? 'text-indigo-600' : 'text-slate-500')}
                />
                <span className="text-xs font-semibold leading-tight">{action.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </SaaSCard>
  );
}

function EventsTimeline({ data }: { data: PrincipalDeskDashboard }) {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof data.eventTimeline>();
    for (const item of data.eventTimeline) {
      const list = map.get(item.dayGroup) ?? [];
      list.push(item);
      map.set(item.dayGroup, list);
    }
    return [...map.entries()];
  }, [data.eventTimeline]);

  return (
    <SaaSCard>
      <SectionTitle title="Upcoming Events" subtitle="Timeline view" />
      {grouped.length === 0 ? (
        <p className="text-sm text-slate-500">No scheduled events in the near term.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
                {day}
              </p>
              <ul className="space-y-2 border-l-2 border-indigo-100 pl-4">
                {items.map((item, i) => (
                  <li key={`${day}-${i}`}>
                    <Link
                      href={item.href ?? '/principal-desk/events'}
                      className="group flex gap-3 text-sm hover:text-indigo-600"
                    >
                      <span className="shrink-0 font-mono text-xs text-slate-400 group-hover:text-indigo-500">
                        {item.time}
                      </span>
                      <span className="font-medium text-slate-700 group-hover:text-indigo-700">
                        {item.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </SaaSCard>
  );
}

function CommitteeTable({ data }: { data: PrincipalDeskDashboard }) {
  const rows = data.committeeActivity;
  return (
    <SaaSCard>
      <SectionTitle
        title="Committee Activity"
        subtitle="Pending tasks by committee"
        action={
          <Link href="/principal-desk/committees" className="text-xs font-semibold text-indigo-600">
            View all
          </Link>
        }
      />
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No active committee tasks.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2">Committee</th>
                <th className="px-4 py-2 text-right">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-indigo-50/50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">
                    <Link href={row.href} className="hover:text-indigo-600">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={cn(
                        'inline-flex min-w-[2rem] justify-center rounded-full px-2 py-0.5 text-xs font-bold',
                        row.pending > 0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      {row.pending}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SaaSCard>
  );
}

function IntelligencePanel({ data }: { data: PrincipalDeskDashboard }) {
  const { salutation, bullets } = data.intelligenceSummary;
  return (
    <SaaSCard className="border-violet-200/60 bg-gradient-to-br from-violet-50/80 via-white to-indigo-50/50">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-300">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Principal Intelligence</h2>
          <p className="text-xs text-slate-500">AI-generated briefing</p>
        </div>
      </div>
      <p className="mb-3 text-base font-bold text-slate-800">{salutation}, Principal.</p>
      <ul className="space-y-2">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex gap-2 text-sm text-slate-700">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
            {bullet}
          </li>
        ))}
      </ul>
    </SaaSCard>
  );
}

function FloatingBar() {
  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-1 rounded-2xl border border-slate-200/80 bg-white/95 px-2 py-2 shadow-2xl shadow-slate-900/15 backdrop-blur-md dark:bg-card/95">
      {FLOATING_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link key={action.href} href={action.href}>
            <motion.span
              whileHover={{ y: -2 }}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{action.label}</span>
            </motion.span>
          </Link>
        );
      })}
    </div>
  );
}

export function PrincipalMissionControl() {
  const enabled = useAuthQueryEnabled();
  const { branding } = useInstitutionBranding();
  const { data, isLoading } = useQuery({
    queryKey: ['principal-desk', 'dashboard'],
    queryFn: fetchPrincipalDashboard,
    enabled,
    refetchInterval: 60_000,
  });

  const institutionName = branding?.displayName ?? 'Don Bosco College, Tura';
  const alerts = data?.criticalAlerts;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-[#F1F5F9] to-slate-100 pb-24 dark:from-background dark:via-background dark:to-background">
      <PrincipalDeskNav />
      <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6">
        {isLoading || !data ? (
          <div className="space-y-4">
            <div className="h-28 animate-pulse rounded-2xl bg-indigo-200/50" />
            <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/50" />
              ))}
            </div>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="space-y-6"
          >
            <motion.div variants={fadeUp}>
              <MissionHeader data={data} institutionName={institutionName} />
            </motion.div>

            <motion.div variants={fadeUp}>
              <PrincipalMissionScanner />
            </motion.div>

            {alerts && (
              <motion.section variants={fadeUp}>
                <SectionTitle
                  title="Today's Critical Alerts"
                  subtitle="Requires principal attention — red items are urgent"
                />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <CriticalAlertCard
                    title="Attendance Risk"
                    count={alerts.attendanceRisk.count}
                    sub={alerts.attendanceRisk.label}
                    href={alerts.attendanceRisk.href}
                    urgent={alerts.attendanceRisk.count > 0}
                  />
                  <CriticalAlertCard
                    title="Fee Defaulters"
                    count={alerts.feeDefaulters.count}
                    sub={formatLakhs(alerts.feeDefaulters.amount) + ' due'}
                    href={alerts.feeDefaulters.href}
                    urgent={alerts.feeDefaulters.count > 0}
                  />
                  <CriticalAlertCard
                    title="Library Overdue"
                    count={alerts.libraryOverdue.count}
                    sub={`${alerts.libraryOverdue.books} books`}
                    href={alerts.libraryOverdue.href}
                    urgent={alerts.libraryOverdue.count > 0}
                  />
                  <CriticalAlertCard
                    title="Leave Pending"
                    count={alerts.leavePending.count}
                    sub="Awaiting approval"
                    href={alerts.leavePending.href}
                    urgent={alerts.leavePending.count > 0}
                  />
                  <CriticalAlertCard
                    title="Staff Absent"
                    count={alerts.staffAbsentToday.count}
                    sub="Today"
                    href={alerts.staffAbsentToday.href}
                    urgent={alerts.staffAbsentToday.count > 0}
                  />
                  <CriticalAlertCard
                    title="Meetings Today"
                    count={alerts.committeeMeetingsToday.count}
                    sub="Committee sessions"
                    href={alerts.committeeMeetingsToday.href}
                    urgent={alerts.committeeMeetingsToday.count > 0}
                  />
                </div>
              </motion.section>
            )}

            <motion.section variants={fadeUp}>
              <SectionTitle title="College Operations Center" subtitle="Live operational status" />
              <OperationsGrid data={data} />
            </motion.section>

            <motion.div variants={fadeUp}>
              <ActionCenter />
            </motion.div>

            <motion.div variants={fadeUp} className="grid gap-4 lg:grid-cols-2">
              <EventsTimeline data={data} />
              <CommitteeTable data={data} />
            </motion.div>

            <motion.div variants={fadeUp}>
              <IntelligencePanel data={data} />
            </motion.div>
          </motion.div>
        )}
      </main>
      <FloatingBar />
    </div>
  );
}
