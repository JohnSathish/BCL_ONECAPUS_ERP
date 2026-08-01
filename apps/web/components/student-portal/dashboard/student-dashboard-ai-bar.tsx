'use client';

import Link from 'next/link';
import { Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CHIPS = [
  { label: 'When is my next class?', href: '/student/timetable' },
  { label: 'How much fee is pending?', href: '/student/fees' },
  { label: 'Download hall ticket', href: '/student/examinations' },
  { label: 'Talk to support', href: '/student/support/chat' },
];

export function StudentDashboardAiBar({ firstName }: { firstName?: string }) {
  const name = firstName || 'there';
  return (
    <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f2744] via-[#152a45] to-[#1a3a66] p-3 text-white shadow-lg sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <Bot className="h-5 w-5 text-sky-200" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Hi {name}! I&apos;m your campus assistant.</p>
            <p className="text-xs text-sky-100/80">
              Ask about classes, fees, results, or open Support Centre chat.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {CHIPS.map((c) => (
            <Link
              key={c.href + c.label}
              href={c.href}
              className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-medium backdrop-blur transition hover:bg-white/20"
            >
              {c.label}
            </Link>
          ))}
          <Button
            asChild
            size="sm"
            className="rounded-full bg-amber-400 px-4 font-bold text-slate-900 hover:bg-amber-300"
          >
            <Link href="/student/support/chat">Ask Now</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
