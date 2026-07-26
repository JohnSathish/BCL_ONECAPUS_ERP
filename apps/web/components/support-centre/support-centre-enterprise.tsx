'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSupportRealtime } from '@/hooks/use-support-realtime';
import { useAuth } from '@/hooks/use-auth';
import {
  SUPPORT_CATEGORIES,
  assignSupportChat,
  closeSupportChat,
  convertSupportChatToTicket,
  fetchSupportAiAssist,
  fetchSupportAgents,
  fetchSupportChat,
  fetchSupportChats,
  fetchSupportDashboard,
  fetchSupportDepartments,
  fetchSupportFaqAdmin,
  fetchSupportSettings,
  fetchSupportStudentContext,
  fetchSupportTicket,
  fetchSupportTickets,
  markSupportChatRead,
  retranslateSupportMessage,
  retranslateSupportThread,
  sendSupportChatMessage,
  setSupportAgentPresence,
  transitionSupportTicket,
  commentSupportTicket,
  updateSupportSettings,
  uploadAdminChatFile,
  type SupportChatMessage,
  type SupportChatThread,
} from '@/services/support-centre';
import { cn } from '@/utils/cn';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { apiErrorMessage } from '@/utils/api-error';

type ViewMode = 'workspace' | 'dashboard' | 'tickets' | 'faq' | 'settings';
type InboxBucket = 'all' | 'new' | 'live' | 'tickets' | 'waiting' | 'resolved' | 'mine' | 'dept';

const LANG_OPTIONS = [
  { code: 'ta', label: 'Tamil' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'garo', label: 'Garo' },
  { code: 'khasi', label: 'Khasi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'as', label: 'Assamese' },
] as const;

const BUCKETS: Array<{ id: InboxBucket; label: string; icon: string }> = [
  { id: 'new', label: 'New Chats', icon: '🔴' },
  { id: 'live', label: 'Live Conversations', icon: '💬' },
  { id: 'tickets', label: 'Open Tickets', icon: '🎫' },
  { id: 'waiting', label: 'Waiting for Student', icon: '⏳' },
  { id: 'resolved', label: 'Resolved', icon: '✅' },
  { id: 'mine', label: 'My Assigned', icon: '👤' },
  { id: 'all', label: 'All Conversations', icon: '📥' },
];

function langLabel(code?: string | null) {
  return LANG_OPTIONS.find((l) => l.code === code)?.label ?? code ?? '—';
}

function langFlag(code?: string | null) {
  const map: Record<string, string> = {
    en: '🇬🇧',
    ta: '🇮🇳',
    hi: '🇮🇳',
    garo: '🇮🇳',
    khasi: '🇮🇳',
    bn: '🇧🇩',
    as: '🇮🇳',
  };
  return map[code || ''] || '🌐';
}

function waitLabel(mins?: number) {
  if (mins == null) return '';
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ago`;
}

function priorityClass(p?: string) {
  const v = (p || '').toUpperCase();
  if (v === 'URGENT') return 'bg-rose-600 text-white';
  if (v === 'HIGH') return 'bg-amber-500 text-white';
  if (v === 'LOW') return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
  return 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200';
}

function Avatar({
  name,
  photo,
  size = 'md',
}: {
  name?: string;
  photo?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const dim = size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const url = photo ? resolveUploadAssetUrl(photo) : null;
  const initials = (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={name || 'avatar'}
        className={cn(dim, 'rounded-full object-cover ring-2 ring-white/80 shadow-sm')}
      />
    );
  }
  return (
    <div
      className={cn(
        dim,
        'flex items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-xs font-semibold text-white shadow-sm',
      )}
    >
      {initials || '?'}
    </div>
  );
}

function MessageBubble({
  msg,
  mine,
  threadId,
  preferredLang,
  onRetranslated,
}: {
  msg: SupportChatMessage;
  mine: boolean;
  threadId: string;
  preferredLang: string;
  onRetranslated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const hasTranslation = Boolean(msg.bodyTranslated?.trim());
  const needsXlate =
    !mine && msg.langDetected && msg.langDetected !== preferredLang && !hasTranslation;

  return (
    <div className={cn('flex gap-2', mine ? 'flex-row-reverse' : 'flex-row')}>
      <Avatar name={mine ? 'You' : 'Student'} size="sm" />
      <div
        className={cn(
          'max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
          mine
            ? 'rounded-tr-md bg-sky-600 text-white'
            : 'rounded-tl-md border border-slate-200/80 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
        )}
      >
        {!mine && hasTranslation ? (
          <div className="space-y-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                {langLabel(msg.langTarget || preferredLang)} translation
              </p>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.bodyTranslated}</p>
            </div>
            <div className="border-t border-slate-200/70 pt-2 dark:border-slate-700">
              <button
                type="button"
                className="text-[10px] font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                onClick={() => setShowOriginal((v) => !v)}
              >
                {showOriginal ? 'Hide original' : `Show original (${langLabel(msg.langDetected)})`}
              </button>
              {showOriginal ? (
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">
                  {msg.bodyOriginal}
                </p>
              ) : null}
            </div>
          </div>
        ) : !mine && msg.langDetected === 'en' && preferredLang === 'en' ? (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
              English · translation not required
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">{msg.bodyOriginal}</p>
          </div>
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed">{msg.bodyOriginal}</p>
        )}

        {msg.attachments?.length ? (
          <div className="mt-2 space-y-1">
            {msg.attachments.map((a) => (
              <a
                key={a.id}
                href={resolveUploadAssetUrl(a.storageUrl) || a.storageUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'block truncate text-xs underline',
                  mine ? 'text-sky-100' : 'text-sky-700 dark:text-sky-300',
                )}
              >
                📎 {a.fileName}
              </a>
            ))}
          </div>
        ) : null}

        <div
          className={cn(
            'mt-1.5 flex flex-wrap items-center gap-2 text-[10px]',
            mine ? 'text-sky-100/90' : 'text-slate-400',
          )}
        >
          <span>
            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {mine ? (
            <span>{msg.deliveryStatus === 'READ' ? 'Read' : msg.deliveryStatus || 'Sent'}</span>
          ) : null}
          {!mine && msg.langDetected ? (
            <span>
              {langFlag(msg.langDetected)} {langLabel(msg.langDetected)}
            </span>
          ) : null}
          {!mine ? (
            <button
              type="button"
              disabled={busy}
              className="underline decoration-dotted"
              onClick={async () => {
                setBusy(true);
                try {
                  await retranslateSupportMessage(threadId, msg.id, preferredLang);
                  onRetranslated();
                } finally {
                  setBusy(false);
                }
              }}
            >
              {needsXlate ? `Translate to ${langLabel(preferredLang)}` : 'Re-translate'}
            </button>
          ) : null}
          {!mine && hasTranslation ? (
            <button
              type="button"
              className="underline decoration-dotted"
              onClick={() => void navigator.clipboard.writeText(msg.bodyTranslated || '')}
            >
              Copy
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function SupportCentreEnterpriseWorkspace() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>('workspace');
  const [bucket, setBucket] = useState<InboxBucket>('all');
  const [deptId, setDeptId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [preferredLang, setPreferredLang] = useState('ta');
  const [toast, setToast] = useState('');
  const [typing, setTyping] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState({
    category: 'GENERAL',
    priority: 'MEDIUM',
    subject: '',
  });
  const [busy, setBusy] = useState(false);
  const [starred, setStarred] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem('support-starred') || '[]'));
    } catch {
      return new Set();
    }
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const dashQ = useQuery({
    queryKey: ['support', 'dashboard'],
    queryFn: fetchSupportDashboard,
    refetchInterval: 30_000,
  });
  const agentsQ = useQuery({
    queryKey: ['support', 'agents'],
    queryFn: fetchSupportAgents,
  });
  const deptsQ = useQuery({
    queryKey: ['support', 'departments'],
    queryFn: fetchSupportDepartments,
  });
  const chatsQ = useQuery({
    queryKey: ['support', 'chats', bucket, deptId, search],
    queryFn: () =>
      fetchSupportChats({
        bucket: bucket === 'all' || bucket === 'dept' ? undefined : bucket,
        departmentId: bucket === 'dept' && deptId ? deptId : undefined,
        q: search.trim() || undefined,
      }),
    refetchInterval: 12_000,
  });
  const chatQ = useQuery({
    queryKey: ['support', 'chat', chatId],
    queryFn: () => fetchSupportChat(chatId!),
    enabled: Boolean(chatId),
  });
  const studentQ = useQuery({
    queryKey: ['support', 'student-context', chatId],
    queryFn: () => fetchSupportStudentContext(chatId!),
    enabled: Boolean(chatId),
  });
  const aiQ = useQuery({
    queryKey: ['support', 'ai', chatId],
    queryFn: () => fetchSupportAiAssist(chatId!),
    enabled: Boolean(chatId),
    staleTime: 60_000,
  });
  const ticketsQ = useQuery({
    queryKey: ['support', 'tickets'],
    queryFn: () => fetchSupportTickets(),
    enabled: view === 'tickets' || bucket === 'tickets',
  });
  const ticketQ = useQuery({
    queryKey: ['support', 'ticket', ticketId],
    queryFn: () => fetchSupportTicket(ticketId!),
    enabled: Boolean(ticketId),
  });
  const faqQ = useQuery({
    queryKey: ['support', 'faq'],
    queryFn: fetchSupportFaqAdmin,
    enabled: view === 'faq',
  });
  const settingsQ = useQuery({
    queryKey: ['support', 'settings'],
    queryFn: fetchSupportSettings,
    enabled: view === 'settings',
  });

  const meAgent = useMemo(
    () => (agentsQ.data ?? []).find((a) => a.userId === session?.user?.id),
    [agentsQ.data, session?.user?.id],
  );
  const iAmOnline = Boolean(meAgent?.isOnline);
  const myLang = meAgent?.preferredLang || preferredLang;

  useEffect(() => {
    if (meAgent?.preferredLang) setPreferredLang(meAgent.preferredLang);
  }, [meAgent?.preferredLang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatQ.data?.messages?.length, chatId]);

  useEffect(() => {
    if (!chatId) return;
    void markSupportChatRead(chatId).then(() => {
      void qc.invalidateQueries({ queryKey: ['support', 'chats'] });
    });
  }, [chatId, qc]);

  useSupportRealtime(chatId, {
    onMessage: (payload) => {
      if (payload?.message?.senderRole === 'STUDENT') {
        setToast(
          payload.message.bodyTranslated || payload.message.bodyOriginal || 'New student message',
        );
        window.setTimeout(() => setToast(''), 5000);
      }
      void qc.invalidateQueries({ queryKey: ['support', 'chat', chatId] });
      void qc.invalidateQueries({ queryKey: ['support', 'chats'] });
      void qc.invalidateQueries({ queryKey: ['support', 'dashboard'] });
      void qc.invalidateQueries({ queryKey: ['support', 'ai', chatId] });
    },
    onTyping: (payload) => {
      if (payload.threadId === chatId && payload.userId !== session?.user?.id) {
        setTyping(payload.isTyping);
      }
    },
    onInboxPing: (payload) => {
      setToast(payload.preview || 'New Support Centre message');
      window.setTimeout(() => setToast(''), 5000);
      void qc.invalidateQueries({ queryKey: ['support', 'chats'] });
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('Support Centre', {
            body: payload.preview || 'New message from a student',
          });
        } else if (Notification.permission === 'default') {
          void Notification.requestPermission();
        }
      }
    },
  });

  const inbox = useMemo(() => {
    let rows = chatsQ.data ?? [];
    if (bucket === 'new') {
      rows = rows.filter((t) => (t.unreadAgent ?? 0) > 0 || t.status === 'OPEN');
    }
    return rows;
  }, [chatsQ.data, bucket]);

  const toggleStar = (id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem('support-starred', JSON.stringify([...next]));
      return next;
    });
  };

  const send = async () => {
    if (!chatId || !draft.trim()) return;
    setBusy(true);
    try {
      await sendSupportChatMessage(chatId, draft.trim());
      setDraft('');
      void qc.invalidateQueries({ queryKey: ['support', 'chat', chatId] });
      void qc.invalidateQueries({ queryKey: ['support', 'chats'] });
    } catch (e) {
      setToast(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const dash = dashQ.data;

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-[640px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-xl dark:border-slate-800 dark:bg-slate-950">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
            Support Centre
          </h1>
          <p className="text-xs text-slate-500">Enterprise AI Helpdesk · BCL OneCampus</p>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(
            [
              ['workspace', 'Workspace'],
              ['dashboard', 'Dashboard'],
              ['tickets', 'Tickets'],
              ['faq', 'Knowledge'],
              ['settings', 'Settings'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition',
                view === id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
            value={preferredLang}
            onChange={(e) => setPreferredLang(e.target.value)}
            title="Reading language"
          >
            {LANG_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                Read: {l.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant={iAmOnline ? 'default' : 'outline'}
            className={cn('rounded-xl', iAmOnline && 'bg-emerald-600 hover:bg-emerald-700')}
            onClick={async () => {
              try {
                await setSupportAgentPresence(!iAmOnline, undefined, preferredLang);
                void qc.invalidateQueries({ queryKey: ['support', 'agents'] });
                void qc.invalidateQueries({ queryKey: ['support', 'dashboard'] });
              } catch (e) {
                setToast(apiErrorMessage(e));
              }
            }}
          >
            <span
              className={cn(
                'mr-1.5 inline-block h-2 w-2 rounded-full',
                iAmOnline ? 'bg-white' : 'bg-slate-400',
              )}
            />
            {iAmOnline ? 'Online' : 'Go online'}
          </Button>
          <span className="text-lg" title="Notifications">
            🔔
          </span>
        </div>
      </header>

      {toast ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {toast}
        </div>
      ) : null}

      {view === 'workspace' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1.4fr)_minmax(220px,0.9fr)_minmax(240px,0.95fr)]">
          {/* Inbox */}
          <aside className="flex min-h-0 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="space-y-2 border-b border-slate-100 p-3 dark:border-slate-800">
              <Input
                placeholder="Search name, ticket, keyword…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 rounded-xl text-sm"
              />
              <div className="flex flex-wrap gap-1">
                {BUCKETS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setBucket(b.id);
                      if (b.id !== 'dept') setDeptId('');
                    }}
                    className={cn(
                      'rounded-lg px-2 py-1 text-[11px] font-medium',
                      bucket === b.id
                        ? 'bg-sky-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
                    )}
                  >
                    {b.icon} {b.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setBucket('dept')}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-medium',
                    bucket === 'dept'
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  🏢 Queues
                </button>
              </div>
              {bucket === 'dept' ? (
                <select
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white text-xs dark:border-slate-700 dark:bg-slate-950"
                  value={deptId}
                  onChange={(e) => setDeptId(e.target.value)}
                >
                  <option value="">All departments</option>
                  {(deptsQ.data ?? []).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {chatsQ.isLoading ? (
                <p className="p-4 text-sm text-slate-400">Loading inbox…</p>
              ) : inbox.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">No conversations in this queue.</p>
              ) : (
                inbox.map((t: SupportChatThread) => {
                  const active = t.id === chatId;
                  const name = t.student?.fullName || 'Student';
                  return (
                    <div
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setChatId(t.id);
                        setView('workspace');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setChatId(t.id);
                          setView('workspace');
                        }
                      }}
                      className={cn(
                        'flex w-full cursor-pointer gap-2 border-b border-slate-100 px-3 py-3 text-left transition dark:border-slate-800',
                        active
                          ? 'bg-sky-50 dark:bg-sky-950/40'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                      )}
                    >
                      <div className="relative">
                        <Avatar name={name} photo={t.student?.photoPath} />
                        {(t.unreadAgent ?? 0) > 0 ? (
                          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                            {t.unreadAgent}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {name}
                          </p>
                          <button
                            type="button"
                            className="text-xs"
                            aria-label={starred.has(t.id) ? 'Unstar chat' : 'Star chat'}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStar(t.id);
                            }}
                          >
                            {starred.has(t.id) ? '⭐' : '☆'}
                          </button>
                        </div>
                        <p className="truncate text-[11px] text-slate-500">
                          {t.student?.departmentName || t.department?.name || t.category}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
                          {t.lastMessagePreview || '—'}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-slate-400">
                            {langFlag(t.language || t.studentLang)}{' '}
                            {langLabel(t.language || t.studentLang)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {waitLabel(t.waitMinutes)}
                          </span>
                          {t.priority ? (
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                                priorityClass(t.priority),
                              )}
                            >
                              {t.priority}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Conversation */}
          <section className="flex min-h-0 flex-col bg-gradient-to-b from-slate-100/80 to-slate-50 dark:from-slate-950 dark:to-slate-900">
            {chatId && chatQ.data ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
                  <Avatar
                    name={studentQ.data?.fullName || chatQ.data.student?.fullName}
                    photo={studentQ.data?.photoPath || chatQ.data.student?.photoPath}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">
                      {studentQ.data?.fullName || chatQ.data.student?.fullName || 'Conversation'}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {chatQ.data.category}
                      {chatQ.data.department?.name ? ` · ${chatQ.data.department.name}` : ''}
                      {chatQ.data.ticket?.ticketNo ? ` · ${chatQ.data.ticket.ticketNo}` : ''}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={async () => {
                      try {
                        await retranslateSupportThread(chatId, myLang);
                        void qc.invalidateQueries({
                          queryKey: ['support', 'chat', chatId],
                        });
                      } catch (e) {
                        setToast(apiErrorMessage(e));
                      }
                    }}
                  >
                    Translate → {langLabel(myLang)}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => {
                      setConvertForm({
                        category: chatQ.data?.category || 'GENERAL',
                        priority: 'MEDIUM',
                        subject: chatQ.data?.subject || '',
                      });
                      setConvertOpen(true);
                    }}
                  >
                    Convert to Ticket
                  </Button>
                  {meAgent && chatQ.data.agent?.id !== meAgent.id ? (
                    <Button
                      size="sm"
                      className="rounded-xl"
                      onClick={async () => {
                        await assignSupportChat(chatId, meAgent.id);
                        void qc.invalidateQueries({
                          queryKey: ['support', 'chat', chatId],
                        });
                      }}
                    >
                      Assign to me
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                    disabled={chatQ.data.status === 'CLOSED'}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          'End this chat? The student will no longer be able to reply here.',
                        )
                      ) {
                        return;
                      }
                      try {
                        await closeSupportChat(chatId);
                        void qc.invalidateQueries({ queryKey: ['support', 'chats'] });
                        void qc.invalidateQueries({
                          queryKey: ['support', 'chat', chatId],
                        });
                        setToast('Chat ended');
                      } catch (e) {
                        setToast(apiErrorMessage(e));
                      }
                    }}
                  >
                    {chatQ.data.status === 'CLOSED' ? 'Ended' : 'End chat'}
                  </Button>
                </div>

                {chatQ.data.status === 'CLOSED' ? (
                  <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-center text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    This chat has ended. Messaging is disabled.
                  </div>
                ) : null}

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {(chatQ.data.messages ?? []).map((m) => (
                    <MessageBubble
                      key={m.id}
                      msg={m}
                      mine={m.senderUserId === session?.user?.id || m.senderRole === 'AGENT'}
                      threadId={chatId}
                      preferredLang={myLang}
                      onRetranslated={() =>
                        void qc.invalidateQueries({
                          queryKey: ['support', 'chat', chatId],
                        })
                      }
                    />
                  ))}
                  {typing ? (
                    <p className="animate-pulse text-xs text-slate-400">Student is typing…</p>
                  ) : null}
                  <div ref={bottomRef} />
                </div>

                {chatQ.data.status === 'CLOSED' ? (
                  <div className="border-t border-slate-200/80 bg-white p-4 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                    Chat ended — messaging is disabled. Select another conversation or wait for a
                    new student chat.
                  </div>
                ) : (
                  <div className="border-t border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-2 flex flex-wrap gap-1">
                      {[
                        'Thank you for writing in.',
                        'We will update within 2 working days.',
                        'Please share your roll number.',
                      ].map((tpl) => (
                        <button
                          key={tpl}
                          type="button"
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                          onClick={() => setDraft(tpl)}
                        >
                          {tpl.slice(0, 28)}…
                        </button>
                      ))}
                    </div>
                    <div className="flex items-end gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !chatId) return;
                          try {
                            await uploadAdminChatFile(chatId, file);
                            void qc.invalidateQueries({
                              queryKey: ['support', 'chat', chatId],
                            });
                          } catch (err) {
                            setToast(apiErrorMessage(err));
                          } finally {
                            e.target.value = '';
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => fileRef.current?.click()}
                      >
                        📎
                      </Button>
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                          }
                        }}
                        rows={2}
                        placeholder="Write a reply… (Enter to send)"
                        className="min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-sky-900"
                      />
                      <Button
                        className="rounded-xl bg-sky-600 hover:bg-sky-700"
                        disabled={busy || !draft.trim()}
                        onClick={() => void send()}
                      >
                        Send
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <div className="text-4xl">💬</div>
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
                  Select a conversation
                </p>
                <p className="max-w-sm text-sm text-slate-500">
                  Smart inbox on the left · student profile and AI assist open automatically when
                  you pick a chat.
                </p>
              </div>
            )}
          </section>

          {/* Student profile */}
          <aside className="flex min-h-0 flex-col overflow-y-auto border-l border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Student Profile
              </h2>
              <p className="text-[11px] text-slate-500">ERP context without leaving chat</p>
            </div>
            {!chatId ? (
              <p className="p-4 text-sm text-slate-400">Open a chat to load student details.</p>
            ) : studentQ.isLoading ? (
              <p className="p-4 text-sm text-slate-400">Loading profile…</p>
            ) : studentQ.data ? (
              <div className="space-y-4 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={studentQ.data.fullName} photo={studentQ.data.photoPath} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900 dark:text-white">
                      {studentQ.data.fullName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {studentQ.data.rollNumber || studentQ.data.enrollmentNumber || '—'}
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-1 gap-2 text-xs">
                  {[
                    ['Programme', studentQ.data.programme],
                    ['Semester', studentQ.data.semester?.toString()],
                    ['Department', studentQ.data.departmentName],
                    ['Mobile', studentQ.data.mobile],
                    ['Email', studentQ.data.email],
                    [
                      'Attendance',
                      studentQ.data.attendancePercent != null
                        ? `${studentQ.data.attendancePercent}%`
                        : 'Open attendance',
                    ],
                    ['Fee status', studentQ.data.feeStatus],
                    [
                      'Fee due',
                      studentQ.data.feeDueAmount != null
                        ? `₹${Number(studentQ.data.feeDueAmount).toLocaleString()}`
                        : null,
                    ],
                    ['Scholarship', studentQ.data.scholarshipStatus],
                    ['Advisor', studentQ.data.academicAdvisor],
                  ].map(([k, v]) => (
                    <div
                      key={String(k)}
                      className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
                    >
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        {k}
                      </dt>
                      <dd className="mt-0.5 break-all text-slate-800 dark:text-slate-100">
                        {v || '—'}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Quick actions
                  </p>
                  {[
                    ['Open profile', studentQ.data.links.profile],
                    ['Fee ledger', studentQ.data.links.fees],
                    ['Attendance', studentQ.data.links.attendance],
                    ['Documents', studentQ.data.links.documents],
                  ].map(([label, href]) =>
                    href ? (
                      <Link
                        key={String(label)}
                        href={href}
                        className="block rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-sky-700 hover:bg-sky-50 dark:border-slate-700 dark:text-sky-300 dark:hover:bg-sky-950/40"
                      >
                        {label} →
                      </Link>
                    ) : null,
                  )}
                </div>
              </div>
            ) : (
              <p className="p-4 text-sm text-slate-400">Student record not linked.</p>
            )}
          </aside>

          {/* AI Assistant */}
          <aside className="flex min-h-0 flex-col overflow-y-auto border-l border-slate-200/80 bg-gradient-to-b from-indigo-50/60 to-white dark:border-slate-800 dark:from-indigo-950/30 dark:to-slate-900">
            <div className="border-b border-indigo-100/80 px-4 py-3 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-indigo-950 dark:text-indigo-100">
                AI Assistant
              </h2>
              <p className="text-[11px] text-indigo-700/70 dark:text-indigo-300/70">
                Translate · Summarize · Suggest · Knowledge
              </p>
            </div>
            {!chatId ? (
              <p className="p-4 text-sm text-slate-400">AI tools appear when a chat is open.</p>
            ) : aiQ.isLoading ? (
              <p className="p-4 text-sm text-slate-400">Analysing conversation…</p>
            ) : aiQ.data ? (
              <div className="space-y-3 p-4">
                {aiQ.data.note ? (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    {aiQ.data.note}
                  </p>
                ) : null}
                <div className="rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">
                    AI Summary
                  </p>
                  <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                    {aiQ.data.summary || '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-500">
                      Suggested reply
                    </p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                      {aiQ.data.confidence}% confidence
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-800 dark:text-slate-100">
                    {aiQ.data.suggestedReply}
                  </p>
                  <Button
                    size="sm"
                    className="mt-2 w-full rounded-xl"
                    onClick={() => setDraft(aiQ.data!.suggestedReply)}
                  >
                    Use reply
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white/80 p-2 dark:bg-slate-900">
                    <p className="text-[10px] text-slate-400">Sentiment</p>
                    <p className="font-semibold">{aiQ.data.sentiment}</p>
                  </div>
                  <div className="rounded-xl bg-white/80 p-2 dark:bg-slate-900">
                    <p className="text-[10px] text-slate-400">Priority</p>
                    <p className="font-semibold">{aiQ.data.suggestedPriority}</p>
                  </div>
                  <div className="col-span-2 rounded-xl bg-white/80 p-2 dark:bg-slate-900">
                    <p className="text-[10px] text-slate-400">Category</p>
                    <p className="font-semibold">{aiQ.data.suggestedCategory}</p>
                  </div>
                </div>
                {aiQ.data.faqHints?.length ? (
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-indigo-500">
                      Knowledge base
                    </p>
                    <ul className="space-y-1">
                      {aiQ.data.faqHints.map((f) => (
                        <li
                          key={f.id}
                          className="rounded-xl bg-white/80 px-3 py-2 text-xs dark:bg-slate-900"
                        >
                          {f.question}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={() => void qc.invalidateQueries({ queryKey: ['support', 'ai', chatId] })}
                >
                  Refresh AI
                </Button>
              </div>
            ) : (
              <p className="p-4 text-sm text-slate-400">Unable to load AI assist.</p>
            )}
          </aside>
        </div>
      ) : null}

      {view === 'dashboard' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            {[
              ['Today’s chats', dash?.activeChats ?? dash?.chatsThisWeek],
              ['Open tickets', dash?.openTickets],
              ['Pending', dash?.pendingTickets],
              ['Waiting chats', dash?.waitingChats],
              ['Agents online', dash?.onlineAgents],
              [
                'Satisfaction',
                dash?.avgSatisfaction != null ? `${dash.avgSatisfaction.toFixed(1)}/5` : '—',
              ],
              ['Unread', dash?.unreadMessages],
              ['Messages today', dash?.messagesToday],
              ['Unassigned', dash?.unassignedChats],
              ['Resolved today', dash?.resolvedToday],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {label}
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">
                  {value ?? '—'}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Top categories</h3>
              <ul className="mt-3 space-y-2">
                {(dash?.byCategory ?? []).map((c) => (
                  <li key={c.category} className="flex justify-between text-sm">
                    <span>{c.category}</span>
                    <span className="font-semibold">{c.count}</span>
                  </li>
                ))}
                {!dash?.byCategory?.length ? (
                  <li className="text-sm text-slate-400">No ticket data yet.</li>
                ) : null}
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="font-semibold">Recent chats</h3>
              <ul className="mt-3 space-y-2">
                {(dash?.recentChats ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full rounded-xl px-2 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={() => {
                        setChatId(c.id);
                        setView('workspace');
                      }}
                    >
                      <span className="font-medium">{c.category}</span>
                      <span className="ml-2 text-slate-500">
                        {c.lastMessagePreview || c.status}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {view === 'tickets' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_1.2fr]">
          <div className="overflow-y-auto border-r border-slate-200 dark:border-slate-800">
            {(ticketsQ.data ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTicketId(t.id)}
                className={cn(
                  'flex w-full flex-col border-b border-slate-100 px-4 py-3 text-left dark:border-slate-800',
                  ticketId === t.id && 'bg-sky-50 dark:bg-sky-950/30',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-sky-700 dark:text-sky-300">
                    {t.ticketNo}
                  </span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-bold',
                      priorityClass(t.priority),
                    )}
                  >
                    {t.priority}
                  </span>
                </div>
                <p className="truncate text-sm font-medium">{t.subject}</p>
                <p className="text-xs text-slate-500">
                  {t.status} · {t.category}
                </p>
              </button>
            ))}
          </div>
          <div className="overflow-y-auto p-4">
            {ticketQ.data ? (
              <div className="space-y-4">
                <div>
                  <p className="font-mono text-sm text-sky-700">{ticketQ.data.ticketNo}</p>
                  <h3 className="text-xl font-semibold">{ticketQ.data.subject}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                    {ticketQ.data.description}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Timeline</h4>
                  <ol className="mt-2 space-y-3 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
                    <li className="text-xs">
                      <span className="font-semibold">
                        {new Date(ticketQ.data.createdAt).toLocaleString()}
                      </span>
                      <p>Ticket created</p>
                    </li>
                    {(ticketQ.data.comments ?? []).map((c) => (
                      <li key={c.id} className="text-xs">
                        <span className="font-semibold">
                          {new Date(c.createdAt).toLocaleString()}
                        </span>
                        <p className={c.isInternal ? 'italic text-amber-700' : ''}>
                          {c.isInternal ? '[Internal] ' : ''}
                          {c.body}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['IN_PROGRESS', 'WAITING_STUDENT', 'RESOLVED', 'CLOSED'].map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant="outline"
                      className="rounded-xl"
                      onClick={async () => {
                        try {
                          await transitionSupportTicket(ticketQ.data!.id, s);
                          void qc.invalidateQueries({
                            queryKey: ['support', 'ticket', ticketId],
                          });
                          void qc.invalidateQueries({ queryKey: ['support', 'tickets'] });
                        } catch (e) {
                          setToast(apiErrorMessage(e));
                        }
                      }}
                    >
                      → {s}
                    </Button>
                  ))}
                </div>
                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const body = String(fd.get('body') || '');
                    const isInternal = fd.get('internal') === 'on';
                    if (!body.trim()) return;
                    await commentSupportTicket(ticketQ.data!.id, body, isInternal);
                    (e.target as HTMLFormElement).reset();
                    void qc.invalidateQueries({
                      queryKey: ['support', 'ticket', ticketId],
                    });
                  }}
                >
                  <textarea
                    name="body"
                    rows={3}
                    placeholder="Add comment or internal note…"
                    className="w-full rounded-xl border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="internal" /> Internal note (staff only)
                  </label>
                  <Button type="submit" size="sm" className="rounded-xl">
                    Post
                  </Button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Select a ticket.</p>
            )}
          </div>
        </div>
      ) : null}

      {view === 'faq' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {(faqQ.data ?? []).map((cat) => (
            <div key={cat.id} className="mb-6">
              <h3 className="font-semibold">{cat.name}</h3>
              <ul className="mt-2 space-y-2">
                {cat.articles.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <p className="font-medium">{a.question}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.answer}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {a.isPublished ? 'Published' : 'Draft'}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      {view === 'settings' ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <form
            className="mx-auto max-w-xl space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              try {
                await updateSupportSettings({
                  ...settingsQ.data,
                  contactEmail: String(fd.get('contactEmail') || ''),
                  contactPhone: String(fd.get('contactPhone') || ''),
                  supportHours: String(fd.get('supportHours') || ''),
                  welcomeMessage: String(fd.get('welcomeMessage') || ''),
                  defaultAgentLang: String(fd.get('defaultAgentLang') || 'ta'),
                  translationEnabled: fd.get('translationEnabled') === 'on',
                });
                void qc.invalidateQueries({ queryKey: ['support', 'settings'] });
                setToast('Settings saved');
              } catch (err) {
                setToast(apiErrorMessage(err));
              }
            }}
          >
            <h3 className="font-semibold">Support Centre settings</h3>
            <Input
              name="contactEmail"
              defaultValue={String(settingsQ.data?.contactEmail ?? '')}
              placeholder="Contact email"
            />
            <Input
              name="contactPhone"
              defaultValue={String(settingsQ.data?.contactPhone ?? '')}
              placeholder="Contact phone"
            />
            <Input
              name="supportHours"
              defaultValue={String(settingsQ.data?.supportHours ?? '')}
              placeholder="Support hours"
            />
            <textarea
              name="welcomeMessage"
              defaultValue={String(settingsQ.data?.welcomeMessage ?? '')}
              rows={3}
              className="w-full rounded-xl border border-slate-200 p-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              placeholder="Welcome message"
            />
            <select
              name="defaultAgentLang"
              defaultValue={String(settingsQ.data?.defaultAgentLang ?? 'ta')}
              className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              {LANG_OPTIONS.map((l) => (
                <option key={l.code} value={l.code}>
                  Default staff reading: {l.label}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="translationEnabled"
                defaultChecked={settingsQ.data?.translationEnabled !== false}
              />
              AI translation enabled
            </label>
            <Button type="submit" className="rounded-xl">
              Save
            </Button>
          </form>
        </div>
      ) : null}

      {convertOpen && chatId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <h3 className="text-lg font-semibold">Convert chat to ticket</h3>
            <div className="mt-3 space-y-2">
              <Input
                value={convertForm.subject}
                onChange={(e) => setConvertForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Subject"
              />
              <select
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={convertForm.category}
                onChange={(e) => setConvertForm((f) => ({ ...f, category: e.target.value }))}
              >
                {SUPPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={convertForm.priority}
                onChange={(e) => setConvertForm((f) => ({ ...f, priority: e.target.value }))}
              >
                {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setConvertOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="rounded-xl"
                onClick={async () => {
                  try {
                    const ticket = await convertSupportChatToTicket(chatId, convertForm);
                    setConvertOpen(false);
                    setTicketId(ticket.id);
                    setView('tickets');
                    void qc.invalidateQueries({ queryKey: ['support', 'chats'] });
                    void qc.invalidateQueries({ queryKey: ['support', 'tickets'] });
                    setToast(`Ticket ${ticket.ticketNo} created`);
                  } catch (e) {
                    setToast(apiErrorMessage(e));
                  }
                }}
              >
                Create ticket
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
