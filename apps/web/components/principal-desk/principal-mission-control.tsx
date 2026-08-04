'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ClipboardCheck,
  Mail,
  Megaphone,
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
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { fetchPrincipalDashboard } from '@/services/principal-desk';
import type { PrincipalDeskDashboard } from '@/types/principal-desk';
import { cn } from '@/utils/cn';

function formatLakhs(n: number) {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)} L`;
  return money(n);
}

function liveClock() {
  return new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ExecutiveHeader({
  data,
  institutionName,
}: {
  data: PrincipalDeskDashboard;
  institutionName: string;
}) {
  const [clock, setClock] = useState(liveClock);
  useEffect(() => {
    const id = window.setInterval(() => setClock(liveClock()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Executive Overview
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-foreground">
          {data.intelligenceSummary.salutation}, {data.greeting.userName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {institutionName}
          {data.institution.academicYear ? ` · ${data.institution.academicYear}` : ''}
          {data.institution.semester ? ` · ${data.institution.semester}` : ''}
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm dark:border-border dark:bg-card">
        <p className="font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-foreground">
          {clock}
        </p>
        <p className="text-[11px] text-slate-500">
          {data.greeting.dayLabel} · {data.greeting.dateLabel}
        </p>
      </div>
    </div>
  );
}

function CriticalAlertsStrip({ data }: { data: PrincipalDeskDashboard }) {
  const alerts = data.criticalAlerts;
  const items = [
    {
      title: 'Leave Requests',
      count: alerts.leavePending.count,
      sub: 'Awaiting Approval',
      href: alerts.leavePending.href,
      urgent: alerts.leavePending.count > 0,
    },
    {
      title: 'Fee Defaulters',
      count: alerts.feeDefaulters.count,
      sub: `${formatLakhs(alerts.feeDefaulters.amount)} outstanding`,
      href: alerts.feeDefaulters.href,
      urgent: alerts.feeDefaulters.count > 0,
    },
    {
      title: 'Admissions',
      count: data.executiveKpis?.admissionsToday ?? 0,
      sub: 'Awaiting Verification',
      href: '/principal-desk/student-lookup',
      urgent: (data.executiveKpis?.admissionsToday ?? 0) > 0,
    },
    {
      title: 'Attendance Risk',
      count: alerts.attendanceRisk.count,
      sub: alerts.attendanceRisk.label,
      href: alerts.attendanceRisk.href,
      urgent: alerts.attendanceRisk.count > 0,
    },
    {
      title: 'University Mail',
      count: data.mail?.university ?? 0,
      sub: 'New circular received',
      href: '/principal-desk/communication-hub',
      urgent: (data.mail?.university ?? 0) > 0,
    },
  ].filter((i) => i.count > 0 || i.title === 'Leave Requests');

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionTitle title="Critical Alerts" subtitle="Items that need principal attention" />
        <Link
          href="/principal-desk/leave"
          className="shrink-0 text-xs font-semibold text-indigo-600 hover:underline"
        >
          View all alerts
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className={cn(
              'min-w-[180px] flex-1 rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-card',
              item.urgent
                ? 'border-rose-200 dark:border-rose-900/40'
                : 'border-slate-200/80 dark:border-border',
            )}
          >
            <p
              className={cn(
                'text-2xl font-bold tabular-nums',
                item.urgent ? 'text-rose-600' : 'text-slate-900 dark:text-foreground',
              )}
            >
              <AnimatedCounter value={item.count} />
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-foreground">
              {item.title}
            </p>
            <p className="text-[11px] text-slate-500">{item.sub}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function KpiCards({ data }: { data: PrincipalDeskDashboard }) {
  const k = data.executiveKpis;
  const cards = [
    {
      label: 'Students On Campus',
      value: k?.studentsOnCampus ?? data.snapshot.studentsPresentToday,
      sub: `of ${data.institution.studentCount.toLocaleString('en-IN')} enrolled`,
      icon: Users,
    },
    {
      label: 'Staff On Duty',
      value: k?.staffOnDuty ?? data.snapshot.staffPresentToday,
      sub: `${data.snapshot.staffAbsentToday} absent today`,
      icon: Users,
    },
    {
      label: 'Admissions Today',
      value: k?.admissionsToday ?? 0,
      sub: 'Pending verification',
      icon: Megaphone,
    },
    {
      label: 'Fee Collection Today',
      value: k?.feeCollectionToday ?? data.finance.todayCollection,
      sub: 'Collected today',
      icon: Wallet,
      money: true,
    },
    {
      label: 'Pending Approvals',
      value: k?.pendingApprovals ?? data.snapshot.leaveRequestsPending,
      sub: 'Require your action',
      icon: ClipboardCheck,
    },
    {
      label: 'Unread Emails',
      value: k?.unreadEmails ?? data.mail?.unread ?? 0,
      sub: 'In Mail Center',
      icon: Mail,
    },
  ];

  return (
    <section>
      <SectionTitle title="Key Performance" subtitle="Campus pulse at a glance" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <SaaSCard key={card.label} className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40">
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-foreground">
                {card.money ? money(card.value) : <AnimatedCounter value={card.value} />}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-foreground">
                {card.label}
              </p>
              <p className="text-[11px] text-slate-500">{card.sub}</p>
            </SaaSCard>
          );
        })}
      </div>
    </section>
  );
}

function TodaysSchedule({ data }: { data: PrincipalDeskDashboard }) {
  const items =
    data.eventBoard?.items?.filter((i) => i.dayGroup === 'Today').slice(0, 5) ??
    data.eventTimeline.filter((i) => i.dayGroup === 'Today').slice(0, 5);

  return (
    <SaaSCard className="h-full">
      <SectionTitle
        title="Today's Schedule"
        subtitle="Meetings and campus events"
        action={
          <Link href="/principal-desk/events" className="text-xs font-semibold text-indigo-600">
            View all
          </Link>
        }
      />
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No events scheduled for today.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item, idx) => {
            const title = 'title' in item ? String(item.title) : String(item.label);
            const time = item.time || '—';
            return (
              <li key={`${title}-${idx}`} className="flex gap-3">
                <div className="flex w-16 shrink-0 flex-col items-center">
                  <span className="text-xs font-semibold text-indigo-600">{time}</span>
                  {idx < items.length - 1 ? (
                    <span className="mt-1 h-full w-px flex-1 bg-slate-200" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2 dark:bg-muted/40">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-foreground">
                    {title}
                  </p>
                  {'venue' in item && item.venue ? (
                    <p className="truncate text-[11px] text-slate-500">{String(item.venue)}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SaaSCard>
  );
}

function CommitteePanel({ data }: { data: PrincipalDeskDashboard }) {
  const rows = data.committeeActivity.slice(0, 6);
  return (
    <SaaSCard className="h-full">
      <SectionTitle
        title="Committee Activity"
        subtitle="Pending tasks by committee"
        action={
          <Link href="/principal-desk/committees" className="text-xs font-semibold text-indigo-600">
            Open
          </Link>
        }
      />
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">No active committee tasks.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-indigo-500" />
                <Link href={row.href} className="truncate text-sm font-medium hover:underline">
                  {row.name}
                </Link>
              </div>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  row.pending > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700',
                )}
              >
                {row.pending > 0 ? `${row.pending} Pending` : 'Completed'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SaaSCard>
  );
}

function UpcomingDeadlines({ data }: { data: PrincipalDeskDashboard }) {
  const deadlines = [
    data.criticalAlerts.leavePending.count > 0
      ? {
          label: 'Staff Leave Approval',
          when: 'Today',
          href: '/principal-desk/leave',
          urgent: true,
        }
      : null,
    data.finance.pendingDues > 0
      ? {
          label: 'Fee Collection Follow-up',
          when: 'This week',
          href: '/principal-desk/fees',
          urgent: data.finance.defaulters > 0,
        }
      : null,
    ...data.upcomingEvents.slice(0, 3).map((e) => ({
      label: e.label,
      when: e.date,
      href: e.href ?? '/principal-desk/events',
      urgent: false,
    })),
  ].filter(Boolean) as Array<{
    label: string;
    when: string;
    href: string;
    urgent: boolean;
  }>;

  return (
    <SaaSCard className="h-full">
      <SectionTitle title="Upcoming Deadlines" subtitle="Time-sensitive actions" />
      {deadlines.length === 0 ? (
        <p className="text-sm text-slate-500">No upcoming deadlines.</p>
      ) : (
        <ul className="space-y-2">
          {deadlines.slice(0, 5).map((d) => (
            <li key={`${d.label}-${d.when}`}>
              <Link
                href={d.href}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5 hover:bg-slate-50 dark:border-border dark:hover:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{d.label}</span>
                  <span className="text-[11px] text-slate-500">{d.when}</span>
                </span>
                <ArrowRight
                  className={cn('h-4 w-4 shrink-0', d.urgent ? 'text-rose-500' : 'text-slate-400')}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SaaSCard>
  );
}

function FeeOverview({ data }: { data: PrincipalDeskDashboard }) {
  const rate = Math.min(
    100,
    Math.max(0, data.pulse.collectionRate || data.finance.collectionRate || 0),
  );
  const month = data.finance.monthCollection ?? 0;
  const target = rate > 0 ? Math.round(month / (rate / 100)) : Math.max(month, 1);

  return (
    <SaaSCard className="h-full">
      <SectionTitle
        title="Fee Collection Overview"
        subtitle="Progress toward monthly target"
        action={
          <Link href="/principal-desk/fees" className="text-xs font-semibold text-indigo-600">
            Fee Monitor
          </Link>
        }
      />
      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-3xl font-bold tabular-nums text-indigo-700">{rate.toFixed(1)}%</p>
          <p className="text-xs text-slate-500">Target {formatLakhs(target)}</p>
        </div>
        <Wallet className="h-8 w-8 text-indigo-200" />
      </div>
      <div className="mb-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-muted">
        <div
          className="h-full rounded-full bg-indigo-600 transition-all"
          style={{ width: `${rate}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {[
          { label: 'Today', value: money(data.finance.todayCollection) },
          {
            label: 'Month',
            value: formatLakhs(month),
          },
          {
            label: 'Outstanding',
            value: formatLakhs(data.finance.pendingDues),
          },
          {
            label: 'Defaulters',
            value: String(data.finance.defaulters),
          },
        ].map((cell) => (
          <div key={cell.label} className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-muted/40">
            <p className="text-sm font-semibold tabular-nums">{cell.value}</p>
            <p className="text-[10px] text-slate-500">{cell.label}</p>
          </div>
        ))}
      </div>
    </SaaSCard>
  );
}

function AttendanceOverview({ data }: { data: PrincipalDeskDashboard }) {
  const studentPct = data.academic.studentAttendancePct || data.operations.studentPresentPct;
  const staffPct = data.academic.facultyAttendancePct || data.operations.facultyPresentPct;

  return (
    <SaaSCard className="h-full">
      <SectionTitle
        title="Attendance Overview"
        subtitle="Students and staff present today"
        action={
          <Link href="/principal-desk/attendance" className="text-xs font-semibold text-indigo-600">
            Details
          </Link>
        }
      />
      <div className="flex flex-wrap items-center justify-around gap-4 py-2">
        <CircularProgress
          value={studentPct}
          size={108}
          stroke={10}
          label={`Student ${studentPct.toFixed(0)}%`}
          sublabel={`${data.academic.studentsAbsent} absent`}
        />
        <CircularProgress
          value={staffPct}
          size={108}
          stroke={10}
          label={`Staff ${staffPct.toFixed(0)}%`}
          sublabel={`${data.academic.facultyAbsent} absent`}
        />
      </div>
    </SaaSCard>
  );
}

function RecentNotifications({ data }: { data: PrincipalDeskDashboard }) {
  const items = useMemo(() => {
    const fromAnnouncements = data.announcements.slice(0, 4).map((a) => ({
      title: a.title,
      date: a.date,
      href: a.href ?? '/principal-desk/notices',
    }));
    if (fromAnnouncements.length) return fromAnnouncements;
    return data.intelligenceSummary.bullets.slice(0, 4).map((b, i) => ({
      title: b,
      date: data.greeting.dateLabel,
      href: i === 0 ? '/principal-desk/fees' : '/principal-desk/notices',
    }));
  }, [data]);

  return (
    <SaaSCard className="h-full">
      <SectionTitle
        title="Recent Notifications"
        subtitle="Campus activity feed"
        action={
          <Link href="/principal-desk/notices" className="text-xs font-semibold text-indigo-600">
            Notices
          </Link>
        }
      />
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No recent notifications.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={`${item.title}-${idx}`}>
              <Link
                href={item.href}
                className="block rounded-xl border border-slate-100 px-3 py-2.5 hover:bg-slate-50 dark:border-border dark:hover:bg-muted/40"
              >
                <p className="line-clamp-2 text-sm font-medium text-slate-800 dark:text-foreground">
                  {item.title}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">{item.date}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SaaSCard>
  );
}

function CampusOperations({ data }: { data: PrincipalDeskDashboard }) {
  return (
    <SaaSCard>
      <SectionTitle title="Campus Operations" subtitle="Classes and library activity today" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Classes Completed',
            value: data.academic.classesCompleted,
            href: '/principal-desk/academic',
          },
          {
            label: 'Classes Pending',
            value: data.academic.classesPending,
            href: '/principal-desk/academic',
          },
          {
            label: 'Library Issued',
            value: data.operations.library.issuedToday,
            href: '/principal-desk/health',
          },
          {
            label: 'Library Overdue',
            value: data.operations.library.overdueBooks,
            href: '/principal-desk/health',
          },
        ].map((cell) => (
          <Link
            key={cell.label}
            href={cell.href}
            className="rounded-xl bg-slate-50 px-3 py-3 text-center hover:bg-indigo-50 dark:bg-muted/40"
          >
            <p className="text-xl font-bold tabular-nums">
              <AnimatedCounter value={cell.value} />
            </p>
            <p className="text-[11px] text-slate-500">{cell.label}</p>
          </Link>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/principal-desk/leave"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Approve Leave
        </Link>
        <Link
          href="/principal-desk/attendance"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-border dark:bg-card"
        >
          <ClipboardCheck className="h-3.5 w-3.5" />
          Attendance
        </Link>
        <Link
          href="/principal-desk/fees"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-border dark:bg-card"
        >
          <Wallet className="h-3.5 w-3.5" />
          Fee Monitor
        </Link>
      </div>
    </SaaSCard>
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

  return (
    <div className="pb-24">
      <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6">
        {isLoading || !data ? (
          <div className="space-y-4">
            <div className="h-20 animate-pulse rounded-2xl bg-slate-200/60" />
            <div className="h-28 animate-pulse rounded-2xl bg-slate-200/50" />
            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-200/40" />
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
              <ExecutiveHeader data={data} institutionName={institutionName} />
            </motion.div>
            <motion.div variants={fadeUp}>
              <CriticalAlertsStrip data={data} />
            </motion.div>
            <motion.div variants={fadeUp}>
              <KpiCards data={data} />
            </motion.div>
            <motion.div variants={fadeUp} className="grid gap-4 lg:grid-cols-3">
              <TodaysSchedule data={data} />
              <CommitteePanel data={data} />
              <UpcomingDeadlines data={data} />
            </motion.div>
            <motion.div variants={fadeUp} className="grid gap-4 lg:grid-cols-3">
              <FeeOverview data={data} />
              <AttendanceOverview data={data} />
              <RecentNotifications data={data} />
            </motion.div>
            <motion.div variants={fadeUp}>
              <CampusOperations data={data} />
            </motion.div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
