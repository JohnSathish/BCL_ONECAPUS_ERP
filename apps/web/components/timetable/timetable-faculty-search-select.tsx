'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/utils/cn';

export type TimetableFacultyOption = {
  id: string;
  fullName: string;
  shortCode?: string | null;
  employeeCode?: string | null;
  assignedShifts?: Array<{ code: string }>;
};

type Props = {
  value: string;
  options: TimetableFacultyOption[];
  onChange: (staffProfileId: string) => void;
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
  loading?: boolean;
  error?: boolean;
  disabled?: boolean;
  placeholder?: string;
  emptyHint?: string;
  excludeIds?: string[];
  className?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

const DROPDOWN_MAX_HEIGHT = 240;
const VIEWPORT_PADDING = 8;

function optionLabel(member: TimetableFacultyOption) {
  const code = member.shortCode ?? member.employeeCode ?? '';
  return code ? `${code} · ${member.fullName}` : member.fullName;
}

function computeMenuPosition(anchor: DOMRect): MenuPosition {
  const gap = 4;
  const spaceBelow = window.innerHeight - anchor.bottom - VIEWPORT_PADDING;
  const spaceAbove = anchor.top - VIEWPORT_PADDING;
  const openUp = spaceBelow < 160 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(
    DROPDOWN_MAX_HEIGHT,
    Math.max(120, openUp ? spaceAbove - gap : spaceBelow - gap),
  );
  const width = Math.min(Math.max(anchor.width, 220), window.innerWidth - VIEWPORT_PADDING * 2);
  const left = Math.min(anchor.left, window.innerWidth - width - VIEWPORT_PADDING);

  return {
    top: openUp ? anchor.top - gap - maxHeight : anchor.bottom + gap,
    left: Math.max(VIEWPORT_PADDING, left),
    width,
    maxHeight,
  };
}

export function TimetableFacultySearchSelect({
  value,
  options,
  onChange,
  onSearchChange,
  searchQuery,
  loading,
  error,
  disabled,
  placeholder = 'Search faculty by name or code…',
  emptyHint = 'No matching faculty',
  excludeIds = [],
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const query = searchQuery ?? localQuery;

  const selected = options.find((m) => m.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter((member) => {
      if (excludeIds.includes(member.id)) return false;
      if (!q) return true;
      const haystack = [
        member.fullName,
        member.shortCode ?? '',
        member.employeeCode ?? '',
        ...(member.assignedShifts?.map((s) => s.code) ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query, excludeIds]);

  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    const update = () => {
      if (!containerRef.current) return;
      setMenuPosition(computeMenuPosition(containerRef.current.getBoundingClientRect()));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, filtered.length, loading]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const setQuery = (next: string) => {
    if (onSearchChange) onSearchChange(next);
    else setLocalQuery(next);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[10000] overflow-hidden rounded-md border border-border bg-background text-foreground shadow-xl"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
            }}
            role="listbox"
          >
            <div className="max-h-full overflow-auto bg-background">
              {loading ? (
                <p className="bg-background p-3 text-xs text-muted-foreground">Searching…</p>
              ) : filtered.length ? (
                filtered.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={cn(
                      'flex w-full flex-col border-b border-border/50 bg-background px-3 py-2 text-left text-sm last:border-0 hover:bg-muted',
                      value === member.id && 'bg-primary/10',
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(member.id);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <span className="font-medium text-foreground">{member.fullName}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {member.shortCode ?? member.employeeCode ?? 'No code'}
                      {member.assignedShifts?.length
                        ? ` · ${member.assignedShifts.map((s) => s.code).join('/')}`
                        : ''}
                    </span>
                  </button>
                ))
              ) : (
                <p className="bg-background p-3 text-xs text-muted-foreground">{emptyHint}</p>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          className="h-10 w-full rounded-md border border-border bg-card py-2 pl-9 pr-9 text-sm outline-none ring-primary/30 focus:ring-1 disabled:opacity-60"
          placeholder={
            loading
              ? 'Loading faculty…'
              : error
                ? 'Failed to load faculty'
                : selected
                  ? optionLabel(selected)
                  : placeholder
          }
          value={open ? query : selected ? optionLabel(selected) : query}
          disabled={disabled || loading}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value && e.target.value !== optionLabel(selected!)) {
              onChange('');
            }
          }}
          onFocus={() => {
            setOpen(true);
            if (selected && !query) setQuery('');
          }}
        />
        {value || query ? (
          <button
            type="button"
            className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={clear}
            aria-label="Clear faculty"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {menu}
    </div>
  );
}
