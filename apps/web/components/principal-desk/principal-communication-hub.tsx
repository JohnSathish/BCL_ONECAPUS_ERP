'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ChevronDown,
  FileText,
  Inbox,
  Mail,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  Settings,
  Star,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import {
  downloadPrincipalAttachment,
  fetchPrincipalMailboxAccounts,
  fetchPrincipalMessage,
  fetchPrincipalMessages,
  principalMessageAction,
  sendPrincipalMail,
  syncPrincipalMailbox,
  type PrincipalMailboxAccount,
  type PrincipalMailListItem,
  type PrincipalMailMessage,
} from '@/services/principal-comms';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { formatDisplayDateTime } from '@/utils/format-date';
import { extractLinkedFilesFromMailBody, stripLinkedFileMarkup } from '@/utils/mail-body-links';

const FOLDERS = [
  { key: 'INBOX', label: 'Inbox', icon: Inbox },
  { key: 'SENT', label: 'Sent', icon: Send },
  { key: 'DRAFTS', label: 'Drafts', icon: FileText },
  { key: 'STARRED', label: 'Starred', icon: Star },
  { key: 'ARCHIVE', label: 'Archive', icon: Archive },
  { key: 'SPAM', label: 'Spam', icon: Mail },
  { key: 'TRASH', label: 'Trash', icon: Trash2 },
] as const;

const ACTIVE_ACCOUNT_KEY = 'principal-comms-active-account-id';

function hasPrincipalComms(permissions: string[] = []) {
  return permissions.includes('principal-comms:access');
}

function readStoredAccountId() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    return null;
  }
}

function storeAccountId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id) localStorage.setItem(ACTIVE_ACCOUNT_KEY, id);
    else localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  } catch {
    /* ignore quota */
  }
}

function resolveActiveAccountId(accounts: PrincipalMailboxAccount[], preferredId: string | null) {
  const active = accounts.filter((a) => a.status === 'ACTIVE');
  if (!active.length) return null;
  if (preferredId && active.some((a) => a.id === preferredId)) return preferredId;
  return active[0]!.id;
}

export function PrincipalCommunicationHub({
  initialFolder = 'INBOX',
  initialMessageId,
}: {
  initialFolder?: string;
  initialMessageId?: string;
}) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const canAccess = hasPrincipalComms(session?.user?.permissions ?? []);

  const [folder, setFolder] = useState(initialFolder.toUpperCase());
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialMessageId ?? null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [error, setError] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    if (initialMessageId) setSelectedId(initialMessageId);
  }, [initialMessageId]);

  const accountsQuery = useQuery({
    queryKey: ['principal-comms', 'accounts'],
    queryFn: fetchPrincipalMailboxAccounts,
    enabled: canAccess,
  });

  const accounts = useMemo(
    () => (accountsQuery.data ?? []).filter((a) => a.status === 'ACTIVE'),
    [accountsQuery.data],
  );

  useEffect(() => {
    if (!accountsQuery.isSuccess) return;
    const next = resolveActiveAccountId(accounts, readStoredAccountId());
    setAccountId(next);
    storeAccountId(next);
  }, [accounts, accountsQuery.isSuccess]);

  const listQuery = useQuery({
    queryKey: ['principal-comms', 'messages', accountId, folder, q],
    queryFn: () =>
      fetchPrincipalMessages({
        folder,
        q: q || undefined,
        take: 40,
        accountId: accountId ?? undefined,
      }),
    enabled: canAccess && Boolean(accountId),
  });

  const messageQuery = useQuery({
    queryKey: ['principal-comms', 'message', selectedId],
    queryFn: () => fetchPrincipalMessage(selectedId!),
    enabled: canAccess && Boolean(selectedId),
  });

  const syncMut = useMutation({
    mutationFn: () => syncPrincipalMailbox({ accountId: accountId ?? undefined, full: false }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['principal-comms'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const actionMut = useMutation({
    mutationFn: (payload: {
      id: string;
      action: 'star' | 'unstar' | 'archive' | 'trash' | 'markUnread';
    }) => principalMessageAction(payload.id, payload.action),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['principal-comms'] });
    },
    onError: (e) => setError(apiErrorMessage(e)),
  });

  const items = listQuery.data?.items ?? [];
  const message = messageQuery.data;
  const account = accounts.find((a) => a.id === accountId) ?? listQuery.data?.account ?? null;

  function switchAccount(id: string) {
    setAccountId(id);
    storeAccountId(id);
    setSelectedId(null);
    setAccountMenuOpen(false);
    setError('');
  }

  if (!canAccess) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        This private mailbox is available only to the Principal role (
        <code>principal-comms:access</code>).
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <button
            type="button"
            disabled={!accounts.length}
            onClick={() => setAccountMenuOpen((v) => !v)}
            className={cn(
              'inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-left text-sm hover:bg-muted/50',
              !accounts.length && 'opacity-60',
            )}
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0 truncate">
              {account?.googleEmail ?? 'No mailbox connected'}
            </span>
            {account?.unread ? (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                {account.unread}
              </span>
            ) : null}
            {accounts.length > 1 ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : null}
          </button>
          {accountMenuOpen && accounts.length > 0 ? (
            <div className="absolute left-0 z-20 mt-1 w-72 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
              <p className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Switch mailbox
              </p>
              <ul className="max-h-64 overflow-y-auto py-1">
                {accounts.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => switchAccount(a.id)}
                      className={cn(
                        'flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60',
                        a.id === accountId && 'bg-primary/5',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{a.googleEmail}</p>
                        <p className="text-[11px] text-muted-foreground">{a.accountLabel}</p>
                      </div>
                      {(a.unread ?? 0) > 0 ? (
                        <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                          {a.unread}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
              <Link
                href="/principal-desk/communication-hub/settings"
                className="flex items-center gap-2 border-t border-border px-3 py-2.5 text-xs font-medium text-primary hover:bg-muted/40"
                onClick={() => setAccountMenuOpen(false)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add another Google account
              </Link>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={syncMut.isPending || !account}
            onClick={() => {
              setError('');
              syncMut.mutate();
            }}
          >
            <RefreshCw className={cn('mr-1 h-3.5 w-3.5', syncMut.isPending && 'animate-spin')} />
            Sync
          </Button>
          <Button type="button" size="sm" onClick={() => setComposeOpen(true)} disabled={!account}>
            Compose
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href="/principal-desk/communication-hub/settings">
              <Settings className="mr-1 h-3.5 w-3.5" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!account ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">No Google mailbox connected yet.</p>
          <Button asChild className="mt-3" size="sm">
            <Link href="/principal-desk/communication-hub/settings">Connect Google Workspace</Link>
          </Button>
        </div>
      ) : (
        <div className="grid min-h-[60vh] flex-1 grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-[200px_minmax(280px,1fr)_minmax(360px,1.4fr)]">
          <aside className="border-b border-border p-2 lg:border-b-0 lg:border-r">
            {FOLDERS.map((f) => {
              const Icon = f.icon;
              const active = folder === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => {
                    setFolder(f.key);
                    setSelectedId(null);
                  }}
                  className={cn(
                    'mb-0.5 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm',
                    active
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {f.label}
                </button>
              );
            })}
          </aside>

          <section className="flex min-h-[40vh] flex-col border-b border-border lg:border-b-0 lg:border-r">
            <div className="border-b border-border p-2">
              <Input
                placeholder="Search sender, subject…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {listQuery.isLoading ? (
                <p className="p-3 text-xs text-muted-foreground">Loading…</p>
              ) : items.length === 0 ? (
                <p className="p-3 text-xs text-muted-foreground">No messages in this folder.</p>
              ) : (
                items.map((item) => (
                  <MailRow
                    key={item.id}
                    item={item}
                    active={selectedId === item.id}
                    onSelect={() => setSelectedId(item.id)}
                  />
                ))
              )}
            </div>
          </section>

          <section className="flex min-h-[40vh] flex-col">
            {!selectedId ? (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                Select a message to read
              </div>
            ) : messageQuery.isLoading ? (
              <p className="p-4 text-xs text-muted-foreground">Opening…</p>
            ) : message ? (
              <MessagePane
                message={message}
                onAction={(action) => {
                  setError('');
                  actionMut.mutate({ id: message.id, action });
                }}
                onReply={() => setComposeOpen(true)}
              />
            ) : (
              <p className="p-4 text-xs text-destructive">Could not load message.</p>
            )}
          </section>
        </div>
      )}

      {composeOpen && account ? (
        <ComposeModal
          accountId={account.id}
          fromEmail={account.googleEmail}
          replyTo={message ?? null}
          onClose={() => setComposeOpen(false)}
          onSent={async () => {
            setComposeOpen(false);
            await qc.invalidateQueries({ queryKey: ['principal-comms'] });
          }}
        />
      ) : null}
    </div>
  );
}

function MailRow({
  item,
  active,
  onSelect,
}: {
  item: PrincipalMailListItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full border-b border-border/60 px-3 py-2.5 text-left hover:bg-muted/40',
        active && 'bg-primary/5',
        !item.isRead && 'bg-sky-50/50 dark:bg-sky-950/20',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn('truncate text-sm', !item.isRead && 'font-semibold')}>
          {item.fromName || item.fromAddress || 'Unknown'}
        </p>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatDisplayDateTime(item.receivedAt)}
        </span>
      </div>
      <p className={cn('truncate text-xs', !item.isRead ? 'font-medium' : 'text-muted-foreground')}>
        {item.subject || '(no subject)'}
      </p>
      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="truncate">{item.snippet}</span>
        {item.hasAttachment ? <Paperclip className="h-3 w-3 shrink-0" /> : null}
        {item.starred ? <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-500" /> : null}
      </div>
    </button>
  );
}

function MessagePane({
  message,
  onAction,
  onReply,
}: {
  message: PrincipalMailMessage;
  onAction: (action: 'star' | 'unstar' | 'archive' | 'trash' | 'markUnread') => void;
  onReply: () => void;
}) {
  const toList = useMemo(
    () => (Array.isArray(message.toAddresses) ? message.toAddresses : []).join(', '),
    [message.toAddresses],
  );

  const bodySource = useMemo(() => {
    return [message.bodyText, message.bodyHtml, message.snippet].filter(Boolean).join('\n');
  }, [message.bodyHtml, message.bodyText, message.snippet]);

  const linkedFiles = useMemo(() => extractLinkedFilesFromMailBody(bodySource), [bodySource]);

  const plainBody = useMemo(() => {
    const primary =
      message.bodyText?.trim() ||
      (message.bodyHtml
        ? message.bodyHtml
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        : '') ||
      message.snippet ||
      '';
    return stripLinkedFileMarkup(primary);
  }, [message.bodyHtml, message.bodyText, message.snippet]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1 border-b border-border p-2">
        <Button type="button" size="sm" variant="outline" onClick={onReply}>
          Reply
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onAction(message.starred ? 'unstar' : 'star')}
        >
          {message.starred ? 'Unstar' : 'Star'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onAction('archive')}>
          Archive
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onAction('trash')}>
          Trash
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => onAction('markUnread')}>
          Mark unread
        </Button>
      </div>
      <div className="space-y-2 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">{message.subject || '(no subject)'}</h2>
        <p className="text-xs text-muted-foreground">
          From: {message.fromName || message.fromAddress}
          {toList ? ` · To: ${toList}` : ''}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatDisplayDateTime(message.receivedAt)} · {message.category}
        </p>
      </div>
      {message.attachments?.length || linkedFiles.length ? (
        <div className="space-y-2 border-b border-border px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Attachments
          </p>
          <div className="flex flex-wrap gap-2">
            {(message.attachments ?? []).map((a) => (
              <button
                key={a.id}
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-[12px] font-medium hover:border-primary/40 hover:bg-primary/5"
                onClick={async () => {
                  const file = await downloadPrincipalAttachment(a.id);
                  const bin = atob(file.dataBase64Url.replace(/-/g, '+').replace(/_/g, '/'));
                  const bytes = new Uint8Array(bin.length);
                  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
                  const blob = new Blob([bytes], { type: file.mimeType });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = file.filename || a.filename;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                {a.filename}
              </button>
            ))}
            {linkedFiles.map((f) => (
              <a
                key={f.url}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[12px] font-medium text-sky-900 hover:border-sky-400 dark:border-sky-500/30 dark:bg-sky-950/30 dark:text-sky-100"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                {f.label}
                <span className="text-[10px] font-normal opacity-70">Open</span>
              </a>
            ))}
          </div>
        </div>
      ) : null}
      <div className="flex-1 overflow-y-auto px-4 py-3 text-sm">
        {message.bodyHtml ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            // Gmail HTML — principal-only private mailbox
            dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm">
            {plainBody || message.snippet}
          </pre>
        )}
      </div>
    </div>
  );
}

function ComposeModal({
  accountId,
  fromEmail,
  replyTo,
  onClose,
  onSent,
}: {
  accountId: string;
  fromEmail: string;
  replyTo: PrincipalMailMessage | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(replyTo?.fromAddress ?? '');
  const [subject, setSubject] = useState(
    replyTo ? `Re: ${replyTo.subject || ''}`.replace(/^Re: Re:/, 'Re:') : '',
  );
  const [body, setBody] = useState(
    replyTo
      ? `<p></p><hr/><p><em>On ${replyTo.receivedAt}, ${replyTo.fromName || replyTo.fromAddress} wrote:</em></p><blockquote>${replyTo.bodyHtml || replyTo.bodyText || replyTo.snippet}</blockquote>`
      : '<p></p>',
  );
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    setError('');
    try {
      await sendPrincipalMail({
        accountId,
        toAddresses: to
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        subject,
        bodyHtml: body,
        replyToMessageId: replyTo?.id,
      });
      onSent();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-xl rounded-xl border border-border bg-background p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-semibold">{replyTo ? 'Reply' : 'Compose'}</h3>
            <p className="text-[11px] text-muted-foreground">From: {fromEmail}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        {error ? <p className="mb-2 text-xs text-destructive">{error}</p> : null}
        <div className="space-y-2">
          <Input
            placeholder="To (comma-separated)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <Input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <textarea
            className="min-h-[180px] w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={sending || !to.trim()}
              onClick={() => void handleSend()}
            >
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
