'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSupportRealtime } from '@/hooks/use-support-realtime';
import { useAuth } from '@/hooks/use-auth';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import {
  createStudentTicket,
  fetchStudentChat,
  fetchStudentChats,
  fetchStudentSupportFaq,
  fetchStudentSupportMeta,
  fetchStudentTickets,
  closeStudentChat,
  markStudentChatRead,
  openStudentChat,
  sendStudentChatMessage,
  sendStudentChatTyping,
  uploadStudentChatFile,
  type SupportChatMessage,
  type SupportChatThread,
} from '@/services/support-centre';
import { fetchStudentPortalMe } from '@/services/student-portal';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type OfficeFilter = 'recent' | string;

const CATEGORY_CARDS: Array<{
  category: string;
  label: string;
  icon: string;
  blurb: string;
}> = [
  { category: 'ADMISSIONS', label: 'Admissions', icon: '🎓', blurb: 'Applications & enrolment' },
  { category: 'FEES', label: 'Fees', icon: '💰', blurb: 'Payments & receipts' },
  { category: 'CERTIFICATES', label: 'Certificates', icon: '📄', blurb: 'Bonafide & documents' },
  { category: 'EXAMINATION', label: 'Examination', icon: '📝', blurb: 'Hall tickets & exams' },
  { category: 'SCHOLARSHIPS', label: 'Scholarship', icon: '🎁', blurb: 'Schemes & status' },
  { category: 'TECHNICAL', label: 'IT Support', icon: '💻', blurb: 'Login & ERP help' },
  { category: 'LIBRARY', label: 'Library', icon: '📚', blurb: 'Books & fines' },
  { category: 'HOSTEL', label: 'Hostel', icon: '🏠', blurb: 'Rooms & boarding' },
];

const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'garo', label: 'Garo' },
  { code: 'khasi', label: 'Khasi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'hi', label: 'Hindi' },
] as const;

const SMART_REPLIES: Array<{ match: RegExp; suggestions: string[] }> = [
  {
    match: /\bfee/i,
    suggestions: [
      'My fee payment is not updated.',
      'I need my fee receipt.',
      'How do I pay fees online?',
    ],
  },
  {
    match: /\bscholar/i,
    suggestions: [
      'My scholarship application is not showing.',
      'What documents are needed for scholarship?',
      'Please check my scholarship status.',
    ],
  },
  {
    match: /\b(hall|admit|exam)/i,
    suggestions: [
      'How do I download my hall ticket?',
      'My admit card is not showing.',
      'When is the exam timetable published?',
    ],
  },
  {
    match: /\b(login|password|otp)/i,
    suggestions: [
      'I cannot log in to the portal.',
      'Please reset my password.',
      'OTP is not coming to my phone.',
    ],
  },
  {
    match: /\b(bonafide|certificate)/i,
    suggestions: [
      'I need a bonafide certificate.',
      'How do I apply for a certificate?',
      'When will my certificate be ready?',
    ],
  },
];

const SUGGESTED_CHIPS = [
  'How do I pay fees?',
  'How to download hall ticket?',
  'Apply scholarship',
  'Semester registration',
  'Bonafide certificate',
];

const EMOJIS = ['👍', '🙏', '😊', '✅', '📎', '🎉'];

function officeIcon(codeOrCategory?: string | null) {
  const c = (codeOrCategory || '').toUpperCase();
  if (c.includes('ADMISSION')) return '🎓';
  if (c.includes('ACCOUNT') || c.includes('FEE') || c.includes('SCHOLAR')) return '💰';
  if (c.includes('EXAM') || c.includes('RESULT') || c.includes('CERT')) return '📝';
  if (c.includes('IT') || c.includes('TECH') || c.includes('ERP')) return '💻';
  if (c.includes('LIBRARY')) return '📚';
  if (c.includes('HOSTEL')) return '🏠';
  if (c.includes('TRANSPORT')) return '🚌';
  return '💬';
}

function relativeTime(iso?: string | null) {
  if (!iso) return '';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

function receiptLabel(status?: string) {
  const s = (status || 'SENT').toUpperCase();
  if (s === 'READ') return '✓✓ Read';
  if (s === 'DELIVERED') return '✓✓ Delivered';
  return '✓ Sent';
}

function StudentBubble({ msg, mine }: { msg: SupportChatMessage; mine: boolean }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const hasXlate = Boolean(msg.bodyTranslated?.trim());

  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
          mine
            ? 'rounded-br-md bg-[#1e4d8c] text-white'
            : 'rounded-bl-md border border-slate-200/80 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
        )}
      >
        {hasXlate && !mine ? (
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              Translation
            </p>
            <p className="whitespace-pre-wrap leading-relaxed">
              {showOriginal ? msg.bodyOriginal : msg.bodyTranslated}
            </p>
            <button
              type="button"
              className="text-[10px] underline opacity-80"
              onClick={() => setShowOriginal((v) => !v)}
            >
              {showOriginal ? 'Show translation' : 'Show original'}
            </button>
          </div>
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed">{msg.bodyOriginal}</p>
        )}

        {msg.attachments?.map((a) => {
          const url = resolveUploadAssetUrl(a.storageUrl) || a.storageUrl;
          const isImg = (a.mimeType || '').startsWith('image/');
          return (
            <div key={a.id} className="mt-2">
              {isImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={url}
                  alt={a.fileName}
                  className="max-h-40 rounded-xl border object-cover"
                />
              ) : null}
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'mt-1 block truncate text-xs underline',
                  mine ? 'text-sky-100' : 'text-sky-700 dark:text-sky-300',
                )}
              >
                📎 {a.fileName}
              </a>
            </div>
          );
        })}

        <div
          className={cn(
            'mt-1.5 flex items-center gap-2 text-[10px]',
            mine ? 'text-sky-100/90' : 'text-slate-400',
          )}
        >
          <span>
            {new Date(msg.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {mine ? <span>{receiptLabel(msg.deliveryStatus)}</span> : null}
          {msg.langDetected && msg.langDetected !== 'en' ? <span>{msg.langDetected}</span> : null}
          <button
            type="button"
            className="underline decoration-dotted"
            onClick={() => void navigator.clipboard.writeText(msg.bodyOriginal)}
          >
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

export function StudentLiveChatEnterprise() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [officeFilter, setOfficeFilter] = useState<OfficeFilter>('recent');
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [studentLang, setStudentLang] = useState('en');
  const [typing, setTyping] = useState(false);
  const [toast, setToast] = useState('');
  const [faqOpenId, setFaqOpenId] = useState<string | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [showStartHub, setShowStartHub] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);
  const [rateStars, setRateStars] = useState(0);
  const [ending, setEnding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number | null>(null);

  const metaQ = useQuery({
    queryKey: ['student', 'support', 'meta'],
    queryFn: fetchStudentSupportMeta,
  });
  const meQ = useQuery({
    queryKey: ['student', 'portal', 'me'],
    queryFn: fetchStudentPortalMe,
  });
  const chatsQ = useQuery({
    queryKey: ['student', 'support', 'chats'],
    queryFn: fetchStudentChats,
    refetchInterval: 15_000,
  });
  const threadQ = useQuery({
    queryKey: ['student', 'support', 'chat', activeId],
    queryFn: () => fetchStudentChat(activeId!),
    enabled: Boolean(activeId),
  });
  const faqQ = useQuery({
    queryKey: ['student', 'support', 'faq'],
    queryFn: () => fetchStudentSupportFaq(),
  });
  const ticketsQ = useQuery({
    queryKey: ['student', 'support', 'tickets'],
    queryFn: fetchStudentTickets,
  });

  const offices = metaQ.data?.offices ?? [];
  const settings = metaQ.data?.settings;

  useEffect(() => {
    try {
      const saved = localStorage.getItem('student-support-lang');
      if (saved) setStudentLang(saved);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadQ.data?.messages?.length, activeId]);

  useEffect(() => {
    if (!activeId) return;
    void markStudentChatRead(activeId).then(() => {
      void qc.invalidateQueries({ queryKey: ['student', 'support', 'chats'] });
    });
  }, [activeId, qc]);

  useSupportRealtime(activeId, {
    onMessage: (payload) => {
      if (payload.threadId === activeId) {
        void qc.invalidateQueries({
          queryKey: ['student', 'support', 'chat', activeId],
        });
      }
      void qc.invalidateQueries({ queryKey: ['student', 'support', 'chats'] });
      if (payload.message?.senderRole === 'AGENT') {
        setToast(payload.message.bodyTranslated || payload.message.bodyOriginal || 'New reply');
        window.setTimeout(() => setToast(''), 5000);
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            new Notification('Support Centre', {
              body: payload.message.bodyTranslated || payload.message.bodyOriginal,
            });
          } else if (Notification.permission === 'default') {
            void Notification.requestPermission();
          }
        }
      }
    },
    onTyping: (payload) => {
      if (payload.threadId === activeId && payload.userId !== session?.user?.id) {
        setTyping(payload.isTyping);
      }
    },
  });

  const filteredChats = useMemo(() => {
    let rows = chatsQ.data ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (t) =>
          (t.department?.name || '').toLowerCase().includes(q) ||
          (t.category || '').toLowerCase().includes(q) ||
          (t.subject || '').toLowerCase().includes(q) ||
          (t.lastMessagePreview || '').toLowerCase().includes(q) ||
          (t.ticket?.ticketNo || '').toLowerCase().includes(q),
      );
    }
    if (officeFilter !== 'recent') {
      rows = rows.filter(
        (t) =>
          t.department?.id === officeFilter ||
          t.department?.code === officeFilter ||
          t.category === officeFilter,
      );
    }
    return rows;
  }, [chatsQ.data, search, officeFilter]);

  const activeOffice = useMemo(() => {
    const t = threadQ.data;
    if (!t) return null;
    const byId = offices.find((o) => o.id === t.department?.id);
    if (byId) return byId;
    return {
      id: t.department?.id || t.category,
      code: t.department?.code || t.category,
      name: t.department?.name || t.category.replace(/_/g, ' '),
      description: null,
      onlineAgents: 0,
      isOnline: false,
    };
  }, [threadQ.data, offices]);

  const smartSuggestions = useMemo(() => {
    const hit = SMART_REPLIES.find((r) => r.match.test(draft));
    return hit?.suggestions ?? [];
  }, [draft]);

  const startChat = async (category: string, initialMessage?: string) => {
    try {
      const thread = await openStudentChat({
        category,
        studentLang,
        initialMessage: initialMessage?.trim() || undefined,
        subject: `${category.replace(/_/g, ' ')} enquiry`,
      });
      setActiveId(thread.id);
      setShowStartHub(false);
      void qc.invalidateQueries({ queryKey: ['student', 'support', 'chats'] });
    } catch (e) {
      setToast(apiErrorMessage(e));
    }
  };

  const sendMut = useMutation({
    mutationFn: () => sendStudentChatMessage(activeId!, draft.trim()),
    onSuccess: async () => {
      setDraft('');
      await qc.invalidateQueries({
        queryKey: ['student', 'support', 'chat', activeId],
      });
      await qc.invalidateQueries({ queryKey: ['student', 'support', 'chats'] });
    },
    onError: (e) => setToast(apiErrorMessage(e)),
  });

  const onDraftChange = (value: string) => {
    setDraft(value);
    if (!activeId) return;
    void sendStudentChatTyping(activeId, true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      void sendStudentChatTyping(activeId, false);
    }, 1200);
  };

  const me = meQ.data;
  const messages = threadQ.data?.messages ?? [];

  const sidebarOffices = useMemo(() => {
    if (offices.length) return offices;
    return CATEGORY_CARDS.map((c) => ({
      id: c.category,
      code: c.category,
      name: c.label,
      description: c.blurb,
      onlineAgents: 0,
      isOnline: false,
    }));
  }, [offices]);

  return (
    <div className="flex h-[calc(100vh-8rem)] min-h-[580px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-xl dark:border-slate-800 dark:bg-slate-950">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#1e4d8c]/20 bg-gradient-to-r from-[#1e4d8c] to-[#2a5fa3] px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">Live Chat</h1>
          <p className="text-xs text-sky-100">Student Digital Assistance Centre · BCL OneCampus</p>
        </div>
        <select
          className="h-9 rounded-xl border-0 bg-white/15 px-2 text-xs text-white outline-none backdrop-blur"
          value={studentLang}
          onChange={(e) => {
            setStudentLang(e.target.value);
            try {
              localStorage.setItem('student-support-lang', e.target.value);
            } catch {
              // ignore
            }
          }}
          aria-label="Chat language"
        >
          {LANGS.map((l) => (
            <option key={l.code} value={l.code} className="text-slate-900">
              I write in {l.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          className="rounded-xl bg-[#c9a227] text-slate-900 hover:bg-[#d4b03a]"
          onClick={() => setShowStartHub(true)}
        >
          New chat
        </Button>
      </header>

      {toast ? (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {toast}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[260px_minmax(0,1.5fr)_minmax(240px,0.95fr)]">
        {/* Inbox */}
        <aside className="flex min-h-0 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-2 border-b border-slate-100 p-3 dark:border-slate-800">
            <Input
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded-xl text-sm"
              aria-label="Search conversations"
            />
            <div className="flex max-h-36 flex-wrap gap-1 overflow-y-auto">
              <button
                type="button"
                onClick={() => setOfficeFilter('recent')}
                className={cn(
                  'rounded-lg px-2 py-1 text-[11px] font-medium',
                  officeFilter === 'recent'
                    ? 'bg-[#1e4d8c] text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                📥 Recent
              </button>
              {sidebarOffices.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOfficeFilter(o.id)}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-medium',
                    officeFilter === o.id
                      ? 'bg-[#1e4d8c] text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
                  )}
                >
                  {officeIcon(o.code)} {o.name}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {chatsQ.isLoading ? (
              <p className="p-4 text-sm text-slate-400">Loading chats…</p>
            ) : filteredChats.length === 0 ? (
              <div className="space-y-3 p-4">
                <p className="text-sm text-slate-500">No chats yet. Start with an office:</p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_CARDS.slice(0, 4).map((c) => (
                    <button
                      key={c.category}
                      type="button"
                      onClick={() => void startChat(c.category)}
                      className="rounded-xl border border-slate-200 p-2 text-left text-xs hover:border-[#1e4d8c]/40 dark:border-slate-700"
                    >
                      <span className="text-base">{c.icon}</span>
                      <p className="mt-1 font-medium">{c.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              filteredChats.map((t: SupportChatThread) => {
                const active = t.id === activeId;
                const name = t.department?.name || t.category.replace(/_/g, ' ');
                const online = offices.find((o) => o.id === t.department?.id)?.isOnline ?? false;
                return (
                  <div
                    key={t.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveId(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setActiveId(t.id);
                      }
                    }}
                    className={cn(
                      'flex cursor-pointer gap-2 border-b border-slate-100 px-3 py-3 text-left transition dark:border-slate-800',
                      active
                        ? 'bg-sky-50 dark:bg-sky-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50',
                    )}
                  >
                    <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1e4d8c] to-[#2a5fa3] text-lg text-white shadow-sm">
                      {officeIcon(t.department?.code || t.category)}
                      <span
                        className={cn(
                          'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900',
                          online ? 'bg-emerald-500' : 'bg-slate-300',
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {online ? '🟢 ' : ''}
                          {name}
                        </p>
                        {(t.unreadStudent ?? 0) > 0 ? (
                          <span className="rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">
                            {t.unreadStudent}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-slate-600 dark:text-slate-300">
                        {t.lastMessagePreview || '—'}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {t.status === 'CLOSED' ? 'Ended · ' : ''}
                        {relativeTime(t.lastMessageAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Conversation */}
        <section className="flex min-h-0 flex-col bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] dark:bg-slate-950">
          {activeId && threadQ.data ? (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 bg-white/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e4d8c] text-lg text-white">
                  {officeIcon(activeOffice?.code)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">
                    {activeOffice?.name || 'Support'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {activeOffice?.isOnline ? (
                      <span className="text-emerald-600">Online · usually replies in ~5 min</span>
                    ) : (
                      <span>Offline · we will reply during office hours</span>
                    )}
                    {typing ? (
                      <span className="ml-2 animate-pulse text-sky-600">Agent is typing…</span>
                    ) : null}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setTicketSubject(
                      threadQ.data?.subject || `${threadQ.data?.category} support request`,
                    );
                    setTicketOpen(true);
                  }}
                >
                  Raise Ticket
                </Button>
                <Button size="sm" variant="ghost" className="rounded-xl" asChild>
                  <Link href="/student/support/tickets">My Tickets</Link>
                </Button>
                {threadQ.data.status !== 'CLOSED' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
                    onClick={() => setEndConfirm(true)}
                  >
                    End chat
                  </Button>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Ended
                  </span>
                )}
              </div>

              {threadQ.data.status === 'CLOSED' ? (
                <div className="border-b border-slate-200 bg-slate-100 px-4 py-2 text-center text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  This chat has ended. Start a new chat if you still need help.
                </div>
              ) : null}

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.map((m, idx) => {
                  const prev = messages[idx - 1];
                  const day = new Date(m.createdAt).toDateString();
                  const showSep = !prev || new Date(prev.createdAt).toDateString() !== day;
                  return (
                    <div key={m.id}>
                      {showSep ? (
                        <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">
                          {new Date(m.createdAt).toLocaleDateString(undefined, {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      ) : null}
                      <StudentBubble msg={m} mine={m.senderRole === 'STUDENT'} />
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {smartSuggestions.length && threadQ.data.status !== 'CLOSED' ? (
                <div className="flex flex-wrap gap-1 border-t border-slate-100 bg-white/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/70">
                  {smartSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] text-sky-800 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-200"
                      onClick={() => setDraft(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              ) : null}

              {threadQ.data.status === 'CLOSED' ? (
                <div className="border-t border-slate-200/80 bg-white p-4 text-center dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Chat ended
                    {threadQ.data.closedAt
                      ? ` · ${new Date(threadQ.data.closedAt).toLocaleString()}`
                      : ''}
                  </p>
                  <Button
                    className="mt-3 rounded-xl bg-[#1e4d8c]"
                    onClick={() => setShowStartHub(true)}
                  >
                    Start a new chat
                  </Button>
                </div>
              ) : (
                <div className="border-t border-slate-200/80 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-2 flex flex-wrap gap-1">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className="rounded-lg px-1.5 text-base hover:bg-slate-100 dark:hover:bg-slate-800"
                        onClick={() => setDraft((d) => d + e)}
                        aria-label={`Insert ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-end gap-2">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !activeId) return;
                        try {
                          await uploadStudentChatFile(activeId, file);
                          void qc.invalidateQueries({
                            queryKey: ['student', 'support', 'chat', activeId],
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
                      aria-label="Attach file"
                    >
                      📎
                    </Button>
                    <textarea
                      value={draft}
                      onChange={(e) => onDraftChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && draft.trim()) {
                          e.preventDefault();
                          sendMut.mutate();
                        }
                      }}
                      rows={2}
                      placeholder="Type your message…"
                      className="min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-[#1e4d8c] focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-950"
                      aria-label="Message composer"
                    />
                    <Button
                      className="rounded-xl bg-[#1e4d8c] hover:bg-[#163a6b]"
                      disabled={!draft.trim() || sendMut.isPending}
                      onClick={() => sendMut.mutate()}
                    >
                      Send
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="text-5xl">💬</div>
              <div>
                <p className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Chat with a college office
                </p>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Pick a category to start instantly. Write in Garo, Khasi, Tamil, Hindi, or
                  English.
                </p>
              </div>
              <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
                {CATEGORY_CARDS.map((c) => (
                  <button
                    key={c.category}
                    type="button"
                    onClick={() => void startChat(c.category)}
                    className="rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#c9a227]/60 hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                  >
                    <span className="text-2xl">{c.icon}</span>
                    <p className="mt-2 text-sm font-semibold">{c.label}</p>
                    <p className="text-[11px] text-slate-500">{c.blurb}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Support information */}
        <aside className="flex min-h-0 flex-col overflow-y-auto border-l border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Support Information
            </h2>
            <p className="text-[11px] text-slate-500">Office · FAQ · Quick ERP actions</p>
          </div>

          <div className="space-y-4 p-4">
            {activeOffice ? (
              <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Office
                </p>
                <p className="mt-1 font-semibold">
                  {officeIcon(activeOffice.code)} {activeOffice.name}
                </p>
                <p className="mt-1 text-xs">
                  Status:{' '}
                  {activeOffice.isOnline ? (
                    <span className="font-medium text-emerald-600">🟢 Online</span>
                  ) : (
                    <span className="text-slate-500">⚪ Offline</span>
                  )}
                </p>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-medium">Hours:</span>{' '}
                  {settings?.supportHours || '9:00 AM–5:00 PM'}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-medium">Response:</span> Usually within 5 minutes when
                  online
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-medium">Email:</span> {settings?.contactEmail || '—'}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-medium">Phone:</span> {settings?.contactPhone || '—'}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-700">
                Select or start a chat to see office details.
              </div>
            )}

            {me ? (
              <div className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Your profile
                </p>
                <div className="mt-2 flex items-center gap-3">
                  {me.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveUploadAssetUrl(me.photoUrl) || me.photoUrl}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e4d8c] text-sm font-semibold text-white">
                      {(me.displayFullName || me.fullName || '?')
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((p) => p[0])
                        .join('')}
                    </div>
                  )}
                  <div className="min-w-0 text-xs">
                    <p className="truncate font-semibold">{me.displayFullName || me.fullName}</p>
                    <p className="text-slate-500">{me.rollNumber || me.enrollmentNumber}</p>
                    <p className="truncate text-slate-500">
                      {me.programName || '—'}
                      {me.department ? ` · ${me.department}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Suggested questions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] hover:border-[#1e4d8c]/40 dark:border-slate-700 dark:bg-slate-800"
                    onClick={() => {
                      if (activeId) setDraft(chip);
                      else void startChat('GENERAL', chip);
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                FAQ · Instant answers
              </p>
              <div className="space-y-2">
                {(faqQ.data ?? []).flatMap((cat) =>
                  cat.articles.slice(0, 2).map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setFaqOpenId((id) => (id === a.id ? null : a.id))}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-left text-xs dark:border-slate-700"
                    >
                      <p className="font-medium text-slate-800 dark:text-slate-100">{a.question}</p>
                      {faqOpenId === a.id ? (
                        <p className="mt-1 whitespace-pre-wrap text-slate-500">{a.answer}</p>
                      ) : null}
                    </button>
                  )),
                )}
                {!faqQ.data?.length ? (
                  <p className="text-xs text-slate-400">No FAQs published yet.</p>
                ) : null}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Quick ERP actions
              </p>
              <div className="grid gap-1.5">
                {[
                  ['Fee status', '/student/fees'],
                  ['Examinations', '/student/examinations'],
                  ['Certificates', '/student/certificates'],
                  ['Registration', '/student/registration'],
                  ['Documents', '/student/documents'],
                  ['My tickets', '/student/support/tickets'],
                  ['FAQs', '/student/support/faq'],
                ].map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-[#1e4d8c] hover:bg-sky-50 dark:border-slate-700 dark:text-sky-300 dark:hover:bg-sky-950/30"
                  >
                    {label} →
                  </Link>
                ))}
              </div>
            </div>

            {(ticketsQ.data ?? []).slice(0, 3).length ? (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Recent tickets
                </p>
                <ul className="space-y-1.5">
                  {(ticketsQ.data ?? []).slice(0, 3).map((t) => (
                    <li
                      key={t.id}
                      className="rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/60"
                    >
                      <p className="font-mono text-[10px] text-sky-700 dark:text-sky-300">
                        {t.ticketNo}
                      </p>
                      <p className="truncate font-medium">{t.subject}</p>
                      <p className="text-slate-500">{t.status.replace(/_/g, ' ')}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {endConfirm && activeId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <h3 className="text-lg font-semibold">End this chat?</h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              You will not be able to send more messages in this conversation. You can start a new
              chat anytime.
            </p>
            <p className="mt-4 text-xs font-medium text-slate-500">
              Optional: rate your support experience
            </p>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={cn('text-2xl', n <= rateStars ? 'text-amber-400' : 'text-slate-300')}
                  onClick={() => setRateStars(n)}
                  aria-label={`${n} stars`}
                >
                  ★
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setEndConfirm(false);
                  setRateStars(0);
                }}
              >
                Cancel
              </Button>
              <Button
                className="rounded-xl bg-rose-600 hover:bg-rose-700"
                disabled={ending}
                onClick={async () => {
                  setEnding(true);
                  try {
                    await closeStudentChat(activeId);
                    setEndConfirm(false);
                    setToast(
                      rateStars ? `Chat ended. Thanks for rating ${rateStars}/5.` : 'Chat ended.',
                    );
                    setRateStars(0);
                    void qc.invalidateQueries({
                      queryKey: ['student', 'support', 'chat', activeId],
                    });
                    void qc.invalidateQueries({
                      queryKey: ['student', 'support', 'chats'],
                    });
                  } catch (e) {
                    setToast(apiErrorMessage(e));
                  } finally {
                    setEnding(false);
                  }
                }}
              >
                {ending ? 'Ending…' : 'End chat'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showStartHub ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">Start a conversation</h3>
                <p className="text-sm text-slate-500">Choose an office category</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowStartHub(false)}>
                Close
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {CATEGORY_CARDS.map((c) => (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => void startChat(c.category)}
                  className="rounded-2xl border border-slate-200 p-3 text-left hover:border-[#c9a227]/70 dark:border-slate-700"
                >
                  <span className="text-2xl">{c.icon}</span>
                  <p className="mt-2 text-sm font-semibold">{c.label}</p>
                  <p className="text-[11px] text-slate-500">{c.blurb}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {ticketOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <h3 className="text-lg font-semibold">Raise a ticket</h3>
            <Input
              className="mt-3"
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              placeholder="Subject"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setTicketOpen(false)}>
                Cancel
              </Button>
              <Button
                className="rounded-xl bg-[#1e4d8c]"
                disabled={!ticketSubject.trim()}
                onClick={async () => {
                  try {
                    const ticket = await createStudentTicket({
                      category: threadQ.data?.category || 'GENERAL',
                      subject: ticketSubject.trim(),
                      description: `Raised from live chat${activeId ? ` (${activeId})` : ''}.`,
                    });
                    setTicketOpen(false);
                    setToast(`Ticket ${ticket.ticketNo} created`);
                    void qc.invalidateQueries({
                      queryKey: ['student', 'support', 'tickets'],
                    });
                  } catch (e) {
                    setToast(apiErrorMessage(e));
                  }
                }}
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
