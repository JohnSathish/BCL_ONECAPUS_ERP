'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, CheckCheck, ExternalLink, FileText, ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useAuthQueryEnabled } from '@/hooks/use-auth';
import { getNotificationAttachments } from '@/lib/notification-attachments';
import { sanitizeNotificationLink } from '@/lib/permissions/portal-access';
import {
  archiveNotification,
  dismissNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/communication';
import type { UserNotification } from '@/types/communication';
import { cn } from '@/utils/cn';

type Filter = 'all' | 'unread' | 'archived';

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function NotificationsCenter({
  initialId,
  inboxPath,
}: {
  initialId?: string | null;
  /** Used for deep links from the header bell */
  inboxPath: string;
}) {
  const enabled = useAuthQueryEnabled();
  const { session } = useAuth();
  const roles = session?.user.roles ?? [];
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);

  const listQ = useQuery({
    queryKey: ['notifications', 'inbox', filter],
    queryFn: () => fetchNotifications(100, filter),
    enabled,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['notifications'] });
    void qc.invalidateQueries({ queryKey: ['communication', 'notifications'] });
  };

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: invalidate,
  });
  const dismiss = useMutation({
    mutationFn: dismissNotification,
    onSuccess: () => {
      setSelectedId(null);
      invalidate();
    },
  });
  const archive = useMutation({
    mutationFn: archiveNotification,
    onSuccess: () => {
      setSelectedId(null);
      invalidate();
    },
  });
  const markAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: invalidate,
  });

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = listQ.data ?? [];
    if (!q) return rows;
    return rows.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        (n.body ?? '').toLowerCase().includes(q) ||
        (n.type ?? '').toLowerCase().includes(q),
    );
  }, [listQ.data, query]);

  const selected =
    items.find((n) => n.id === selectedId) ??
    (listQ.data ?? []).find((n) => n.id === selectedId) ??
    null;

  useEffect(() => {
    if (initialId) setSelectedId(initialId);
  }, [initialId]);

  useEffect(() => {
    if (!selected || selected.readAt || markRead.isPending) return;
    markRead.mutate(selected.id);
  }, [selected?.id, selected?.readAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const openLink = selected ? sanitizeNotificationLink(roles, selected.link) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
      <div className="space-y-3 rounded-2xl border border-border/80 bg-card p-3">
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
            <CheckCheck className="mr-1 h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>
        <Input
          placeholder="Search notifications…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-[70vh] space-y-1 overflow-y-auto">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setSelectedId(n.id)}
              className={cn(
                'w-full rounded-xl border px-3 py-2.5 text-left transition',
                selectedId === n.id
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent hover:bg-muted/60',
                !n.readAt && 'bg-muted/40',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={cn('text-sm font-medium', !n.readAt && 'text-foreground')}>
                  {n.title}
                </p>
                {!n.readAt ? (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                ) : null}
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{formatWhen(n.createdAt)}</p>
            </button>
          ))}
          {!items.length && !listQ.isLoading ? (
            <p className="px-2 py-8 text-center text-sm text-muted-foreground">No notifications.</p>
          ) : null}
        </div>
      </div>

      <div className="min-h-[420px] rounded-2xl border border-border/80 bg-card p-5">
        {selected ? (
          <NotificationDetail
            notification={selected}
            openLink={openLink}
            inboxPath={inboxPath}
            onDismiss={() => dismiss.mutate(selected.id)}
            onArchive={() => archive.mutate(selected.id)}
          />
        ) : (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
            <p className="text-sm font-medium">Select a notification</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Open an item from the list to read the full message and view any attached images or
              PDFs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function NotificationDetail({
  notification,
  openLink,
  inboxPath,
  onDismiss,
  onArchive,
}: {
  notification: UserNotification;
  openLink: string | null;
  inboxPath: string;
  onDismiss: () => void;
  onArchive: () => void;
}) {
  const attachments = getNotificationAttachments(notification);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{notification.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatWhen(notification.createdAt)}
            {notification.type ? ` · ${notification.type}` : ''}
            {!notification.readAt ? ' · Unread' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {openLink ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={openLink}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Open related
              </Link>
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onArchive}>
            <Archive className="mr-1 h-3.5 w-3.5" />
            Archive
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            <X className="mr-1 h-3.5 w-3.5" />
            Dismiss
          </Button>
        </div>
      </div>

      <div className="whitespace-pre-wrap rounded-xl border bg-muted/20 p-4 text-sm leading-relaxed">
        {notification.body || 'No message body.'}
      </div>

      {attachments.length ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Attachments
          </p>
          {attachments.map((a) =>
            a.type === 'image' ? (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-xl border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={a.name ?? 'Attachment'}
                  className="max-h-[420px] w-full object-contain bg-muted/30"
                />
              </a>
            ) : (
              <a
                key={a.url}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-xl border px-4 py-3 text-sm hover:bg-muted/40"
              >
                {a.type === 'pdf' ? (
                  <FileText className="h-5 w-5 text-red-600" />
                ) : (
                  <ImageIcon className="h-5 w-5" />
                )}
                <span className="font-medium">
                  {a.name ?? (a.type === 'pdf' ? 'PDF attachment' : 'File')}
                </span>
                <span className="ml-auto text-xs text-primary">Open</span>
              </a>
            ),
          )}
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Tip: bookmark{' '}
        <Link href={inboxPath} className="text-primary underline">
          {inboxPath}
        </Link>{' '}
        to reopen this inbox anytime.
      </p>
    </div>
  );
}
