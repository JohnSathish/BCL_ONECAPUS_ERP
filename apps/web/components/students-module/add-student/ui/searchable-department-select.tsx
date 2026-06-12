'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { glassSelectClass } from '@/components/students-module/add-student/ui/glass-field';
import { cn } from '@/utils/cn';

const DROPDOWN_MAX_HEIGHT = 280;
const VIEWPORT_PADDING = 8;

export type DepartmentSelectOption = { id: string; label: string };

type Props = {
  value: string;
  options: DepartmentSelectOption[];
  onChange: (departmentId: string) => void;
  disabled?: boolean;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
};

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function computeMenuPosition(anchor: DOMRect): MenuPosition {
  const gap = 6;
  const spaceBelow = window.innerHeight - anchor.bottom - VIEWPORT_PADDING;
  const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT, spaceBelow - gap);
  const isMobile = window.innerWidth < 640;
  const width = isMobile ? window.innerWidth - VIEWPORT_PADDING * 2 : Math.max(anchor.width, 240);
  const left = isMobile
    ? VIEWPORT_PADDING
    : Math.min(anchor.left, window.innerWidth - width - VIEWPORT_PADDING);

  return {
    top: anchor.bottom + gap,
    left,
    width: Math.min(width, window.innerWidth - VIEWPORT_PADDING * 2),
    maxHeight: Math.max(maxHeight, 120),
  };
}

export function SearchableDepartmentSelect({
  value,
  options,
  onChange,
  disabled,
  placeholder = 'Select department',
  allowEmpty = true,
  emptyLabel = 'Optional',
  className,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const update = () => {
      if (!anchorRef.current) return;
      setMenuPosition(computeMenuPosition(anchorRef.current.getBoundingClientRect()));
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
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const menu =
    open && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] overflow-hidden rounded-[10px] border border-border bg-background shadow-xl"
            style={{
              top: menuPosition.top,
              left: menuPosition.left,
              width: menuPosition.width,
              maxHeight: menuPosition.maxHeight,
            }}
          >
            <div className="sticky top-0 z-10 border-b border-border/40 bg-background p-2">
              <input
                autoFocus
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none ring-primary/30 focus:ring-1"
                placeholder="Search department…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <ul className="max-h-[220px] overflow-y-auto bg-background py-1">
              {allowEmpty ? (
                <li>
                  <button
                    type="button"
                    className="w-full bg-background px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange('');
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    {emptyLabel}
                  </button>
                </li>
              ) : null}
              {filtered.length === 0 ? (
                <li className="bg-background px-3 py-2 text-xs text-muted-foreground">
                  No departments found
                </li>
              ) : (
                filtered.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={cn(
                        'w-full bg-background px-3 py-2 text-left text-xs hover:bg-muted',
                        o.id === value && 'bg-primary/10 font-medium text-primary',
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onChange(o.id);
                        setOpen(false);
                        setQuery('');
                      }}
                    >
                      {o.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={anchorRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          glassSelectClass,
          'flex w-full items-center justify-between text-left',
          disabled && 'cursor-not-allowed opacity-60',
        )}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
      >
        <span className={cn(!selected && 'text-muted-foreground')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>
      {menu}
    </div>
  );
}
