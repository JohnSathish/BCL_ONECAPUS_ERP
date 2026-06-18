'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Bot, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { askLibraryAssistant, fetchLibraryAssistantPrompts } from '@/services/library';
import { cn } from '@/utils/cn';

type Message = {
  role: 'user' | 'assistant';
  text: string;
  links?: Array<{ label: string; href: string }>;
  followUps?: string[];
};

export function LibraryKnowledgeAssistant({
  className,
  compact,
  studentView,
}: {
  className?: string;
  compact?: boolean;
  studentView?: boolean;
}) {
  const enabled = useAuthQueryEnabled();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  const prompts = useQuery({
    queryKey: ['library', 'assistant', 'prompts', studentView ? 'student' : 'admin'],
    queryFn: fetchLibraryAssistantPrompts,
    enabled,
  });

  const askMut = useMutation({
    mutationFn: (question: string) => askLibraryAssistant(question),
    onSuccess: (res, question) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: question },
        {
          role: 'assistant',
          text: res.answer,
          links: res.links,
          followUps: res.suggestedFollowUps,
        },
      ]);
      setQuery('');
    },
  });

  useEffect(() => {
    if (messages.length || !prompts.data?.length) return;
    setMessages([
      {
        role: 'assistant',
        text: studentView
          ? 'Ask about due dates, recommendations, book locations, or search the catalogue.'
          : 'Ask about footfall, NAAC reports, popular titles, or search the catalogue.',
      },
    ]);
  }, [messages.length, prompts.data, studentView]);

  function submit(text?: string) {
    const q = (text ?? query).trim();
    if (!q || askMut.isPending) return;
    askMut.mutate(q);
  }

  const quickPrompts = prompts.data?.slice(0, compact ? 4 : 6) ?? [];

  return (
    <div className={cn('rounded-xl border bg-card p-4 shadow-sm', className)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-medium">
            <Bot className="h-4 w-4 text-primary" />
            Library Knowledge Assistant
          </h2>
          <p className="text-xs text-muted-foreground">
            Rule-based answers from live catalogue and circulation data
          </p>
        </div>
      </div>

      {quickPrompts.length ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => submit(prompt)}
              disabled={askMut.isPending}
              className="rounded-full border bg-muted/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder="Ask about books, loans, footfall, NAAC…"
          disabled={askMut.isPending}
        />
        <Button
          size="sm"
          className="shrink-0"
          disabled={!query.trim() || askMut.isPending}
          onClick={() => submit()}
        >
          {askMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
        </Button>
      </div>

      {messages.length ? (
        <div
          className={cn(
            'mt-4 space-y-3 overflow-y-auto rounded-xl border bg-muted/30 p-3',
            compact ? 'max-h-48' : 'max-h-72',
          )}
        >
          {messages.slice(-8).map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              className={cn(
                'rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                msg.role === 'user' ? 'ml-6 bg-background' : 'mr-6 bg-primary/10',
              )}
            >
              {msg.role === 'assistant' ? (
                <Sparkles className="mb-1 inline h-3.5 w-3.5 text-primary" />
              ) : null}{' '}
              {msg.text}
              {msg.links?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.links.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      {link.label} →
                    </Link>
                  ))}
                </div>
              ) : null}
              {msg.role === 'assistant' && msg.followUps?.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {msg.followUps.slice(0, 3).map((followUp) => (
                    <button
                      key={followUp}
                      type="button"
                      onClick={() => submit(followUp)}
                      className="rounded-full border border-primary/20 bg-background px-2 py-0.5 text-[10px] text-primary hover:bg-primary/5"
                    >
                      {followUp}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {askMut.isError ? (
        <p className="mt-2 text-xs text-red-600">Could not get an answer. Please try again.</p>
      ) : null}
    </div>
  );
}
