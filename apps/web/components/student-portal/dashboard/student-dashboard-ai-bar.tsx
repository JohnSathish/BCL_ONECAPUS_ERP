'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';
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
    <div className="sticky bottom-2 z-20 mt-4 rounded-2xl border border-[#1e4d8c]/25 bg-[#152a45] p-3 text-white shadow-lg sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e4d8c] ring-2 ring-[#c9a227]/50">
            <Sparkles className="h-5 w-5 text-[#c9a227]" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Hi {name}! I&apos;m your campus assistant.</p>
            <p className="text-xs text-sky-100/90">
              Ask about classes, fees, results, timetable — or open Support Centre chat.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {CHIPS.map((c) => (
            <Link
              key={c.href + c.label}
              href={c.href}
              className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-medium backdrop-blur transition hover:bg-white/20"
            >
              {c.label}
            </Link>
          ))}
          <Button
            asChild
            size="sm"
            className="rounded-xl bg-[#c9a227] font-semibold text-slate-900 hover:bg-[#d4b03a]"
          >
            <Link href="/student/support/chat">Ask Now</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
