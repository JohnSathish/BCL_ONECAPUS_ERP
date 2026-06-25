'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  Clock3,
  Loader2,
  Minus,
  RadioTower,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

import {
  fetchAttendanceCommandCenter,
  fetchStaffAttendanceTimeline,
  type AttendanceCommandCenter,
} from '@/services/staff-attendance';
import { cn } from '@/utils/cn';

function formatTime(value?: string | Date | null) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function healthDot(health?: string) {
  if (health === 'excellent') return 'bg-emerald-500';
  if (health === 'good') return 'bg-lime-500';
  if (health === 'warning') return 'bg-amber-500';
  if (health === 'critical') return 'bg-red-500';
  return 'bg-muted-foreground/40';
}

function trendIcon(direction?: string) {
  if (direction === 'up') return <ArrowUpRight className="h-4 w-4 text-emerald-600" />;
  if (direction === 'down') return <ArrowDownRight className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function statusEmoji(status: string) {
  if (['PRESENT', 'LATE', 'OVERTIME', 'EARLY_EXIT'].includes(status)) return '🟢';
  if (status === 'HALF_DAY') return '🟡';
  if (status === 'ABSENT') return '🔴';
  if (status === 'ON_LEAVE') return '🏖';
  if (status === 'HOLIDAY') return '🎉';
  if (status === 'WEEKLY_OFF') return '⚪';
  return '⚪';
}

export function AttendanceCommandCenter() {
  const center = useQuery({
    queryKey: ['staff-attendance', 'command-center'],
    queryFn: fetchAttendanceCommandCenter,
    refetchInterval: 30_000,
  });

  if (center.isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-border/60 bg-card/85">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const data = center.data;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <TodayOverview data={data} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <LiveStatusPanel data={data} />
          <ArrivalTimeline data={data} />
          <DepartmentHeatmap data={data} />
          <MonthlyAnalyticsPanel data={data} />
        </div>
        <div className="space-y-5">
          <DeviceMapPanel data={data} />
          <AiInsightsPanel data={data} />
          <SmartAlertsPanel data={data} />
          <TrendsPanel data={data} />
        </div>
      </div>
      <RecentPunchFeed data={data} />
      <QuickLinks />
    </div>
  );
}

function TodayOverview({ data }: { data: AttendanceCommandCenter }) {
  const cards = [
    { label: 'Present', value: data.today.present, tone: 'success' },
    { label: 'Late', value: data.today.late, tone: 'warning' },
    { label: 'Absent', value: data.today.absent, tone: 'danger' },
    { label: 'On Leave', value: data.today.onLeave, tone: 'neutral' },
    { label: 'WFH', value: data.today.wfh, tone: 'neutral' },
    { label: 'Holiday', value: data.today.holiday, tone: 'neutral' },
  ];
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Today</p>
          <h2 className="text-lg font-semibold">Attendance Command Center</h2>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          Auto refresh 30s
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border/60 bg-background/70 p-4"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p
              className={cn(
                'mt-1 text-2xl font-semibold',
                card.tone === 'success' && 'text-emerald-600',
                card.tone === 'warning' && 'text-amber-700 dark:text-amber-300',
                card.tone === 'danger' && 'text-destructive',
              )}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function LiveStatusPanel({ data }: { data: AttendanceCommandCenter }) {
  const items = [
    {
      label: 'Currently Inside Campus',
      value: data.liveStatus.currentlyInside,
      icon: '🟢',
      tone: 'text-emerald-600',
    },
    {
      label: 'Already Left',
      value: data.liveStatus.alreadyLeft,
      icon: '🔴',
      tone: 'text-red-500',
    },
    {
      label: 'Not Yet Punched',
      value: data.liveStatus.notYetPunched,
      icon: '🟡',
      tone: 'text-amber-700 dark:text-amber-300',
    },
    {
      label: 'Missing OUT Punch',
      value: data.liveStatus.missingOut,
      icon: '⚠',
      tone: 'text-orange-600',
    },
  ];
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
      <h3 className="text-sm font-semibold">Live Status</h3>
      <p className="text-xs text-muted-foreground">
        Active staff roster: {data.liveStatus.activeStaff.toLocaleString()}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-muted/35 p-4">
            <p className="text-xs text-muted-foreground">
              {item.icon} {item.label}
            </p>
            <p className={cn('mt-1 text-2xl font-semibold', item.tone)}>
              {item.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ArrivalTimeline({ data }: { data: AttendanceCommandCenter }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
      <h3 className="text-sm font-semibold">Today&apos;s Arrival Timeline</h3>
      <p className="text-xs text-muted-foreground">Peak IN punch hours across all devices</p>
      <div className="mt-5 space-y-3">
        {data.arrivalTimeline.map((slot) => (
          <div key={slot.hour} className="grid grid-cols-[56px_1fr_40px] items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">{slot.label}</span>
            <div className="h-3 overflow-hidden rounded-full bg-muted/60">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all"
                style={{ width: `${Math.max(slot.intensity, slot.count > 0 ? 8 : 0)}%` }}
              />
            </div>
            <span className="text-right text-xs font-semibold">{slot.count}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function DepartmentHeatmap({ data }: { data: AttendanceCommandCenter }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Department Attendance</h3>
          <p className="text-xs text-muted-foreground">Today&apos;s attendance by department</p>
        </div>
        <Link href="/admin/staff/attendance/reports" className="text-xs font-semibold text-primary">
          Full reports →
        </Link>
      </div>
      <div className="space-y-3">
        {data.departmentHeatmap.length ? (
          data.departmentHeatmap.map((dept, index) => (
            <div
              key={dept.department}
              className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/60 p-3"
            >
              <span className="w-6 text-sm">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
              </span>
              <div className={cn('h-3 w-3 rounded-full', healthDot(dept.health))} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{dept.department}</p>
                <p className="text-xs text-muted-foreground">
                  {dept.present}/{dept.total} present
                </p>
              </div>
              <p className="text-lg font-semibold">{dept.attendancePercent}%</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No department attendance processed for today yet.
          </p>
        )}
      </div>
      {data.weeklyPattern?.length ? (
        <div className="mt-5 border-t border-border/60 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Weekly Pattern (30 days)
          </p>
          <div className="flex flex-wrap gap-2">
            {data.weeklyPattern.map((day) => (
              <div
                key={day.day}
                className="flex min-w-[52px] flex-col items-center rounded-xl bg-muted/35 px-2 py-2"
              >
                <span className="text-[10px] font-semibold">{day.day}</span>
                <span className={cn('mt-1 h-3 w-3 rounded-full', healthDot(day.health))} />
                <span className="mt-1 text-[10px] text-muted-foreground">
                  {day.attendancePercent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MonthlyAnalyticsPanel({ data }: { data: AttendanceCommandCenter }) {
  const metrics = [
    {
      label: 'Attendance',
      value: data.monthlyAnalytics.current.attendancePercent,
      delta: data.monthlyAnalytics.deltas.attendance,
    },
    {
      label: 'Late',
      value: data.monthlyAnalytics.current.latePercent,
      delta: data.monthlyAnalytics.deltas.late,
      invert: true,
    },
    {
      label: 'Leave',
      value: data.monthlyAnalytics.current.leavePercent,
      delta: data.monthlyAnalytics.deltas.leave,
    },
    {
      label: 'Overtime',
      value: data.monthlyAnalytics.current.overtimePercent,
      delta: data.monthlyAnalytics.deltas.overtime,
    },
  ];
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
      <h3 className="text-sm font-semibold">Monthly Analytics</h3>
      <p className="text-xs text-muted-foreground">Current month vs previous month</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl bg-muted/35 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {metric.label}
              </p>
              <span
                className={cn(
                  'text-xs font-semibold',
                  (metric.invert ? metric.delta < 0 : metric.delta > 0)
                    ? 'text-emerald-600'
                    : metric.delta === 0
                      ? 'text-muted-foreground'
                      : 'text-amber-700',
                )}
              >
                {metric.delta > 0 ? '+' : ''}
                {metric.delta}%
              </span>
            </div>
            <p className="mt-2 text-2xl font-semibold">{metric.value}%</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-background/80">
              <div
                className="h-full rounded-full bg-primary/70"
                style={{ width: `${Math.min(metric.value, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DeviceMapPanel({ data }: { data: AttendanceCommandCenter }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Campus Devices</h3>
          <p className="text-xs text-muted-foreground">
            {data.deviceOnline}/{data.devices.length} online
          </p>
        </div>
        <RadioTower className="h-4 w-4 text-primary" />
      </div>
      <div className="space-y-3">
        {data.devices.length ? (
          data.devices.map((device) => (
            <div
              key={device.id}
              className="rounded-2xl border border-border/50 bg-background/60 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{device.name}</p>
                  <p className="text-xs text-muted-foreground">{device.location}</p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                    device.online
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-destructive/10 text-destructive',
                  )}
                >
                  {device.online ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>Punches today: {device.punchesToday}</span>
                <span>Users: {device.userCount}</span>
                <span>Sync: {device.lastSyncLabel}</span>
                <span>Network: {device.networkQuality}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No biometric devices configured.</p>
        )}
      </div>
    </section>
  );
}

function AiInsightsPanel({ data }: { data: AttendanceCommandCenter }) {
  return (
    <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 to-card p-5 shadow-lg shadow-black/5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">AI Insights</h3>
      </div>
      <div className="space-y-3">
        {data.insights.map((insight) => (
          <div
            key={insight.id}
            className="rounded-2xl border border-border/50 bg-background/70 p-3"
          >
            <p className="text-sm font-medium">{insight.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Ask OneCampus AI (Ctrl+K): &quot;Show today&apos;s absentees&quot; or &quot;Which department
        has lowest attendance?&quot;
      </p>
    </section>
  );
}

function SmartAlertsPanel({ data }: { data: AttendanceCommandCenter }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
      <div className="mb-4 flex items-center gap-2">
        <Bell className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold">Smart Alerts</h3>
      </div>
      <div className="space-y-2">
        {data.alerts.length ? (
          data.alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                'rounded-2xl px-3 py-2 text-xs',
                alert.severity === 'critical' && 'bg-destructive/10 text-destructive',
                alert.severity === 'warning' &&
                  'bg-amber-500/10 text-amber-800 dark:text-amber-200',
                alert.severity === 'info' && 'bg-muted/50 text-foreground',
              )}
            >
              <p className="font-semibold">{alert.title}</p>
              <p className="mt-0.5 opacity-80">{alert.action}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No active alerts.</p>
        )}
      </div>
    </section>
  );
}

function TrendsPanel({ data }: { data: AttendanceCommandCenter }) {
  const items = [
    { label: 'Attendance', direction: data.trends.direction.attendance },
    { label: 'Late', direction: data.trends.direction.late },
    { label: 'Leaves', direction: data.trends.direction.leave },
    { label: 'Overtime', direction: data.trends.direction.overtime },
  ];
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">30-Day Trends</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl bg-muted/35 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              {trendIcon(item.direction)}
            </div>
            <p className="mt-1 text-sm font-semibold capitalize">{item.direction}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AttendanceLiveFeed({ compact = false }: { compact?: boolean }) {
  const center = useQuery({
    queryKey: ['staff-attendance', 'command-center'],
    queryFn: fetchAttendanceCommandCenter,
    refetchInterval: 10_000,
  });
  const punches = center.data?.recentPunches ?? [];

  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Live Punch Feed</h2>
          <p className="text-xs text-muted-foreground">Auto updating every 10 seconds</p>
        </div>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
      </div>
      <div className={cn('space-y-0', compact ? 'max-h-[420px] overflow-auto' : '')}>
        {center.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : punches.length ? (
          punches.map((punch, index) => (
            <div key={punch.id}>
              <div className="flex items-start gap-3 py-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{punch.staffName}</p>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase">
                      {punch.direction === 'OUT' ? 'Left Campus' : 'Entered'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatTime(punch.punchTimestamp)} · {punch.deviceName}
                    {punch.location ? ` · ${punch.location}` : ''}
                  </p>
                  {punch.department ? (
                    <p className="text-xs text-muted-foreground">{punch.department}</p>
                  ) : null}
                </div>
              </div>
              {index < punches.length - 1 ? <div className="border-t border-border/60" /> : null}
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">No punches recorded yet.</p>
        )}
      </div>
    </section>
  );
}

function RecentPunchFeed({ data }: { data: AttendanceCommandCenter }) {
  if (!data.recentPunches.length) return null;
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent Activity Snapshot</h3>
        <Link href="/admin/staff/attendance/live" className="text-xs font-semibold text-primary">
          Open live wall →
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.recentPunches.slice(0, 4).map((punch) => (
          <div key={punch.id} className="rounded-2xl bg-muted/35 p-3">
            <p className="text-sm font-medium">{punch.staffName}</p>
            <p className="text-xs text-muted-foreground">
              {formatTime(punch.punchTimestamp)} · {punch.deviceName}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function QuickLinks() {
  const links = [
    ['Biometric Devices', '/admin/staff/attendance/devices', RadioTower],
    ['Live Attendance', '/admin/staff/attendance/live', Users],
    ['Daily Register', '/admin/staff/attendance/daily', Clock3],
    ['Corrections', '/admin/staff/attendance/corrections', AlertTriangle],
    ['Reports', '/admin/staff/attendance/reports', Building2],
    ['Sync Center', '/admin/staff/attendance/sync', TrendingUp],
  ] as const;
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
      <h3 className="text-sm font-semibold">Quick Navigation</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {links.map(([label, href, Icon]) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5"
          >
            <Icon className="h-4 w-4 text-primary" />
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function StaffTimelineCard({
  staffProfileId,
  date,
}: {
  staffProfileId: string;
  date?: string;
}) {
  const timeline = useQuery({
    queryKey: ['staff-attendance', 'timeline', staffProfileId, date],
    queryFn: () => fetchStaffAttendanceTimeline(staffProfileId, date),
    enabled: Boolean(staffProfileId),
  });

  if (timeline.isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  const data = timeline.data;
  if (!data) return null;

  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{data.staff.fullName}</h3>
          <p className="text-xs text-muted-foreground">{data.staff.employeeCode}</p>
        </div>
        {data.score ? (
          <div className="rounded-2xl bg-primary/10 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wide text-primary">Attendance Score</p>
            <p className="text-xl font-semibold">{data.score.score}/100</p>
            <p className="text-xs text-muted-foreground">
              {'★'.repeat(data.score.disciplineStars)}
              {'☆'.repeat(5 - data.score.disciplineStars)}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {data.timeline.map((event) => (
          <div key={event.id} className="flex gap-3">
            <div className="w-14 text-xs font-semibold text-muted-foreground">
              {formatTime(event.time)}
            </div>
            <div className="relative flex-1 border-l border-border pl-4 pb-3">
              <span className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-primary" />
              <p className="text-sm font-medium">{event.label}</p>
              <p className="text-xs text-muted-foreground">
                {[event.deviceName, event.location].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {data.summary ? (
        <div className="mt-2 grid grid-cols-2 gap-3 rounded-2xl bg-muted/35 p-3 text-xs md:grid-cols-4">
          <span>
            Worked: {Math.floor((data.summary.workedMinutes ?? 0) / 60)}h{' '}
            {(data.summary.workedMinutes ?? 0) % 60}m
          </span>
          <span>Late: {data.summary.lateMinutes ?? 0} min</span>
          <span>OT: {data.summary.overtimeMinutes ?? 0} min</span>
          <span>Status: {data.summary.status}</span>
        </div>
      ) : null}

      {data.calendar?.length ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Month Calendar
          </p>
          <div className="flex flex-wrap gap-2">
            {data.calendar.map((day) => (
              <div
                key={String(day.date)}
                className="flex h-10 w-10 flex-col items-center justify-center rounded-xl bg-background/80 text-[10px]"
                title={day.status}
              >
                <span>{new Date(day.date).getDate()}</span>
                <span>{statusEmoji(day.status)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
