'use client';

import { Command } from 'cmdk';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Search, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ADMIN_COMMAND_LINKS, AI_QUICK_PROMPTS } from '@/config/command-palette-items';
import { askDashboardAi } from '@/services/dashboard-analytics';
import type { DashboardAiResponse } from '@/types/dashboard-analytics';

const STAFF_COMMANDS = [
  { label: 'Staff Dashboard', href: '/staff/dashboard', keywords: 'home' },
  {
    label: 'Take Attendance',
    href: '/staff/academic/attendance-entry',
    keywords: 'attendance mark',
  },
  { label: 'Open Timetable', href: '/staff/academic/timetable', keywords: 'schedule' },
  { label: 'Upload Lesson Plan', href: '/staff/academic/lesson-plans', keywords: 'lesson' },
  { label: 'Apply Leave', href: '/staff/leave', keywords: 'leave' },
  { label: 'Download Payslip', href: '/staff/salary', keywords: 'salary pay' },
  { label: 'View Subjects', href: '/staff/academic/subjects', keywords: 'subjects' },
  { label: 'My Profile', href: '/staff/profile', keywords: 'profile' },
  { label: 'Portal Settings', href: '/staff/settings', keywords: 'settings' },
  { label: 'Notifications', href: '/staff/notifications', keywords: 'alerts' },
];

function looksLikeAiQuestion(text: string) {
  const q = text.trim().toLowerCase();
  if (q.length < 8) return false;
  if (q.endsWith('?')) return true;
  return /^(how|what|show|list|generate|tell|who|when|where|why)\b/.test(q);
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [aiResult, setAiResult] = useState<DashboardAiResponse | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isStaffPortal = pathname.startsWith('/staff');
  const isAdminPortal = pathname.startsWith('/admin');

  const navItems = useMemo(
    () =>
      isStaffPortal ? STAFF_COMMANDS : isAdminPortal ? ADMIN_COMMAND_LINKS : ADMIN_COMMAND_LINKS,
    [isStaffPortal, isAdminPortal],
  );

  const askMut = useMutation({
    mutationFn: (question: string) => askDashboardAi(question),
    onSuccess: (res) => setAiResult(res),
  });

  function runAi(question: string) {
    const q = question.trim();
    if (!q) return;
    setAiResult(null);
    askMut.mutate(q);
  }

  function closePalette() {
    setOpen(false);
    setSearch('');
    setAiResult(null);
    askMut.reset();
  }

  function go(href: string) {
    closePalette();
    router.push(href);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setAiResult(null);
      askMut.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when dialog closes
  }, [open]);

  const showAskAiItem = search.trim().length >= 4 && !isStaffPortal;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-xl border border-border/80 bg-card/60 px-3 py-2 text-sm text-muted-foreground backdrop-blur transition hover:bg-muted/40 md:flex"
        aria-label="Open command palette"
      >
        <Search className="h-4 w-4" />
        <span>
          {isStaffPortal ? 'Search staff portal…' : 'Search students, staff, fees, reports…'}
        </span>
        <kbd className="ml-6 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl overflow-hidden p-0">
          <DialogTitle className="sr-only">Campus search and OneCampus AI</DialogTitle>
          <Command
            className="rounded-2xl"
            shouldFilter={!askMut.isPending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && looksLikeAiQuestion(search) && !isStaffPortal) {
                e.preventDefault();
                runAi(search);
              }
            }}
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder={
                  isStaffPortal
                    ? 'Search staff dashboard, attendance, leave…'
                    : 'Ask OneCampus AI or search students, staff, fees, reports…'
                }
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {askMut.isPending ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
            </div>

            {aiResult ? (
              <div className="border-b border-border bg-primary/5 px-4 py-3 text-sm">
                <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  OneCampus AI
                </p>
                <p className="whitespace-pre-wrap text-foreground">{aiResult.answer}</p>
                {aiResult.links?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {aiResult.links.map((link) => (
                      <button
                        key={link.href}
                        type="button"
                        onClick={() => go(link.href)}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        {link.label} →
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <Command.List className="max-h-80 overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                {isStaffPortal
                  ? 'No matching commands.'
                  : 'No matches — press Enter to ask OneCampus AI.'}
              </Command.Empty>

              {!isStaffPortal && showAskAiItem ? (
                <Command.Group heading="OneCampus AI" className="px-2 py-2">
                  <Command.Item
                    value={`ask-ai ${search}`}
                    onSelect={() => runAi(search)}
                    className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-primary/10 aria-selected:text-primary"
                  >
                    <Sparkles className="mr-2 inline h-3.5 w-3.5" />
                    Ask OneCampus AI: &quot;{search}&quot;
                  </Command.Item>
                </Command.Group>
              ) : null}

              {!isStaffPortal ? (
                <Command.Group heading="OneCampus AI" className="px-2 py-2">
                  <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Quick prompts
                  </p>
                  {AI_QUICK_PROMPTS.map((prompt) => (
                    <Command.Item
                      key={prompt}
                      value={prompt}
                      onSelect={() => runAi(prompt)}
                      className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-primary/10 aria-selected:text-primary"
                    >
                      {prompt}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              <Command.Group heading="Navigate" className="px-2 py-2">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isStaffPortal ? 'Staff portal' : 'Admin modules'}
                </p>
                {navItems.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={`${item.label} ${'keywords' in item ? item.keywords : ''}`}
                    onSelect={() => go(item.href)}
                    className="cursor-pointer rounded-lg px-3 py-2 text-sm aria-selected:bg-primary/10 aria-selected:text-primary"
                  >
                    {item.label}
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>

            {!isStaffPortal ? (
              <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
                Tip: type a question and press <kbd className="rounded border px-1">Enter</kbd> — or
                pick a quick prompt. Answers use live ERP data.
              </div>
            ) : null}
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
