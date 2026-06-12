'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import type { StaffPortalNotification } from '@/types/staff-portal';
import { cn } from '@/utils/cn';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationsPanel({
  notifications,
  unreadCount,
  loading,
  compact,
}: {
  notifications?: StaffPortalNotification[];
  unreadCount?: number;
  loading?: boolean;
  compact?: boolean;
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

  const items = compact ? notifications?.slice(0, 4) : notifications;

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Bell className="h-4 w-4" />
          Notifications
          {(unreadCount ?? 0) > 0 ? (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
              {unreadCount}
            </span>
          ) : null}
        </h3>
        <Link href="/staff/notifications" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      <ul className="mt-4 space-y-2">
        {!items?.length ? (
          <li className="text-sm text-muted-foreground">No notifications.</li>
        ) : (
          items.map((n) => (
            <li
              key={n.id}
              className={cn(
                'rounded-lg border border-border/40 px-3 py-2 text-sm',
                !n.read && 'bg-primary/5 border-primary/20',
              )}
            >
              <p className="font-medium">{n.title}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
            </li>
          ))
        )}
      </ul>
    </GlassCard>
  );
}
