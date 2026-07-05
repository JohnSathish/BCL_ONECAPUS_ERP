'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import {
  BarChart3,
  BookOpen,
  Bot,
  Download,
  FileSpreadsheet,
  GraduationCap,
  IndianRupee,
  Loader2,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  chatWithAiAssistant,
  confirmAiAction,
  downloadAiFile,
  getAiSessionId,
  selectAiReportFields,
  type AiChatResponse,
  type AiChartPayload,
  type AiConfirmationPayload,
  type AiFieldOption,
} from '@/services/ai-assistant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import { cn } from '@/utils/cn';

type Message = {
  role: 'user' | 'assistant';
  text: string;
  links?: AiChatResponse['links'];
  fieldOptions?: AiFieldOption[];
  downloads?: AiChatResponse['downloads'];
  table?: AiChatResponse['table'];
  chart?: AiChartPayload;
  confirmation?: AiConfirmationPayload;
  suggestedFollowUps?: string[];
  source?: AiChatResponse['source'];
  knowledgeSource?: AiChatResponse['knowledgeSource'];
};

const ACTION_CARDS = [
  {
    id: 'reports',
    label: 'Reports',
    icon: FileSpreadsheet,
    prompts: [
      'Generate student report',
      'Generate fee defaulters',
      "Generate today's attendance report",
      'Create Excel Report',
      'Download Admission Register',
    ],
  },
  {
    id: 'academic',
    label: 'Academic',
    icon: GraduationCap,
    prompts: [
      'What is the credit for MDC-110?',
      'Show Semester 1 course details',
      'Can Semester III students change their Major?',
      'Show all Semester III students with pending fees',
      'What is the attendance requirement?',
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: IndianRupee,
    prompts: [
      'How many students have pending fees?',
      'Fee Collection Summary',
      'Generate fee report',
      "Show today's collection",
    ],
  },
  {
    id: 'staff',
    label: 'Staff',
    icon: Users,
    prompts: ['Search Staff', 'Faculty workload', 'Find staff'],
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: BookOpen,
    prompts: [
      'Explain Semester 1',
      'Explain VAC-140',
      'List all AEC courses',
      'Compare Semester 1 and Semester 2',
      'Generate Certificates',
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    prompts: [
      'Admission Trends',
      'Admission statistics',
      'Attendance Analysis',
      'Gender Distribution',
      'Fee collection chart',
    ],
  },
] as const;

const SUGGESTED_QUESTIONS = [
  'What is the credit for MDC-110?',
  'Show Semester 1 course details',
  'How many credits are required for FYUP?',
  "Generate today's attendance report",
  'Generate fee defaulters',
  'Find Student',
];

export function DashboardAiAssistant({
  className,
  compact,
  variant = 'card',
}: {
  className?: string;
  compact?: boolean;
  /** Full-width hero layout for AI-first dashboard */
  variant?: 'card' | 'hero';
}) {
  const isHero = variant === 'hero';
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [activeCard, setActiveCard] = useState<string | null>('reports');
  const sessionId = useMemo(() => getAiSessionId(), []);

  const activePrompts = useMemo(() => {
    const card = ACTION_CARDS.find((c) => c.id === activeCard);
    return card?.prompts ?? SUGGESTED_QUESTIONS;
  }, [activeCard]);

  const askMut = useMutation({
    mutationFn: (question: string) => chatWithAiAssistant(question, sessionId),
    onSuccess: (res, question) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: question },
        {
          role: 'assistant',
          text: res.answer,
          links: res.links,
          fieldOptions: res.fieldOptions,
          downloads: res.downloads,
          table: res.table,
          chart: res.chart,
          confirmation: res.confirmation,
          suggestedFollowUps: res.suggestedFollowUps,
          source: res.source,
          knowledgeSource: res.knowledgeSource,
        },
      ]);
      if (res.fieldOptions?.length) {
        setSelectedFields(res.fieldOptions.filter((f) => f.selected).map((f) => f.key));
      }
      setQuery('');
    },
  });

  const fieldsMut = useMutation({
    mutationFn: () => selectAiReportFields(sessionId, selectedFields, 'xlsx'),
    onSuccess: (res) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.answer,
          links: res.links,
          downloads: res.downloads,
          table: res.table,
          chart: res.chart,
          suggestedFollowUps: res.suggestedFollowUps,
        },
      ]);
      setSelectedFields([]);
    },
  });

  const confirmMut = useMutation({
    mutationFn: (confirmationId: string) => confirmAiAction(sessionId, confirmationId),
    onSuccess: (res) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.answer,
          links: res.links,
          downloads: res.downloads,
          suggestedFollowUps: res.suggestedFollowUps,
        },
      ]);
    },
  });

  function submit(text?: string) {
    const q = (text ?? query).trim();
    if (!q || askMut.isPending || fieldsMut.isPending) return;
    askMut.mutate(q);
  }

  function toggleField(key: string) {
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  const pending = askMut.isPending || fieldsMut.isPending || confirmMut.isPending;

  const body = (
    <>
      <div className={cn('flex flex-wrap items-start justify-between gap-3', isHero && 'mb-1')}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB]/10">
              <Bot className="h-5 w-5 text-[#2563EB]" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-[#0F172A] dark:text-foreground">
                OneCampus AI Assistant
              </h2>
              <p className="text-xs text-[#64748B] sm:text-sm">
                Ask questions, generate reports, analyze institutional data and automate
                administrative tasks.
              </p>
            </div>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
          Live ERP data
        </span>
      </div>

      <div className={cn('mt-4 flex gap-2', isHero && 'max-w-4xl')}>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="Ask anything — reports, fees, attendance, students…"
          className="h-11 rounded-xl border-slate-200 bg-white text-sm shadow-sm"
          disabled={pending}
        />
        <Button
          className="h-11 shrink-0 rounded-xl bg-[#2563EB] px-5"
          disabled={!query.trim() || pending}
          onClick={() => submit()}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
        </Button>
      </div>

      {/* Action cards */}
      <div className="mt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
          AI Actions
        </p>
        <div className="flex flex-wrap gap-2">
          {ACTION_CARDS.map((card) => {
            const Icon = card.icon;
            const on = activeCard === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => setActiveCard(on ? null : card.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all',
                  on
                    ? 'border-[#2563EB] bg-[#2563EB] text-white shadow-sm'
                    : 'border-slate-200 bg-white text-[#475569] hover:border-[#2563EB]/40',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {card.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompts for active card */}
      <div className="mt-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
          Suggested questions
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(activeCard ? activePrompts : SUGGESTED_QUESTIONS).map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => submit(prompt)}
              disabled={pending}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-[#475569] transition-colors hover:border-[#2563EB]/40 hover:bg-[#2563EB]/5 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div
        className={cn(
          'mt-4 overflow-y-auto rounded-2xl border border-slate-100 bg-gradient-to-b from-slate-50/90 to-white p-3',
          isHero ? 'min-h-[280px] max-h-[420px]' : compact ? 'max-h-56' : 'max-h-80',
        )}
      >
        {messages.length ? (
          <div className="space-y-3">
            {messages.slice(-10).map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={cn(
                  'rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
                  msg.role === 'user'
                    ? 'ml-8 bg-white text-[#0F172A] ring-1 ring-slate-100'
                    : 'mr-4 bg-[#2563EB]/8 text-[#0F172A] ring-1 ring-[#2563EB]/10',
                )}
              >
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                  {msg.role === 'user' ? 'You' : 'AI'}
                </p>
                {msg.role === 'assistant' ? (
                  <Sparkles className="mb-1 mr-1 inline h-3.5 w-3.5 text-[#2563EB]" />
                ) : null}
                <span className="whitespace-pre-wrap">{msg.text}</span>

                {msg.source === 'knowledge' && msg.knowledgeSource ? (
                  <p className="mt-2 text-[10px] font-medium text-[#2563EB]">
                    Knowledge Base
                    {msg.knowledgeSource.documentTitle
                      ? ` · ${msg.knowledgeSource.documentTitle}`
                      : ''}
                    {msg.knowledgeSource.section ? ` · ${msg.knowledgeSource.section}` : ''}
                    {msg.knowledgeSource.pageRef ? ` · p. ${msg.knowledgeSource.pageRef}` : ''}
                  </p>
                ) : null}

                {msg.source === 'hybrid' ? (
                  <p className="mt-2 text-[10px] font-medium text-violet-700">
                    Hybrid answer — Knowledge Base + Live ERP
                    {msg.knowledgeSource?.documentTitle
                      ? ` · ${msg.knowledgeSource.documentTitle}`
                      : ''}
                  </p>
                ) : null}

                {msg.fieldOptions?.length ? (
                  <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[11px] font-semibold text-[#475569]">Select columns</p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.fieldOptions.map((field) => {
                        const on = selectedFields.includes(field.key);
                        return (
                          <button
                            key={field.key}
                            type="button"
                            onClick={() => toggleField(field.key)}
                            className={cn(
                              'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                              on
                                ? 'border-[#2563EB] bg-[#2563EB] text-white'
                                : 'border-slate-200 bg-slate-50 text-slate-600',
                            )}
                          >
                            {on ? '✓ ' : ''}
                            {field.label}
                          </button>
                        );
                      })}
                    </div>
                    <Button
                      size="sm"
                      className="h-8 rounded-lg bg-[#2563EB] text-xs"
                      disabled={!selectedFields.length || pending}
                      onClick={() => fieldsMut.mutate()}
                    >
                      Generate Excel
                    </Button>
                  </div>
                ) : null}

                {msg.chart?.series?.length ? (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-[11px] font-semibold text-slate-700">
                      {msg.chart.title}
                    </p>
                    <div className="space-y-1.5">
                      {msg.chart.series.slice(0, 8).map((point) => {
                        const max = Math.max(...msg.chart!.series.map((s) => s.value), 1);
                        const pct = Math.round((point.value / max) * 100);
                        return (
                          <div key={point.label} className="flex items-center gap-2 text-[11px]">
                            <span className="w-24 shrink-0 truncate text-slate-600">
                              {point.label}
                            </span>
                            <div className="h-2.5 flex-1 rounded-full bg-slate-100">
                              <div
                                className="h-2.5 rounded-full bg-[#2563EB]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-12 text-right font-semibold text-slate-700">
                              {point.value}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {msg.confirmation ? (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[12px] text-amber-900">{msg.confirmation.summary}</p>
                    <Button
                      size="sm"
                      className={cn(
                        'mt-2 h-8 rounded-lg text-xs',
                        msg.confirmation.danger
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-[#2563EB]',
                      )}
                      disabled={pending}
                      onClick={() => confirmMut.mutate(msg.confirmation!.confirmationId)}
                    >
                      {msg.confirmation.actionLabel}
                    </Button>
                  </div>
                ) : null}

                {msg.downloads?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.downloads.map((file) => (
                      <button
                        key={file.filename}
                        type="button"
                        onClick={() => downloadAiFile(file)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#2563EB]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#2563EB] hover:bg-[#2563EB]/5"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {file.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {msg.table?.rows?.length ? (
                  <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-left text-[11px]">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          {msg.table.columns.map((col) => (
                            <th key={col.key} className="px-2.5 py-1.5 font-semibold">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {msg.table.rows.slice(0, 20).map((row, ri) => (
                          <tr key={ri} className="border-t border-slate-100">
                            {msg.table!.columns.map((col) => (
                              <td key={col.key} className="px-2.5 py-1.5 text-slate-700">
                                {String(row[col.key] ?? '—')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {msg.links?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.links.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="text-xs font-semibold text-[#2563EB] hover:underline"
                      >
                        {link.label} →
                      </Link>
                    ))}
                  </div>
                ) : null}

                {msg.suggestedFollowUps?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {msg.suggestedFollowUps.map((follow) => (
                      <button
                        key={follow}
                        type="button"
                        onClick={() => submit(follow)}
                        disabled={pending}
                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 hover:border-[#2563EB]/40"
                      >
                        {follow}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center px-4 text-center">
            <Bot className="mb-2 h-8 w-8 text-[#2563EB]/40" />
            <p className="text-sm font-semibold text-[#0F172A]">Your campus intelligence layer</p>
            <p className="mt-1 max-w-md text-xs text-[#64748B]">
              Pick an AI action above or type a question. I can search records, generate Excel
              reports, summarize fees and attendance, and guide workflows — using live ERP data and
              your permissions.
            </p>
          </div>
        )}
      </div>

      {askMut.isError || fieldsMut.isError || confirmMut.isError ? (
        <p className="mt-2 text-xs text-red-600">Could not get an answer. Please try again.</p>
      ) : null}
    </>
  );

  if (compact && !isHero) {
    return <div className={className}>{body}</div>;
  }

  return (
    <SaaSCard
      className={cn(
        isHero &&
          'border-[#2563EB]/20 bg-gradient-to-br from-white via-white to-[#2563EB]/5 shadow-md',
        className,
      )}
    >
      {!isHero ? (
        <SectionTitle
          title="OneCampus AI Assistant"
          subtitle="Ask questions, generate reports, analyze institutional data and automate administrative tasks."
          action={<Bot className="h-5 w-5 text-[#2563EB]" />}
        />
      ) : null}
      {body}
    </SaaSCard>
  );
}
