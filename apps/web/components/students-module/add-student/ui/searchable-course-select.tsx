'use client';

import { ChevronDown, Lock } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { glassSelectClass } from '@/components/students-module/add-student/ui/glass-field';
import type { AdmissionPoolOffering } from '@/types/students';
import { cn } from '@/utils/cn';

type Props = {
  label: string;
  value: string;
  options: AdmissionPoolOffering[];
  onChange: (offeringId: string, offering: AdmissionPoolOffering | undefined) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  error?: string;
};

function formatOptionTitle(o: AdmissionPoolOffering) {
  const code = o.course?.code ?? '—';
  const title = o.course?.title ?? '';
  return `${code} — ${title}`;
}

function formatCredits(credits: string | number | undefined) {
  if (credits == null) return null;
  const n = Number(credits);
  if (!Number.isFinite(n)) return null;
  return n === 1 ? '1 credit' : `${n} credits`;
}

export function SearchableCourseSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  readOnly,
  placeholder = 'Select subject',
  error,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => {
      const code = o.course?.code?.toLowerCase() ?? '';
      const title = o.course?.title?.toLowerCase() ?? '';
      const slug = o.course?.subjectSlug?.toLowerCase() ?? '';
      const dept = o.course?.department?.name?.toLowerCase() ?? '';
      return code.includes(q) || title.includes(q) || slug.includes(q) || dept.includes(q);
    });
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  if (readOnly && selected) {
    return (
      <div className="space-y-1">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5">
          <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{formatOptionTitle(selected)}</p>
            {selected.course?.department?.name || selected.course?.credits != null ? (
              <p className="truncate text-[10px] text-muted-foreground">
                {selected.course?.department?.name
                  ? `Department: ${selected.course.department.name}`
                  : null}
                {selected.course?.department?.name && selected.course?.credits != null
                  ? ' · '
                  : null}
                {formatCredits(selected.course?.credits)}
              </p>
            ) : null}
          </div>
        </div>
        {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-1" ref={containerRef}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        {options.length > 1 ? (
          <span className="text-[10px] text-muted-foreground">{options.length} available</span>
        ) : null}
      </div>
      <div className="relative">
        <div
          className={cn(
            'glass-card flex h-8 w-full items-center rounded-lg border border-border/60 bg-background/70 transition-colors',
            open && 'border-primary/40 ring-1 ring-primary/30',
            disabled && 'opacity-60',
          )}
        >
          <input
            className="min-w-0 flex-1 bg-transparent px-2.5 text-xs outline-none placeholder:text-muted-foreground"
            placeholder={selected && !query ? formatOptionTitle(selected) : placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => close(), 150)}
            disabled={disabled}
            aria-expanded={open}
            aria-haspopup="listbox"
          />
          <button
            type="button"
            tabIndex={-1}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setOpen((v) => !v)}
            aria-label={`Open ${label} options`}
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
        {open && !disabled ? (
          <ul
            className="glass-card absolute z-20 mt-0.5 max-h-52 w-full overflow-y-auto rounded-lg border border-border/60 shadow-lg"
            role="listbox"
          >
            {!value ? (
              <li className="border-b border-border/40 px-2.5 py-1 text-[10px] text-muted-foreground">
                {placeholder}
              </li>
            ) : null}
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-xs text-muted-foreground">No matching subjects</li>
            ) : (
              filtered.map((o) => (
                <li key={o.id} role="option" aria-selected={value === o.id}>
                  <button
                    type="button"
                    className={cn(
                      'w-full px-2.5 py-2 text-left hover:bg-muted/60',
                      value === o.id && 'bg-primary/10',
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(o.id, o);
                      close();
                    }}
                  >
                    <p className={cn('text-xs', value === o.id && 'font-medium text-primary')}>
                      {formatOptionTitle(o)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {o.course?.department?.name
                        ? `Department: ${o.course.department.name}`
                        : 'Department: —'}
                      {o.course?.credits != null ? ` · ${formatCredits(o.course.credits)}` : null}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
      {selected && !query && !open ? (
        <p className="truncate text-[10px] text-muted-foreground">
          {selected.course?.department?.name
            ? `${selected.course.department.name} · ${formatCredits(selected.course.credits) ?? ''}`
            : formatCredits(selected.course?.credits)}
        </p>
      ) : null}
      <select
        className={cn(glassSelectClass, 'sr-only')}
        tabIndex={-1}
        aria-hidden
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = options.find((o) => o.id === e.target.value);
          onChange(e.target.value, next);
        }}
      >
        <option value="">Select course</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {formatOptionTitle(o)}
          </option>
        ))}
      </select>
      {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
    </div>
  );
}
