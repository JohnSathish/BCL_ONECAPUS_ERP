'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupportRealtime } from '@/hooks/use-support-realtime';
import { useAuth } from '@/hooks/use-auth';
import {
  assignSupportChat,
  closeSupportChat,
  commentSupportTicket,
  createSupportFaqArticle,
  fetchSupportAgents,
  fetchSupportChat,
  fetchSupportChats,
  fetchSupportDashboard,
  fetchSupportDepartments,
  fetchSupportFaqAdmin,
  fetchSupportSettings,
  fetchSupportTicket,
  fetchSupportTickets,
  markSupportChatRead,
  retranslateSupportMessage,
  retranslateSupportThread,
  sendSupportChatMessage,
  setSupportAgentPresence,
  transitionSupportTicket,
  updateSupportFaqArticle,
  updateSupportSettings,
  uploadAdminChatFile,
  upsertSupportAgent,
  type SupportChatMessage,
} from '@/services/support-centre';
import { cn } from '@/utils/cn';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { apiErrorMessage } from '@/utils/api-error';

type Tab = 'dashboard' | 'chats' | 'tickets' | 'faq' | 'agents' | 'settings';

const LANG_OPTIONS = [
  { code: 'ta', label: 'Tamil' },
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'garo', label: 'Garo' },
  { code: 'khasi', label: 'Khasi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'as', label: 'Assamese' },
] as const;

function langLabel(code?: string | null) {
  return LANG_OPTIONS.find((l) => l.code === code)?.label ?? code ?? '—';
}

function AdminBubble({
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
  const hasTranslation = Boolean(msg.bodyTranslated?.trim());

  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[90%] space-y-2 rounded-2xl px-3 py-2 text-sm shadow-sm',
          mine ? 'bg-primary text-primary-foreground' : 'border bg-card',
        )}
      >
        {!mine ? (
          <>
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                For you ({langLabel(msg.langTarget || preferredLang)})
              </p>
              {hasTranslation ? (
                <p className="whitespace-pre-wrap text-base font-medium leading-relaxed">
                  {msg.bodyTranslated}
                </p>
              ) : (
                <p className="text-sm text-amber-700">
                  Translation not ready yet — click Translate.
                </p>
              )}
            </div>
            <div className="rounded-xl bg-muted/60 p-2">
              <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">
                Original ({langLabel(msg.langDetected)})
              </p>
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                {msg.bodyOriginal}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                className="rounded-md bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                onClick={() => {
                  setBusy(true);
                  void retranslateSupportMessage(threadId, msg.id, preferredLang)
                    .then(onRetranslated)
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? 'Translating…' : `Translate to ${langLabel(preferredLang)}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="whitespace-pre-wrap">{msg.bodyOriginal}</p>
            {hasTranslation ? (
              <p className="mt-1 border-t border-white/20 pt-1 text-[11px] opacity-90">
                Student sees: {msg.bodyTranslated}
              </p>
            ) : null}
          </>
        )}
        {msg.attachments?.map((a) => (
          <a
            key={a.id}
            className="mt-1 block text-xs underline"
            href={resolveUploadAssetUrl(a.storageUrl) ?? a.storageUrl}
            target="_blank"
            rel="noreferrer"
          >
            {a.fileName}
          </a>
        ))}
      </div>
    </div>
  );
}

export function SupportCentreWorkspace() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [chatId, setChatId] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [preferredLang, setPreferredLang] = useState('ta');
  const [retranslateBusy, setRetranslateBusy] = useState(false);

  const dashQ = useQuery({
    queryKey: ['support', 'dashboard'],
    queryFn: fetchSupportDashboard,
    enabled: tab === 'dashboard',
  });
  const chatsQ = useQuery({
    queryKey: ['support', 'chats'],
    queryFn: () => fetchSupportChats(),
    enabled: tab === 'chats',
  });
  const chatQ = useQuery({
    queryKey: ['support', 'chat', chatId],
    queryFn: () => fetchSupportChat(chatId!),
    enabled: tab === 'chats' && Boolean(chatId),
  });
  const ticketsQ = useQuery({
    queryKey: ['support', 'tickets'],
    queryFn: () => fetchSupportTickets(),
    enabled: tab === 'tickets',
  });
  const ticketQ = useQuery({
    queryKey: ['support', 'ticket', ticketId],
    queryFn: () => fetchSupportTicket(ticketId!),
    enabled: tab === 'tickets' && Boolean(ticketId),
  });
  const faqQ = useQuery({
    queryKey: ['support', 'faq'],
    queryFn: fetchSupportFaqAdmin,
    enabled: tab === 'faq',
  });
  const agentsQ = useQuery({
    queryKey: ['support', 'agents'],
    queryFn: fetchSupportAgents,
    enabled: tab === 'agents' || tab === 'dashboard' || tab === 'chats',
  });
  const deptsQ = useQuery({
    queryKey: ['support', 'departments'],
    queryFn: fetchSupportDepartments,
    enabled: tab === 'agents' || tab === 'settings',
  });
  const settingsQ = useQuery({
    queryKey: ['support', 'settings'],
    queryFn: fetchSupportSettings,
    enabled: tab === 'settings',
  });

  const meAgent = useMemo(
    () => (agentsQ.data ?? []).find((a) => a.userId === session?.user?.id),
    [agentsQ.data, session?.user?.id],
  );
  const iAmOnline = Boolean(meAgent?.isOnline);
  const myLang = meAgent?.preferredLang || preferredLang;

  useSupportRealtime(chatId, {
    onMessage: (payload) => {
      if (payload?.message?.senderRole === 'STUDENT') {
        setToast(
          payload.message.bodyTranslated || payload.message.bodyOriginal || 'New student message',
        );
        window.setTimeout(() => setToast(''), 6000);
      }
      void qc.invalidateQueries({ queryKey: ['support', 'chat', chatId] });
      void qc.invalidateQueries({ queryKey: ['support', 'chats'] });
      void qc.invalidateQueries({ queryKey: ['support', 'dashboard'] });
    },
    onInboxPing: (payload) => {
      setToast(payload.preview || 'New Support Centre message');
      window.setTimeout(() => setToast(''), 6000);
      void qc.invalidateQueries({ queryKey: ['support', 'chats'] });
      void qc.invalidateQueries({ queryKey: ['support', 'dashboard'] });
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

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'chats', label: 'Live Chats' },
    { id: 'tickets', label: 'Tickets' },
    { id: 'faq', label: 'Knowledge Base' },
    { id: 'agents', label: 'Agents' },
    { id: 'settings', label: 'Settings' },
  ];

  const kpis = useMemo(() => {
    const d = dashQ.data;
    if (!d) return [];
    return [
      { label: 'Open tickets', value: d.openTickets },
      { label: 'Pending', value: d.pendingTickets },
      { label: 'Resolved today', value: d.resolvedToday },
      { label: 'Active chats', value: d.activeChats },
      { label: 'Unassigned chats', value: d.unassignedChats ?? 0 },
      { label: 'Unread messages', value: d.unreadMessages },
      { label: 'Messages today', value: d.messagesToday ?? 0 },
      { label: 'Online agents', value: d.onlineAgents },
      {
        label: 'Satisfaction',
        value: d.avgSatisfaction != null ? d.avgSatisfaction.toFixed(1) : '—',
      },
    ];
  }, [dashQ.data]);

  return (
    <div className="space-y-4">
      {toast ? (
        <div className="fixed right-4 top-20 z-50 max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm shadow-lg">
          <p className="font-semibold text-emerald-900">New chat message</p>
          <p className="mt-1 text-emerald-800">{toast}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Support Centre</h2>
          <p className="text-sm text-muted-foreground">
            Live chat with auto-translation · Tickets · FAQ
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border bg-background px-2 py-1.5 text-xs"
            value={myLang}
            onChange={(e) => setPreferredLang(e.target.value)}
            title="Your reading language"
          >
            {LANG_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                Read as {l.label}
              </option>
            ))}
          </select>
          <span
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium',
              iAmOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground',
            )}
          >
            {iAmOnline ? 'You are online' : 'You are offline'}
          </span>
          <Button
            size="sm"
            variant={iAmOnline ? 'outline' : 'default'}
            onClick={() => {
              setError('');
              void setSupportAgentPresence(
                !iAmOnline,
                session?.user?.displayName ?? session?.user?.email,
                preferredLang,
              )
                .then(async () => {
                  await qc.invalidateQueries({ queryKey: ['support', 'agents'] });
                  await qc.invalidateQueries({
                    queryKey: ['support', 'dashboard'],
                  });
                })
                .catch((e) => setError(apiErrorMessage(e, 'Could not update online status')));
            }}
          >
            {iAmOnline ? 'Go offline' : 'Go online'}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-t-md px-3 py-2 text-xs font-medium',
              tab === t.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {tab === 'dashboard' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl border p-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-2xl font-bold">{k.value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Needs attention</p>
                <Button size="sm" variant="outline" onClick={() => setTab('chats')}>
                  Open inbox
                </Button>
              </div>
              <ul className="space-y-2">
                {(dashQ.data?.recentChats ?? []).map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full rounded-xl border px-3 py-2 text-left text-sm hover:bg-muted/50"
                      onClick={() => {
                        setTab('chats');
                        setChatId(c.id);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{c.department?.name ?? c.category}</span>
                        {(c.unreadAgent ?? 0) > 0 ? (
                          <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            {c.unreadAgent}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.lastMessagePreview ?? c.status}
                      </p>
                    </button>
                  </li>
                ))}
                {!dashQ.data?.recentChats?.length ? (
                  <p className="text-sm text-muted-foreground">No open chats.</p>
                ) : null}
              </ul>
            </div>
            <div className="rounded-2xl border p-4">
              <p className="mb-2 text-sm font-semibold">Tickets by category</p>
              <ul className="space-y-1 text-sm">
                {(dashQ.data?.byCategory ?? []).map((r) => (
                  <li key={r.category} className="flex justify-between">
                    <span>{r.category}</span>
                    <span className="font-medium">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'chats' ? (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <ul className="max-h-[36rem] space-y-1 overflow-y-auto rounded-2xl border p-2">
            {(chatsQ.data ?? []).map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full rounded-lg px-2 py-2 text-left text-xs',
                    chatId === c.id ? 'bg-primary/10' : 'hover:bg-muted',
                  )}
                  onClick={() => {
                    setChatId(c.id);
                    void markSupportChatRead(c.id).then(() =>
                      qc.invalidateQueries({ queryKey: ['support', 'chats'] }),
                    );
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{c.department?.name ?? c.category}</p>
                    {(c.unreadAgent ?? 0) > 0 ? (
                      <span className="rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">
                        {c.unreadAgent}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-muted-foreground">
                    {c.lastMessagePreview ?? c.status}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex min-h-[32rem] flex-col rounded-2xl border">
            {chatId && chatQ.data ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{chatQ.data.department?.name ?? 'Chat'}</p>
                    <p className="text-xs text-muted-foreground">
                      {chatQ.data.status} · {chatQ.data.category} · Student:{' '}
                      {langLabel(chatQ.data.studentLang)} · You read as {langLabel(myLang)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={retranslateBusy}
                      onClick={() => {
                        setRetranslateBusy(true);
                        void retranslateSupportThread(chatId, myLang)
                          .then(async (res) => {
                            await qc.invalidateQueries({
                              queryKey: ['support', 'chat', chatId],
                            });
                            setToast(
                              res.count
                                ? `Translated ${res.count} message(s) to ${langLabel(myLang)}`
                                : 'All messages already translated',
                            );
                            window.setTimeout(() => setToast(''), 4000);
                          })
                          .finally(() => setRetranslateBusy(false));
                      }}
                    >
                      {retranslateBusy ? 'Translating…' : `Translate chat → ${langLabel(myLang)}`}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void closeSupportChat(chatId).then(() =>
                          qc.invalidateQueries({ queryKey: ['support', 'chats'] }),
                        )
                      }
                    >
                      Close
                    </Button>
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">
                  {(chatQ.data.messages ?? []).map((m) => (
                    <AdminBubble
                      key={m.id}
                      msg={m}
                      mine={m.senderRole === 'AGENT'}
                      threadId={chatId}
                      preferredLang={myLang}
                      onRetranslated={() =>
                        void qc.invalidateQueries({
                          queryKey: ['support', 'chat', chatId],
                        })
                      }
                    />
                  ))}
                </div>
                <div className="space-y-2 border-t p-3">
                  <p className="text-[11px] text-muted-foreground">
                    Type in {langLabel(myLang)} or English — the student receives it in their
                    language automatically when AI translation is enabled.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={`Reply in ${langLabel(myLang)}…`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && draft.trim()) {
                          e.preventDefault();
                          void sendSupportChatMessage(chatId, draft.trim())
                            .then(() => {
                              setDraft('');
                              return qc.invalidateQueries({
                                queryKey: ['support', 'chat', chatId],
                              });
                            })
                            .catch((err) => setError(apiErrorMessage(err, 'Send failed')));
                        }
                      }}
                    />
                    <label className="inline-flex cursor-pointer items-center rounded-lg border px-3 text-xs">
                      File
                      <input
                        type="file"
                        className="sr-only"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f && chatId) {
                            void uploadAdminChatFile(chatId, f).then(() =>
                              qc.invalidateQueries({
                                queryKey: ['support', 'chat', chatId],
                              }),
                            );
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <Button
                      disabled={!draft.trim()}
                      onClick={() =>
                        void sendSupportChatMessage(chatId, draft.trim())
                          .then(() => {
                            setDraft('');
                            return qc.invalidateQueries({
                              queryKey: ['support', 'chat', chatId],
                            });
                          })
                          .catch((e) => setError(apiErrorMessage(e, 'Send failed')))
                      }
                    >
                      Send
                    </Button>
                  </div>
                </div>
                <AssignAgentRow
                  chatId={chatId}
                  onAssigned={() =>
                    void qc.invalidateQueries({
                      queryKey: ['support', 'chat', chatId],
                    })
                  }
                />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Select a chat from the inbox
              </div>
            )}
          </div>
        </div>
      ) : null}

      {tab === 'tickets' ? (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <ul className="max-h-[32rem] space-y-1 overflow-y-auto rounded-2xl border p-2">
            {(ticketsQ.data ?? []).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={cn(
                    'w-full rounded-lg px-2 py-2 text-left text-xs',
                    ticketId === t.id ? 'bg-primary/10' : 'hover:bg-muted',
                  )}
                  onClick={() => setTicketId(t.id)}
                >
                  <p className="font-mono text-[10px]">{t.ticketNo}</p>
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-muted-foreground">
                    {t.status} · {t.priority}
                  </p>
                </button>
              </li>
            ))}
          </ul>
          {ticketQ.data ? (
            <div className="space-y-3 rounded-2xl border p-4">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{ticketQ.data.ticketNo}</p>
                <h3 className="text-lg font-semibold">{ticketQ.data.subject}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm">{ticketQ.data.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {['ASSIGNED', 'IN_PROGRESS', 'WAITING_STUDENT', 'RESOLVED', 'CLOSED'].map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void transitionSupportTicket(ticketQ.data!.id, s)
                        .then(() =>
                          qc.invalidateQueries({
                            queryKey: ['support', 'ticket', ticketId],
                          }),
                        )
                        .catch((e) => setError(apiErrorMessage(e, 'Status update failed')))
                    }
                  >
                    {s.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
              <div>
                <Label>Internal note</Label>
                <div className="mt-1 flex gap-2">
                  <Input value={note} onChange={(e) => setNote(e.target.value)} />
                  <Button
                    size="sm"
                    onClick={() =>
                      void commentSupportTicket(ticketQ.data!.id, note, true).then(() => {
                        setNote('');
                        return qc.invalidateQueries({
                          queryKey: ['support', 'ticket', ticketId],
                        });
                      })
                    }
                  >
                    Add
                  </Button>
                </div>
              </div>
              <ul className="space-y-2 text-xs">
                {(ticketQ.data.comments ?? []).map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      'rounded-lg border p-2',
                      c.isInternal && 'border-amber-300 bg-amber-50/50',
                    )}
                  >
                    {c.isInternal ? (
                      <span className="font-semibold text-amber-700">Internal · </span>
                    ) : null}
                    {c.body}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a ticket</p>
          )}
        </div>
      ) : null}

      {tab === 'faq' ? <FaqAdminPanel categories={faqQ.data ?? []} /> : null}

      {tab === 'agents' ? (
        <AgentsPanel
          agents={agentsQ.data ?? []}
          departments={deptsQ.data ?? []}
          currentUserId={session?.user?.id as string | undefined}
          preferredLang={preferredLang}
          onPreferredLangChange={setPreferredLang}
        />
      ) : null}

      {tab === 'settings' ? (
        <SettingsPanel
          settings={settingsQ.data}
          onSave={async (body) => {
            await updateSupportSettings(body);
            await qc.invalidateQueries({ queryKey: ['support', 'settings'] });
          }}
        />
      ) : null}
    </div>
  );
}

function AssignAgentRow({ chatId, onAssigned }: { chatId: string; onAssigned: () => void }) {
  const agentsQ = useQuery({
    queryKey: ['support', 'agents'],
    queryFn: fetchSupportAgents,
  });
  return (
    <div className="flex flex-wrap gap-2 border-t px-3 py-2">
      <span className="text-xs text-muted-foreground self-center">Assign:</span>
      {(agentsQ.data ?? []).map((a) => (
        <Button
          key={a.id}
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => void assignSupportChat(chatId, a.id).then(onAssigned)}
        >
          {a.displayName ?? a.userId.slice(0, 8)}
          {a.isOnline ? ' ●' : ''}
        </Button>
      ))}
    </div>
  );
}

function FaqAdminPanel({
  categories,
}: {
  categories: Array<{
    id: string;
    name: string;
    articles: Array<{
      id: string;
      question: string;
      answer: string;
      isPublished: boolean;
    }>;
  }>;
}) {
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-4 space-y-2">
        <Label>New FAQ article</Label>
        <select
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Input
          placeholder="Question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <textarea
          className="min-h-24 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          placeholder="Answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
        />
        <Button
          size="sm"
          disabled={!categoryId || !question.trim() || !answer.trim()}
          onClick={() =>
            void createSupportFaqArticle({
              categoryId,
              question,
              answer,
              isPublished: true,
            }).then(() => {
              setQuestion('');
              setAnswer('');
              return qc.invalidateQueries({ queryKey: ['support', 'faq'] });
            })
          }
        >
          Publish FAQ
        </Button>
      </div>
      {categories.map((c) => (
        <div key={c.id} className="rounded-2xl border p-4">
          <h3 className="font-semibold">{c.name}</h3>
          <ul className="mt-2 space-y-2">
            {c.articles.map((a) => (
              <li key={a.id} className="rounded-lg bg-muted/40 p-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{a.question}</p>
                    <p className="text-muted-foreground">{a.answer}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void updateSupportFaqArticle(a.id, {
                        isPublished: !a.isPublished,
                      }).then(() => qc.invalidateQueries({ queryKey: ['support', 'faq'] }))
                    }
                  >
                    {a.isPublished ? 'Unpublish' : 'Publish'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function AgentsPanel({
  agents,
  departments,
  currentUserId,
  preferredLang,
  onPreferredLangChange,
}: {
  agents: Array<{
    id: string;
    userId: string;
    displayName?: string | null;
    isOnline: boolean;
    preferredLang?: string;
    department?: { name: string } | null;
  }>;
  departments: Array<{ id: string; name: string }>;
  currentUserId?: string;
  preferredLang: string;
  onPreferredLangChange: (lang: string) => void;
}) {
  const qc = useQueryClient();
  const [deptId, setDeptId] = useState(departments[0]?.id ?? '');
  const [name, setName] = useState('');

  return (
    <div className="space-y-4">
      {currentUserId ? (
        <div className="rounded-2xl border p-4 space-y-2">
          <p className="text-sm font-semibold">My agent profile</p>
          <p className="text-xs text-muted-foreground">
            Set your reading language (e.g. Tamil) so student Garo/Khasi messages are translated for
            you.
          </p>
          <select
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            value={deptId}
            onChange={(e) => setDeptId(e.target.value)}
          >
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
            value={preferredLang}
            onChange={(e) => onPreferredLangChange(e.target.value)}
          >
            {LANG_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                I read messages in {l.label}
              </option>
            ))}
          </select>
          <Input
            placeholder="Display name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button
            size="sm"
            onClick={() =>
              void upsertSupportAgent({
                userId: currentUserId,
                departmentId: deptId || null,
                displayName: name || undefined,
                preferredLang,
              }).then(() => qc.invalidateQueries({ queryKey: ['support', 'agents'] }))
            }
          >
            Save agent profile
          </Button>
        </div>
      ) : null}
      <ul className="space-y-2">
        {agents.map((a) => (
          <li key={a.id} className="rounded-xl border p-3 text-sm">
            <span
              className={cn(
                'mr-2 inline-block h-2 w-2 rounded-full',
                a.isOnline ? 'bg-emerald-500' : 'bg-slate-300',
              )}
            />
            {a.displayName ?? a.userId}
            <span className="ml-2 text-muted-foreground">
              {a.department?.name ?? 'Unassigned'} · {langLabel(a.preferredLang)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SettingsPanel({
  settings,
  onSave,
}: {
  settings?: Record<string, unknown>;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [contactEmail, setContactEmail] = useState(String(settings?.contactEmail ?? ''));
  const [contactPhone, setContactPhone] = useState(String(settings?.contactPhone ?? ''));
  const [supportHours, setSupportHours] = useState(String(settings?.supportHours ?? ''));
  const [welcomeMessage, setWelcomeMessage] = useState(String(settings?.welcomeMessage ?? ''));
  const [translationEnabled, setTranslationEnabled] = useState(
    settings?.translationEnabled !== false,
  );
  const [defaultAgentLang, setDefaultAgentLang] = useState(
    String(settings?.defaultAgentLang ?? 'ta'),
  );

  return (
    <div className="max-w-lg space-y-3 rounded-2xl border p-4">
      <div>
        <Label>Contact email</Label>
        <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      </div>
      <div>
        <Label>Contact phone</Label>
        <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
      </div>
      <div>
        <Label>Support hours</Label>
        <Input value={supportHours} onChange={(e) => setSupportHours(e.target.value)} />
      </div>
      <div>
        <Label>Welcome message</Label>
        <textarea
          className="mt-1 min-h-20 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
        />
      </div>
      <div>
        <Label>Default staff reading language</Label>
        <select
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
          value={defaultAgentLang}
          onChange={(e) => setDefaultAgentLang(e.target.value)}
        >
          {LANG_OPTIONS.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={translationEnabled}
          onChange={(e) => setTranslationEnabled(e.target.checked)}
        />
        Enable AI translation (Garo/Khasi/Hindi/Tamil…)
      </label>
      <Button
        onClick={() =>
          void onSave({
            contactEmail,
            contactPhone,
            supportHours,
            welcomeMessage,
            translationEnabled,
            defaultAgentLang,
          })
        }
      >
        Save settings
      </Button>
    </div>
  );
}
