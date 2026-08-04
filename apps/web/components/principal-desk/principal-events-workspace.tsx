'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Banknote,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  GraduationCap,
  MapPin,
  PartyPopper,
  Users,
  UsersRound,
} from 'lucide-react';
import { money } from '@/components/dashboard/command-center-ui';
import type { PrincipalDeskDashboard } from '@/types/principal-desk';
import { cn } from '@/utils/cn';
import { formatDisplayDateTime } from '@/utils/format-date';

const CATEGORY_STYLE: Record<
  string,
  { badge: string; rail: string; iconBg: string; Icon: typeof Users }
> = {
  MEETING: {
    badge: 'bg-violet-50 text-violet-700 ring-violet-200',
    rail: 'bg-violet-500',
    iconBg: 'bg-violet-50 text-violet-600',
    Icon: UsersRound,
  },
  ACADEMIC: {
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    rail: 'bg-sky-500',
    iconBg: 'bg-sky-50 text-sky-600',
    Icon: GraduationCap,
  },
  CULTURAL: {
    badge: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200',
    rail: 'bg-fuchsia-500',
    iconBg: 'bg-fuchsia-50 text-fuchsia-600',
    Icon: PartyPopper,
  },
  HOLIDAY: {
    badge: 'bg-amber-50 text-amber-800 ring-amber-200',
    rail: 'bg-amber-500',
    iconBg: 'bg-amber-50 text-amber-700',
    Icon: CalendarDays,
  },
  FINANCE: {
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    rail: 'bg-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-600',
    Icon: Banknote,
  },
};

function categoryStyle(category: string) {
  return CATEGORY_STYLE[category] ?? CATEGORY_STYLE.ACADEMIC;
}

function timeAgoLabel(date: string) {
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return date;
  const mins = Math.round((Date.now() - t) / 60_000);
  if (mins < 60) return `${Math.max(1, mins)} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} hours ago`;
  return formatDisplayDateTime(date);
}

export function PrincipalEventsWorkspace({
  data,
  isLoading,
}: {
  data?: PrincipalDeskDashboard;
  isLoading?: boolean;
}) {
  const board = data?.eventBoard;
  const items = board?.items ?? [];
  const stats = board?.stats ?? { today: 0, thisWeek: 0, meetings: 0, holidays: 0 };

  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const list = map.get(item.dayGroup) ?? [];
      list.push(item);
      map.set(item.dayGroup, list);
    }
    return [...map.entries()];
  }, [items]);

  const deadlines = (data?.actions ?? [])
    .filter((a) => a.priority === 'critical' || a.priority === 'high')
    .slice(0, 5);
  const announcements = (data?.announcements ?? []).slice(0, 5);
  const committees = (data?.committeeActivity ?? []).slice(0, 6);

  if (isLoading && !data) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
        <div className="h-[520px] animate-pulse rounded-2xl bg-slate-100" />
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.9fr)]">
      {/* Left: Upcoming Events */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-border/60 dark:bg-card">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <CalendarDays className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-900 dark:text-foreground">
                Upcoming Events
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Stay on top of important events and meetings.
            </p>
          </div>
          <Link
            href="/admin/academic-calendar"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-border dark:bg-card dark:text-foreground"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            View Calendar
          </Link>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            {
              label: 'Today',
              value: `${stats.today} Events`,
              tint: 'from-violet-50 to-white text-violet-700',
            },
            {
              label: 'This Week',
              value: `${stats.thisWeek} Events`,
              tint: 'from-sky-50 to-white text-sky-700',
            },
            {
              label: 'Meetings',
              value: `${stats.meetings} Scheduled`,
              tint: 'from-emerald-50 to-white text-emerald-700',
            },
            {
              label: 'Holidays',
              value: `${stats.holidays} This Month`,
              tint: 'from-amber-50 to-white text-amber-800',
            },
          ].map((s) => (
            <div
              key={s.label}
              className={cn(
                'rounded-xl border border-slate-100 bg-gradient-to-b px-3 py-3 dark:border-border/50 dark:from-muted/40 dark:to-card',
                s.tint,
              )}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{s.label}</p>
              <p className="mt-1 text-sm font-bold tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>

        {grouped.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
            No upcoming calendar events. Add events in Academic Calendar to populate this board.
          </p>
        ) : (
          <div className="space-y-6">
            {grouped.map(([day, dayItems]) => (
              <div key={day}>
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  {day}
                </p>
                <ul className="relative space-y-3 border-l border-slate-200 pl-5 dark:border-border">
                  {dayItems.map((item) => {
                    const style = categoryStyle(item.category);
                    const Icon = style.Icon;
                    return (
                      <li key={item.id} className="relative">
                        <span
                          className={cn(
                            'absolute -left-[23px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-white dark:ring-card',
                            style.rail,
                          )}
                        />
                        <Link
                          href={item.href ?? '/principal-desk/events'}
                          className="group flex gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition hover:border-indigo-200 hover:bg-white hover:shadow-sm dark:border-border/60 dark:bg-muted/20"
                        >
                          <div className="w-14 shrink-0 pt-1 text-right">
                            <p className="font-mono text-[11px] font-semibold text-slate-500">
                              {item.time}
                            </p>
                          </div>
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                              style.iconBg,
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-bold text-slate-900 dark:text-foreground">
                                {item.title}
                              </p>
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1',
                                  style.badge,
                                )}
                              >
                                {item.category}
                              </span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                              {item.venue ? (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {item.venue}
                                </span>
                              ) : null}
                              {item.organizer ? (
                                <span className="inline-flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {item.organizer}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                item.countdown === 'Now' || item.countdown === 'Started'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-emerald-50 text-emerald-700',
                              )}
                            >
                              {item.countdown}
                            </span>
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-500" />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-slate-100 pt-3 dark:border-border/50">
          <Link
            href="/admin/academic-calendar"
            className="text-sm font-semibold text-indigo-600 hover:underline"
          >
            View all events →
          </Link>
        </div>
      </section>

      {/* Right rail */}
      <aside className="space-y-4">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-border/60 dark:bg-card">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-foreground">
              Committee Activity
            </h3>
            <Link
              href="/principal-desk/committees"
              className="text-[11px] font-semibold text-indigo-600 hover:underline"
            >
              View all
            </Link>
          </div>
          {committees.length === 0 ? (
            <p className="text-xs text-slate-500">No active committee tasks.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {committees.map((c) => (
                <Link
                  key={c.id}
                  href={c.href || '/principal-desk/committees'}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 hover:border-indigo-200 dark:border-border/50 dark:bg-muted/20"
                >
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-foreground">
                    {c.name}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {c.pending > 0 ? (
                      <span className="font-semibold text-amber-700">{c.pending} pending</span>
                    ) : (
                      <span className="text-emerald-600">Clear</span>
                    )}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-border/60 dark:bg-card">
          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-foreground">
            Quick Overview
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: 'Urgent Approvals',
                value: String(data?.pulse?.urgentActions ?? 0),
                href: '/principal-desk/leave',
                icon: ClipboardList,
                tint: 'text-rose-600 bg-rose-50',
              },
              {
                label: 'Leave Requests',
                value: String(data?.snapshot?.leaveRequestsPending ?? 0),
                href: '/principal-desk/leave',
                icon: Users,
                tint: 'text-amber-700 bg-amber-50',
              },
              {
                label: 'Staff Absent',
                value: String(data?.criticalAlerts?.staffAbsentToday?.count ?? 0),
                href: '/principal-desk/staff',
                icon: UsersRound,
                tint: 'text-sky-700 bg-sky-50',
              },
              {
                label: 'Fee Collection Today',
                value: money(data?.finance?.todayCollection ?? 0),
                href: '/principal-desk/fees',
                icon: Banknote,
                tint: 'text-emerald-700 bg-emerald-50',
              },
            ].map((kpi) => (
              <Link
                key={kpi.label}
                href={kpi.href}
                className="rounded-xl border border-slate-100 p-3 hover:border-indigo-200 dark:border-border/50"
              >
                <span
                  className={cn(
                    'mb-2 inline-flex h-7 w-7 items-center justify-center rounded-lg',
                    kpi.tint,
                  )}
                >
                  <kpi.icon className="h-3.5 w-3.5" />
                </span>
                <p className="text-base font-bold tabular-nums text-slate-900 dark:text-foreground">
                  {kpi.value}
                </p>
                <p className="text-[11px] text-slate-500">{kpi.label}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-border/60 dark:bg-card">
          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-foreground">
            Upcoming Deadlines
          </h3>
          {deadlines.length === 0 ? (
            <p className="text-xs text-slate-500">No urgent deadlines flagged.</p>
          ) : (
            <ul className="space-y-2">
              {deadlines.map((d) => (
                <li key={d.id}>
                  <Link
                    href={d.href || '/principal-desk'}
                    className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 hover:border-indigo-200 dark:border-border/50"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-800 dark:text-foreground">
                        {d.message}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                        {d.priority} priority
                        {d.count != null ? ` · ${d.count}` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        d.priority === 'critical'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700',
                      )}
                    >
                      Due soon
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-border/60 dark:bg-card">
          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-foreground">
            Recent Announcements
          </h3>
          {announcements.length === 0 ? (
            <p className="text-xs text-slate-500">No recent announcements.</p>
          ) : (
            <ul className="space-y-2">
              {announcements.map((a, i) => (
                <li
                  key={`${a.title}-${i}`}
                  className="flex gap-2 border-b border-slate-50 pb-2 last:border-0 dark:border-border/40"
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      i === 0 ? 'bg-rose-500' : i === 1 ? 'bg-amber-500' : 'bg-sky-500',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    {a.href ? (
                      <Link
                        href={a.href}
                        className="text-xs font-semibold text-slate-800 hover:text-indigo-600 dark:text-foreground"
                      >
                        {a.title}
                      </Link>
                    ) : (
                      <p className="text-xs font-semibold text-slate-800 dark:text-foreground">
                        {a.title}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400">{timeAgoLabel(a.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
