'use client';

import Link from 'next/link';
import type { StudentDashboardView, StudentPortalNotification } from '@/types/student-portal';
import type { PortalCalendarEvent } from '@/utils/portal-calendar';

function dateParts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: '—', mon: '' };
  return {
    day: d.toLocaleDateString(undefined, { day: '2-digit' }),
    mon: d.toLocaleDateString(undefined, { month: 'short' }),
  };
}

function shortDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

export function StudentAnnouncementsCard({
  notifications,
  unreadCount,
  loading,
}: {
  notifications?: StudentPortalNotification[];
  unreadCount?: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="mt-3 h-28 rounded bg-muted" />
      </div>
    );
  }

  const items = (notifications ?? []).slice(0, 5);

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Announcements</h3>
        <Link
          href="/student/notifications"
          className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300"
        >
          {unreadCount ? `${unreadCount} unread` : 'View all'}
        </Link>
      </div>
      {!items.length ? (
        <p className="mt-4 text-sm text-slate-500">No announcements yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((n) => {
            const { day, mon } = dateParts(n.createdAt);
            return (
              <li key={n.id} className="flex gap-3">
                <div className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-b from-sky-50 to-indigo-50 text-center dark:from-sky-950/40 dark:to-indigo-950/30">
                  <span className="text-sm font-bold leading-none text-slate-800 dark:text-slate-100">
                    {day}
                  </span>
                  <span className="mt-0.5 text-[10px] font-semibold uppercase text-slate-500">
                    {mon}
                  </span>
                </div>
                <div className="min-w-0 flex-1 py-0.5">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-800 dark:text-slate-100">
                    {n.title}
                  </p>
                  {n.body ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{n.body}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function StudentLatestUpdatesCard({
  notifications,
  calendarEvents,
  loading,
}: {
  notifications?: StudentPortalNotification[];
  calendarEvents?: PortalCalendarEvent[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-5 w-36 rounded bg-muted" />
        <div className="mt-3 h-28 rounded bg-muted" />
      </div>
    );
  }

  const fromNotes = (notifications ?? []).slice(0, 4).map((n) => ({
    id: n.id,
    title: n.title,
    when: shortDate(n.createdAt),
  }));
  const fromCal = (calendarEvents ?? []).slice(0, 4).map((ev, i) => ({
    id: `cal-${ev.id ?? i}`,
    title: ev.title || 'Campus update',
    when: ev.date ? shortDate(ev.date) : '',
  }));
  const items = (fromNotes.length ? fromNotes : fromCal).slice(0, 5);

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Latest Updates</h3>
        <Link
          href="/student/notifications"
          className="text-xs font-semibold text-sky-700 hover:underline dark:text-sky-300"
        >
          More
        </Link>
      </div>
      {!items.length ? (
        <p className="mt-4 text-sm text-slate-500">No recent updates.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3">
              <span className="flex min-w-0 items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
                <span className="line-clamp-2 leading-snug">{item.title}</span>
              </span>
              {item.when ? (
                <span className="shrink-0 text-[11px] font-medium text-slate-400">{item.when}</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StudentRemindersCard({
  data,
  calendarEvents,
  loading,
}: {
  data?: StudentDashboardView;
  calendarEvents?: PortalCalendarEvent[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="animate-pulse rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-5 w-36 rounded bg-muted" />
        <div className="mt-3 h-24 rounded bg-muted" />
      </div>
    );
  }

  const reminders: Array<{ title: string; when: string; href: string }> = [];

  if (data?.fees?.status === 'PENDING') {
    reminders.push({
      title: 'Fee payment pending',
      when: data.fees.semesterLabel || 'Due soon',
      href: '/student/fees',
    });
  }
  if (data?.lms && data.lms.pendingAssignments > 0) {
    reminders.push({
      title: `${data.lms.pendingAssignments} assignment(s) pending`,
      when: 'LMS',
      href: '/student/lms',
    });
  }
  if (data?.examinations?.hasAdmitCard === false) {
    reminders.push({
      title: 'Check hall ticket / admit card',
      when: 'Examinations',
      href: '/student/examinations',
    });
  }
  for (const ev of (calendarEvents ?? []).slice(0, 3)) {
    reminders.push({
      title: ev.title || 'Calendar event',
      when: ev.date ? new Date(ev.date).toLocaleDateString() : 'Upcoming',
      href: '/student/calendar',
    });
  }

  const unique = reminders.slice(0, 5);

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Upcoming Reminders</h3>
      {!unique.length ? (
        <p className="mt-4 text-sm text-slate-500">You&apos;re all caught up.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {unique.map((r, i) => (
            <li key={`${r.title}-${i}`}>
              <Link
                href={r.href}
                className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 hover:bg-sky-50 dark:bg-slate-800/50 dark:hover:bg-sky-950/30"
              >
                <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {r.title}
                </span>
                <span className="shrink-0 text-[10px] font-medium text-slate-400">{r.when}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
