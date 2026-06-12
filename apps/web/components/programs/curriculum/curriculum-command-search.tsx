'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';

import { cn } from '@/utils/cn';

const RECENT_SEARCHES_KEY = 'curriculum-recent-searches';
const MAX_RECENT = 5;

const QUICK_FILTERS = [
  { id: 'missing-faculty', label: 'Missing faculty', patch: { quickToggle: 'MISSING_FACULTY' } },
  { id: 'shared-pools', label: 'Shared pools', patch: { quickToggle: 'SHARED_POOLS' } },
  { id: 'unmapped', label: 'Unmapped courses', patch: { mappingStatus: 'UNMAPPED' } },
  { id: 'labs', label: 'Labs', patch: { quickToggle: 'LABS' } },
] as const;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onQuickFilter: (patch: Record<string, string>) => void;
  className?: string;
};

function loadRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string) {
  if (!term.trim() || typeof window === 'undefined') return;
  const next = [term.trim(), ...loadRecent().filter((t) => t !== term.trim())].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}

export function CurriculumCommandSearch({ value, onChange, onQuickFilter, className }: Props) {
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const showDropdown = open && (value.length > 0 || recent.length > 0);

  const groups = useMemo(() => {
    const items: {
      heading: string;
      entries: { id: string; label: string; action: () => void }[];
    }[] = [];
    if (recent.length && !value.trim()) {
      items.push({
        heading: 'Recent',
        entries: recent.map((term) => ({
          id: `recent-${term}`,
          label: term,
          action: () => {
            onChange(term);
            setOpen(false);
          },
        })),
      });
    }
    items.push({
      heading: 'Quick filters',
      entries: QUICK_FILTERS.map((q) => ({
        id: q.id,
        label: q.label,
        action: () => {
          onQuickFilter(q.patch as Record<string, string>);
          setOpen(false);
        },
      })),
    });
    return items;
  }, [recent, value, onChange, onQuickFilter]);

  return (
    <div ref={containerRef} className={cn('relative min-w-[200px] flex-1', className)}>
      <Command shouldFilter={false} className="overflow-visible bg-transparent">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Command.Input
            value={value}
            onValueChange={(v) => {
              onChange(v);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) {
                saveRecent(value);
                setRecent(loadRecent());
                setOpen(false);
              }
              if (e.key === 'Escape') setOpen(false);
            }}
            placeholder="Search code, title, faculty, section…"
            className="h-8 w-full rounded-full border border-border/60 bg-background/80 pl-8 pr-16 text-xs outline-none ring-primary/30 placeholder:text-muted-foreground focus:ring-1"
          />
          <kbd className="pointer-events-none absolute right-2.5 hidden rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">
            /
          </kbd>
        </div>
        {showDropdown ? (
          <Command.List className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-y-auto rounded-xl border border-border/60 bg-popover p-1 shadow-lg">
            <Command.Empty className="py-4 text-center text-xs text-muted-foreground">
              Type to search curriculum
            </Command.Empty>
            {groups.map((group) => (
              <Command.Group key={group.heading} heading={group.heading}>
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.heading}
                </p>
                {group.entries.map((entry) => (
                  <Command.Item
                    key={entry.id}
                    value={entry.label}
                    onSelect={entry.action}
                    className="cursor-pointer rounded-lg px-2 py-1.5 text-xs aria-selected:bg-primary/10 aria-selected:text-primary"
                  >
                    {entry.label}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        ) : null}
      </Command>
    </div>
  );
}
