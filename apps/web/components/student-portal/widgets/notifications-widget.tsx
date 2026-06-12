'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import type { StudentPortalNotification } from '@/types/student-portal';
import { cn } from '@/utils/cn';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    notice: 'Notice',
    exam: 'Exam',
    fee: 'Fee Reminder',
    attendance: 'Attendance',
    class: 'Class Update',
    lms: 'LMS',
    general: 'Update',
  };
  return map[type] ?? type.replace(/_/g, ' ');
}

function NotificationItem({ n }: { n: StudentPortalNotification }) {
  const inner = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {typeLabel(n.type)}
      </p>
      <p className="font-medium">{n.title}</p>
      <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
    </>
  );

  if (n.link) {
    return (
      <Link
        href={n.link}
        className={cn(
          'block rounded-lg border border-border/40 px-3 py-2 text-sm transition hover:border-primary/30 hover:bg-muted/30',
          !n.read && 'border-primary/20 bg-primary/5',
        )}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border/40 px-3 py-2 text-sm',
        !n.read && 'border-primary/20 bg-primary/5',
      )}
    >
      {inner}
    </div>
  );
}

export function StudentNotificationsWidget({
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
      <GlassCard className="animate-pulse p-5">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="mt-4 space-y-2">
          <div className="h-12 rounded-lg bg-muted" />
          <div className="h-12 rounded-lg bg-muted" />
        </div>
      </GlassCard>
    );
  }

  const items = notifications?.slice(0, 5) ?? [];

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Bell className="h-4 w-4" />
          Notification Center
          {(unreadCount ?? 0) > 0 ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          ) : null}
        </h3>
      </div>
      <ul className="mt-4 space-y-2">
        {!items.length ? (
          <li className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
            You&apos;re all caught up — new notices will appear here.
          </li>
        ) : (
          items.map((n) => (
            <li key={n.id}>
              <NotificationItem n={n} />
            </li>
          ))
        )}
      </ul>
    </GlassCard>
  );
}
