'use client';

import Link from 'next/link';
import type { StudentDashboardView, StudentPortalNotification } from '@/types/student-portal';
import type { PortalCalendarEvent } from '@/utils/portal-calendar';

function relativeTime(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins || 1}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="mt-3 h-24 rounded bg-muted" />
      </div>
    );
  }

  const items = (notifications ?? []).slice(0, 5);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Latest Announcements
        </h3>
        <Link
          href="/student/notifications"
          className="text-xs font-medium text-[#1e4d8c] hover:underline dark:text-sky-300"
        >
          {unreadCount ? `${unreadCount} unread` : 'View all'}
        </Link>
      </div>
      {!items.length ? (
        <p className="mt-4 text-sm text-slate-500">No announcements yet.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {items.map((n) => (
            <li key={n.id} className="flex gap-2">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1e4d8c]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {n.title}
                </p>
                <p className="truncate text-xs text-slate-500">{n.body}</p>
                <p className="text-[10px] text-slate-400">{relativeTime(n.createdAt)}</p>
              </div>
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
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
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
      href: '/student/notifications',
    });
  }

  const unique = reminders.slice(0, 5);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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
