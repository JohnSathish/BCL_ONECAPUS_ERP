'use client';

import { ChevronDown, Lock } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { glassSelectClass } from '@/components/students-module/add-student/ui/glass-field';
import type { SubjectPathOption } from '@/types/academic-engine';
import { cn } from '@/utils/cn';

const DROPDOWN_MAX_HEIGHT = 280;
const VIEWPORT_PADDING = 8;

type Props = {
  label: string;
  value: string;
  options: SubjectPathOption[];
  onChange: (subjectId: string, subject: SubjectPathOption | undefined) => void;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  subjectRoleLabel?: string;
  error?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'bottom' | 'top';
};

function formatStreamLabel(programmeGroup?: string | null) {
  if (!programmeGroup) return 'General Stream';
  const normalized = programmeGroup.charAt(0) + programmeGroup.slice(1).toLowerCase();
  return `${normalized} Stream`;
}

function formatSubjectMeta(roleLabel: string, option: SubjectPathOption) {
  return `${roleLabel} • ${formatStreamLabel(option.programmeGroup)}`;
}

function computeMenuPosition(anchor: DOMRect): MenuPosition {
  const gap = 6;
  const spaceBelow = window.innerHeight - anchor.bottom - VIEWPORT_PADDING;
  const spaceAbove = anchor.top - VIEWPORT_PADDING;
  const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;

  const isMobile = window.innerWidth < 640;
  const width = isMobile ? window.innerWidth - VIEWPORT_PADDING * 2 : Math.max(anchor.width, 280);
  const left = isMobile
    ? VIEWPORT_PADDING
    : Math.min(anchor.left, window.innerWidth - width - VIEWPORT_PADDING);

  if (openUpward) {
    const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT, spaceAbove - gap);
    return {
      top: Math.max(VIEWPORT_PADDING, anchor.top - gap - maxHeight),
      left,
      width: Math.min(width, window.innerWidth - VIEWPORT_PADDING * 2),
      maxHeight,
      placement: 'top',
    };
  }

  const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT, spaceBelow - gap);
  return {
    top: anchor.bottom + gap,
    left,
    width: Math.min(width, window.innerWidth - VIEWPORT_PADDING * 2),
    maxHeight: Math.max(maxHeight, 120),
    placement: 'bottom',
  };
}

export function SearchableSubjectPathSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  readOnly,
  placeholder = 'Select subject',
  searchPlaceholder,
  subjectRoleLabel,
  error,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const roleLabel = subjectRoleLabel ?? label;

  const selected = options.find((o) => o.id === value);
  const inputPlaceholder = searchPlaceholder ?? `Search ${label.toLowerCase()}…`;

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        (o.programmeGroup?.toLowerCase().includes(q) ?? false) ||
        (o.department?.name?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const openMenu = () => {
    setQuery('');
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPosition(computeMenuPosition(rect));
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, options.length, filtered.length]);

  useEffect(() => {
    if (!open) setMenuPosition(null);
  }, [open]);

  if (readOnly && selected) {
    return (
      <div className="space-y-1">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2">
          <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selected.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatSubjectMeta(roleLabel, selected)}
            </p>
          </div>
        </div>
        {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
      </div>
    );
  }

  const dropdown =
    open && !disabled && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <ul
            className="fixed z-[9999] overflow-y-auto rounded-[10px] border border-border/60 bg-background shadow-xl"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
            }}
            role="listbox"
          >
            <li className="sticky top-0 z-10 border-b border-border/40 bg-background/95 px-3 py-2 text-[11px] text-muted-foreground backdrop-blur-sm">
              {query.trim()
                ? `Showing ${filtered.length} of ${options.length}`
                : `${options.length} subject${options.length === 1 ? '' : 's'} available`}
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-muted-foreground">No matching subjects</li>
            ) : (
              filtered.map((o) => {
                const isSelected = value === o.id;
                return (
                  <li key={o.id} role="option" aria-selected={isSelected} className="px-1.5 py-0.5">
                    <button
                      type="button"
                      className={cn(
                        'w-full rounded-[10px] px-3 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'bg-indigo-500/12 font-semibold text-foreground'
                          : 'hover:bg-indigo-500/[0.08]',
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(o.id, o);
                        close();
                      }}
                    >
                      <p className={cn('text-sm', isSelected && 'font-semibold')}>{o.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {formatSubjectMeta(roleLabel, o)}
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        {options.length > 1 ? (
          <span className="text-[10px] text-muted-foreground">{options.length} available</span>
        ) : null}
      </div>
      <div className="relative" ref={anchorRef}>
        <div
          className={cn(
            'flex h-9 w-full items-center rounded-lg border border-border/60 bg-background/70',
            open && 'border-primary/40 ring-1 ring-primary/30',
            disabled && 'opacity-60',
          )}
        >
          <input
            className="min-w-0 flex-1 bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground"
            placeholder={open ? inputPlaceholder : selected ? selected.name : placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={openMenu}
            onBlur={() => window.setTimeout(() => close(), 150)}
            disabled={disabled}
            aria-expanded={open}
            aria-haspopup="listbox"
          />
          <button
            type="button"
            tabIndex={-1}
            className="flex h-9 w-9 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (open ? close() : openMenu())}
            aria-label={`Open ${label} options`}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
        {dropdown}
      </div>
      {selected && !query && !open ? (
        <p className="truncate text-[11px] text-muted-foreground">
          {formatSubjectMeta(roleLabel, selected)}
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
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      {error ? <p className="text-[10px] text-destructive">{error}</p> : null}
    </div>
  );
}
