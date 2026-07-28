'use client';

import { Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

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

function optionLabel(member: TimetableFacultyOption) {
  const code = member.shortCode ?? member.employeeCode ?? '';
  return code ? `${code} · ${member.fullName}` : member.fullName;
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
  const [open, setOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const setQuery = (next: string) => {
    if (onSearchChange) onSearchChange(next);
    else setLocalQuery(next);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

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

      {open ? (
        <div className="absolute z-40 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover shadow-lg">
          {loading ? (
            <p className="p-3 text-xs text-muted-foreground">Searching…</p>
          ) : filtered.length ? (
            filtered.map((member) => (
              <button
                key={member.id}
                type="button"
                className={cn(
                  'flex w-full flex-col border-b border-border/50 px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/60',
                  value === member.id && 'bg-primary/5',
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(member.id);
                  setQuery('');
                  setOpen(false);
                }}
              >
                <span className="font-medium">{member.fullName}</span>
                <span className="text-[11px] text-muted-foreground">
                  {member.shortCode ?? member.employeeCode ?? 'No code'}
                  {member.assignedShifts?.length
                    ? ` · ${member.assignedShifts.map((s) => s.code).join('/')}`
                    : ''}
                </span>
              </button>
            ))
          ) : (
            <p className="p-3 text-xs text-muted-foreground">{emptyHint}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
