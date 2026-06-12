'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Lock } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

import type { CurriculumOfferingRow } from '@/types/curriculum-filters';
import { formatCurriculumMetaLine } from '@/utils/curriculum-offering-meta';
import { cn } from '@/utils/cn';

import { CurriculumRowSelectPanel } from './curriculum-row-select-panel';
import {
  formatRowPrimaryLabel,
  resolveSmartDefaults,
  urlFiltersFromSearchParams,
  type RowSelectContext,
} from './curriculum-row-select-utils';
import { useCurriculumRowSelectQuery } from './use-curriculum-row-select-query';

const DROPDOWN_MIN_WIDTH = 420;
const DROPDOWN_MAX_HEIGHT = 560;
const VIEWPORT_PADDING = 8;

type ProgramOption = { id: string; label: string };

type Props = {
  value: string;
  onChange: (offeringId: string, row: CurriculumOfferingRow) => void;
  disabled?: boolean;
  readOnly?: boolean;
  selectedOffering?: CurriculumOfferingRow | null;
  programOptions: ProgramOption[];
  contextDefaults: RowSelectContext;
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
  const width = Math.min(
    Math.max(anchor.width, DROPDOWN_MIN_WIDTH),
    window.innerWidth - VIEWPORT_PADDING * 2,
  );
  const left = Math.min(
    Math.max(VIEWPORT_PADDING, anchor.left),
    window.innerWidth - width - VIEWPORT_PADDING,
  );
  const spaceBelow = window.innerHeight - anchor.bottom - VIEWPORT_PADDING;
  const spaceAbove = anchor.top - VIEWPORT_PADDING;
  const preferBelow = spaceBelow >= 240 || spaceBelow >= spaceAbove;
  const available = preferBelow ? spaceBelow - gap : spaceAbove - gap;
  const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT, Math.max(available, 200));
  const top = preferBelow
    ? anchor.bottom + gap
    : Math.max(VIEWPORT_PADDING, anchor.top - gap - maxHeight);

  return { top, left, width, maxHeight };
}

export function CurriculumRowSelect({
  value,
  onChange,
  disabled,
  readOnly,
  selectedOffering,
  programOptions,
  contextDefaults,
  className,
}: Props) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const urlFilters = useMemo(() => urlFiltersFromSearchParams(searchParams), [searchParams]);

  const smartDefaults = useMemo(
    () => resolveSmartDefaults(contextDefaults, urlFilters),
    [contextDefaults, urlFilters],
  );

  const queryState = useCurriculumRowSelectQuery(open, smartDefaults);

  const displayRow = selectedOffering ?? null;

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
  }, [open]);

  useEffect(() => {
    if (!open) setMenuPosition(null);
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (anchorRef.current?.contains(target)) return;
      if (target.closest('[data-curriculum-row-select-panel]')) return;
      if (target.closest('[data-radix-popper-content-wrapper]')) return;
      if (target.closest('[role="menu"]')) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', onDoc);
      document.addEventListener('keydown', onKey);
    }
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSelect = (row: CurriculumOfferingRow) => {
    onChange(row.id, row);
    setOpen(false);
  };

  if (readOnly && displayRow) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2',
          className,
        )}
      >
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{formatRowPrimaryLabel(displayRow)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatCurriculumMetaLine(displayRow)}
          </p>
        </div>
      </div>
    );
  }

  const panel =
    open && !disabled && menuPosition && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close curriculum row picker"
              className="fixed inset-0 z-[9998] cursor-default bg-black/40 backdrop-blur-[1px]"
              onClick={() => setOpen(false)}
            />
            <div
              data-curriculum-row-select-panel
              className="fixed z-[9999] flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl ring-1 ring-border/80"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
              }}
            >
              <CurriculumRowSelectPanel
                value={value}
                onSelect={handleSelect}
                programOptions={programOptions}
                queryState={queryState}
              />
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div ref={anchorRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-10 w-full items-center gap-2 rounded-md border border-border bg-card px-3 text-left text-sm transition-colors',
          open && 'border-primary/40 ring-1 ring-primary/30',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className="min-w-0 flex-1">
          {displayRow ? (
            <>
              <span className="block truncate font-medium">
                {formatRowPrimaryLabel(displayRow)}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {formatCurriculumMetaLine(displayRow)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">Select mapping</span>
          )}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      {panel}
    </div>
  );
}
