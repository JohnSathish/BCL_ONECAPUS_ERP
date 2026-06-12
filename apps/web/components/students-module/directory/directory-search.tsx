'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';

import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/utils/cn';

const RECENT_KEY = 'directory-recent-searches';
const MAX_RECENT = 5;

type Props = {
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
  className?: string;
};

function loadRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(term: string) {
  if (!term.trim() || typeof window === 'undefined') return;
  const trimmed = term.trim();
  const next = [trimmed, ...loadRecent().filter((s) => s !== trimmed)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function DirectorySearch({ value, onChange, loading, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const debounced = useDebouncedValue(value, 300);

  useEffect(() => {
    if (debounced.trim()) saveRecent(debounced);
  }, [debounced]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const showRecent = focused && !value && recent.length > 0;

  return (
    <div className={cn('relative min-w-0 flex-1', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setFocused(true);
            setRecent(loadRecent());
          }}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder="Search name, reg no, roll no, Aadhaar, mobile, RFID, email…"
          className={cn(
            'glass-card h-8 w-full rounded-lg border border-border/60 bg-background/60 pl-9 pr-20 text-xs',
            'placeholder:text-muted-foreground/70 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30',
          )}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : null}
          {value ? (
            <button
              type="button"
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => onChange('')}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <kbd className="hidden rounded border border-border/80 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
            ⌘K
          </kbd>
        </div>
      </div>
      {showRecent ? (
        <div className="glass-card absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-border/80 p-2 shadow-lg">
          <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Recent
          </p>
          {recent.map((term) => (
            <button
              key={term}
              type="button"
              className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/60"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(term)}
            >
              {term}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
