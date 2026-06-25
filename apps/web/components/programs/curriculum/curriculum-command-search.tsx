'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

type PanelPosition = {
  top: number;
  left: number;
  width: number;
};

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
  const [mounted, setMounted] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRecent(loadRecent());
    setMounted(true);
  }, []);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPanelPosition({
      top: rect.bottom + 6,
      left: rect.left,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    window.addEventListener('resize', updatePanelPosition);
    window.addEventListener('scroll', updatePanelPosition, true);
    return () => {
      window.removeEventListener('resize', updatePanelPosition);
      window.removeEventListener('scroll', updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

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

  const dropdownPanel =
    showDropdown && panelPosition && mounted
      ? createPortal(
          <div
            ref={panelRef}
            style={{
              top: panelPosition.top,
              left: panelPosition.left,
              width: panelPosition.width,
            }}
            className="fixed z-[200] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl ring-1 ring-border/40"
          >
            <Command shouldFilter={false} className="bg-card">
              <Command.List className="max-h-64 overflow-y-auto bg-card p-1">
                <Command.Empty className="py-4 text-center text-xs text-muted-foreground">
                  Type to search curriculum
                </Command.Empty>
                {groups.map((group) => (
                  <Command.Group
                    key={group.heading}
                    heading={group.heading}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
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
            </Command>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={triggerRef} className={cn('relative min-w-[200px] flex-1', className)}>
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="search"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              updatePanelPosition();
            }}
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
            aria-expanded={showDropdown}
            aria-haspopup="listbox"
            autoComplete="off"
          />
          <kbd className="pointer-events-none absolute right-2.5 hidden rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">
            /
          </kbd>
        </div>
      </div>
      {dropdownPanel}
    </>
  );
}
