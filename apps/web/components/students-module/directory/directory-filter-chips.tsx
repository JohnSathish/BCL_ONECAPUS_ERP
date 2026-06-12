'use client';

import { X } from 'lucide-react';

import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import {
  getActiveFilters,
  type FilterOptionMaps,
} from '@/components/students-module/directory/directory-utils';
import { cn } from '@/utils/cn';

type DirectoryFilterChipsProps = {
  filters: DirectoryFilters;
  optionMaps: FilterOptionMaps;
  onRemove: (key: keyof DirectoryFilters) => void;
  onClearAll: () => void;
  className?: string;
};

export function DirectoryFilterChips({
  filters,
  optionMaps,
  onRemove,
  onClearAll,
  className,
}: DirectoryFilterChipsProps) {
  const active = getActiveFilters(filters, optionMaps);
  if (active.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className="text-xs text-muted-foreground">Active:</span>
      {active.map((chip) => (
        <button
          key={`${chip.key}-${chip.value}`}
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-muted/40 px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-muted"
          onClick={() => onRemove(chip.key)}
        >
          <span className="text-muted-foreground">{chip.label}:</span>
          <span className="max-w-[120px] truncate font-medium">{chip.value}</span>
          <X className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      ))}
      {active.length > 1 ? (
        <button
          type="button"
          className="text-xs text-primary underline-offset-2 hover:underline"
          onClick={onClearAll}
        >
          Clear all
        </button>
      ) : null}
    </div>
  );
}
