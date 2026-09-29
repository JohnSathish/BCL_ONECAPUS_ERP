'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/utils/cn';

export type QbSelectOption = { value: string; label: string; hint?: string; badge?: string };

type MenuPosition = { top: number; left: number; width: number; maxHeight: number };

const VIEWPORT_PADDING = 8;

function computeMenuPosition(anchor: DOMRect): MenuPosition {
  const gap = 6;
  const spaceBelow = window.innerHeight - anchor.bottom - VIEWPORT_PADDING - gap;
  const spaceAbove = anchor.top - VIEWPORT_PADDING - gap;
  const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
  const maxHeight = Math.max(180, Math.min(360, openUp ? spaceAbove : spaceBelow));
  const width = Math.min(Math.max(anchor.width, 280), window.innerWidth - VIEWPORT_PADDING * 2);
  const left = Math.min(
    Math.max(anchor.left, VIEWPORT_PADDING),
    window.innerWidth - width - VIEWPORT_PADDING,
  );
  return {
    top: openUp ? anchor.top - gap - maxHeight : anchor.bottom + gap,
    left,
    width,
    maxHeight,
  };
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const at = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-inherit">
        {text.slice(at, at + q.length)}
      </mark>
      {text.slice(at + q.length)}
    </>
  );
}

type Props = {
  id?: string;
  value: string;
  options: QbSelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearLabel?: string;
  /** Noun shown in the result count, e.g. "subject" → "12 subjects". */
  itemNoun?: string;
  disabled?: boolean;
  loading?: boolean;
  invalid?: boolean;
  className?: string;
};

export function QbSearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = 'Type to search…',
  emptyText = 'No matches found',
  clearLabel,
  itemNoun,
  disabled,
  loading,
  invalid,
  className,
}: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => option.value === value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? options.filter((option) =>
          `${option.badge ?? ''} ${option.label} ${option.hint ?? ''}`.toLowerCase().includes(q),
        )
      : options;
  }, [options, query]);

  const rows: QbSelectOption[] = useMemo(
    () => (clearLabel && !query.trim() ? [{ value: '', label: clearLabel }, ...matches] : matches),
    [matches, query, clearLabel],
  );

  const close = (focusTrigger = true) => {
    setOpen(false);
    setQuery('');
    if (focusTrigger) anchorRef.current?.focus();
  };

  const choose = (next: string) => {
    onChange(next);
    close();
  };

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const update = () => {
      if (anchorRef.current)
        setPosition(computeMenuPosition(anchorRef.current.getBoundingClientRect()));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const index = rows.findIndex((row) => row.value === value);
    setActive(index >= 0 ? index : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[active];
      if (row) choose(row.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  const countLabel = itemNoun
    ? `${matches.length} ${itemNoun}${matches.length === 1 ? '' : 's'}${query.trim() ? ' found' : ''}`
    : null;

  const menu =
    open && position && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] flex flex-col overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl ring-1 ring-black/5 dark:ring-white/5"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
          >
            <div className="p-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring/30">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <input
                  autoFocus
                  role="combobox"
                  aria-expanded
                  aria-controls={listId}
                  aria-activedescendant={rows[active] ? `${listId}-${active}` : undefined}
                  aria-label={searchPlaceholder}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onSearchKeyDown}
                />
              </div>
            </div>
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              className="flex-1 overflow-y-auto border-t border-border/60 p-1"
            >
              {rows.length === 0 ? (
                <li className="flex flex-col items-center gap-1 px-3 py-6 text-center text-sm text-muted-foreground">
                  <Search className="h-5 w-5 opacity-50" aria-hidden />
                  {emptyText}
                </li>
              ) : (
                rows.map((row, index) => {
                  const isSelected = row.value === value;
                  return (
                    <li
                      key={row.value || '__clear'}
                      id={`${listId}-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={isSelected}
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                        index === active && 'bg-muted',
                        isSelected && 'bg-primary/10 text-primary',
                        !row.value && !isSelected && 'text-muted-foreground',
                      )}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(row.value)}
                    >
                      <Check
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0 text-primary',
                          !isSelected && 'invisible',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-2">
                          {row.badge ? (
                            <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground ring-1 ring-border/70">
                              <Highlight text={row.badge} query={query} />
                            </span>
                          ) : null}
                          <span className={cn('truncate', isSelected && 'font-medium')}>
                            <Highlight text={row.label} query={query} />
                          </span>
                        </span>
                        {row.hint ? (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                            {row.hint}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
            {countLabel ? (
              <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
                <span>{countLabel}</span>
                <span className="hidden sm:inline">
                  ↑↓ to move · Enter to select · Esc to close
                </span>
              </div>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-left text-sm shadow-xs transition-colors',
          'hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground disabled:hover:border-border',
          open && 'border-primary/60 ring-2 ring-ring/30',
          invalid && 'border-destructive',
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.badge && !loading ? (
            <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
              {selected.badge}
            </span>
          ) : null}
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {loading ? 'Loading…' : (selected?.label ?? placeholder)}
          </span>
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 opacity-60 transition-transform duration-150',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {menu}
    </>
  );
}
