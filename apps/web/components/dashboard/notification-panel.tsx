'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { sanitizeNotificationLink } from '@/lib/permissions/portal-access';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/communication';
import { cn } from '@/utils/cn';

function formatTime(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString();
}

export function NotificationPanel() {
  const authReady = useAuthQueryEnabled();
  const { session } = useAuth();
  const router = useRouter();
  const roles = session?.user.roles ?? [];
  const queryClient = useQueryClient();

  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: fetchUnreadNotificationCount,
    enabled: authReady,
    refetchInterval: 60_000,
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => fetchNotifications(20),
    enabled: authReady,
  });

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const unread = unreadQuery.data?.count ?? 0;
  const notifications = notificationsQuery.data ?? [];

  const handleNotificationClick = (notification: {
    id: string;
    readAt?: string | null;
    link?: string | null;
  }) => {
    if (!notification.readAt) markRead.mutate(notification.id);
    const safeLink = sanitizeNotificationLink(roles, notification.link);
    if (safeLink) router.push(safeLink);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-xl border border-border/80 bg-card/80 p-2.5 backdrop-blur transition hover:bg-muted/50"
          aria-label={`Notifications, ${unread} unread`}
        >
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0 text-base">Notifications</DropdownMenuLabel>
          {unread > 0 ? (
            <button
              type="button"
              className="text-xs text-primary hover:underline"
              onClick={() => markAll.mutate()}
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-72">
          <div className="space-y-1 p-2">
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex cursor-pointer flex-col items-start gap-1 rounded-xl p-3"
                onClick={() => handleNotificationClick(n)}
              >
                <div className="w-full">
                  <NotificationRow notification={n} />
                </div>
              </DropdownMenuItem>
            ))}
            {!notifications.length ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No notifications yet
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({
  notification: n,
}: {
  notification: { title: string; body: string; readAt?: string | null; createdAt: string };
}) {
  return (
    <>
      <div className="flex w-full items-start justify-between gap-2">
        <p className={cn('text-sm font-medium', !n.readAt && 'text-foreground')}>{n.title}</p>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatTime(n.createdAt)}
        </span>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
    </>
  );
}
