'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { Bot, Loader2, Sparkles } from 'lucide-react';
import { askDashboardAi } from '@/services/dashboard-analytics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SaaSCard, SectionTitle } from '@/components/dashboard/command-center-ui';
import { cn } from '@/utils/cn';

const QUICK_PROMPTS = [
  'How many students have pending fees?',
  "Show today's attendance summary",
  'Generate finance report',
  'List admission applications pending',
];

type Message = {
  role: 'user' | 'assistant';
  text: string;
  links?: Array<{ label: string; href: string }>;
};

export function DashboardAiAssistant({
  className,
  compact,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const askMut = useMutation({
    mutationFn: (question: string) => askDashboardAi(question),
    onSuccess: (res, question) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: question },
        { role: 'assistant', text: res.answer, links: res.links },
      ]);
      setQuery('');
    },
  });

  function submit(text?: string) {
    const q = (text ?? query).trim();
    if (!q || askMut.isPending) return;
    askMut.mutate(q);
  }

  const card = (
    <>
      <SectionTitle
        title="Ask OneCampus AI"
        subtitle="Institutional answers from live ERP data"
        action={<Bot className="h-5 w-5 text-[#2563EB]" />}
      />

      <div className="mb-3 flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => submit(prompt)}
            disabled={askMut.isPending}
            className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-[#475569] transition-colors hover:border-[#2563EB]/40 hover:bg-[#2563EB]/5 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="Ask a question..."
          className="rounded-xl"
          disabled={askMut.isPending}
        />
        <Button
          size="sm"
          className="shrink-0 rounded-xl bg-[#2563EB]"
          disabled={!query.trim() || askMut.isPending}
          onClick={() => submit()}
        >
          {askMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
        </Button>
      </div>

      {messages.length ? (
        <div
          className={cn(
            'mt-4 space-y-3 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/80 p-3',
            compact ? 'max-h-48' : 'max-h-64',
          )}
        >
          {messages.slice(-6).map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                msg.role === 'user'
                  ? 'ml-6 bg-white text-[#0F172A]'
                  : 'mr-6 bg-[#2563EB]/10 text-[#0F172A]',
              )}
            >
              {msg.role === 'assistant' ? (
                <Sparkles className="mb-1 inline h-3.5 w-3.5 text-[#2563EB]" />
              ) : null}{' '}
              {msg.text}
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
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-[#64748B]">
          Try a quick prompt above — answers use live admissions, fees, and attendance data.
        </p>
      )}

      {askMut.isError ? (
        <p className="mt-2 text-xs text-red-600">Could not get an answer. Please try again.</p>
      ) : null}
    </>
  );

  if (compact) {
    return <div className={className}>{card}</div>;
  }

  return <SaaSCard className={className}>{card}</SaaSCard>;
}
