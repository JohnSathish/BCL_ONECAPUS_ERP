'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  archiveNotification,
  dismissNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/communication';

export function NotificationsInbox() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all');

  const notifications = useQuery({
    queryKey: ['communication', 'notifications', filter],
    queryFn: () => fetchNotifications(50, filter),
    enabled,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['communication'] });

  const markRead = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidate });
  const dismiss = useMutation({ mutationFn: dismissNotification, onSuccess: invalidate });
  const archive = useMutation({ mutationFn: archiveNotification, onSuccess: invalidate });
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: invalidate });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(['all', 'unread', 'archived'] as const).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? 'default' : 'outline'}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
        <Button size="sm" variant="outline" onClick={() => markAll.mutate()}>
          Mark all read
        </Button>
      </div>
      <div className="space-y-2">
        {(notifications.data ?? []).map((n) => (
          <div key={n.id} className="rounded-xl border border-border/80 bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                  {!n.readAt ? ' · Unread' : ''}
                </p>
              </div>
              <div className="flex gap-1">
                {!n.readAt ? (
                  <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)}>
                    Read
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => dismiss.mutate(n.id)}>
                  Dismiss
                </Button>
                <Button size="sm" variant="ghost" onClick={() => archive.mutate(n.id)}>
                  Archive
                </Button>
              </div>
            </div>
          </div>
        ))}
        {!notifications.data?.length ? (
          <p className="text-sm text-muted-foreground">No notifications.</p>
        ) : null}
      </div>
    </div>
  );
}
