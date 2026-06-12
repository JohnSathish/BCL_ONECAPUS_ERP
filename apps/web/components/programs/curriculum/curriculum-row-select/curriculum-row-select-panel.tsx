'use client';

import { useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';

import type { CurriculumOfferingRow } from '@/types/curriculum-filters';
import { cn } from '@/utils/cn';

import { CurriculumRowSelectOption } from './curriculum-row-select-option';
import {
  CATEGORY_OPTIONS,
  groupCurriculumRowsBySemesterAndCategory,
  isQuickChipActive,
  ROW_SELECT_QUICK_CHIPS,
  SEMESTER_OPTIONS,
  toggleQuickChip,
} from './curriculum-row-select-utils';
import type { useCurriculumRowSelectQuery } from './use-curriculum-row-select-query';

type ProgramOption = { id: string; label: string };

type QueryState = ReturnType<typeof useCurriculumRowSelectQuery>;

type Props = {
  value: string;
  onSelect: (row: CurriculumOfferingRow) => void;
  programOptions: ProgramOption[];
  queryState: QueryState;
};

const selectClass = 'h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs';

export function CurriculumRowSelectPanel({ value, onSelect, programOptions, queryState }: Props) {
  const {
    showAllMappings,
    setShowAllMappings,
    filters,
    patchFilters,
    searchInput,
    setSearchInput,
    rows,
    total,
    query,
  } = queryState;

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const grouped = groupCurriculumRowsBySemesterAndCategory(rows);

  useEffect(() => {
    const node = loadMoreRef.current;
    const root = scrollRef.current;
    if (!node || !root || !query.hasNextPage || query.isFetchingNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void query.fetchNextPage();
        }
      },
      { root, rootMargin: '120px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [query.fetchNextPage, query.hasNextPage, query.isFetchingNextPage, rows.length]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 space-y-2 border-b border-border bg-background p-3">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search course code, title, category…"
            className="h-9 flex-1 bg-background text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <select
            className={selectClass}
            value={filters.category}
            onChange={(e) => patchFilters({ category: e.target.value, quickToggle: '' })}
            aria-label="Filter by category"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.id || 'all'} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={filters.semester}
            onChange={(e) => patchFilters({ semester: e.target.value })}
            aria-label="Filter by semester"
          >
            {SEMESTER_OPTIONS.map((o) => (
              <option key={o.id || 'all'} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {programOptions.length > 1 ? (
            <select
              className={cn(selectClass, 'min-w-[8rem]')}
              value={filters.programVersionId}
              onChange={(e) => patchFilters({ programVersionId: e.target.value })}
              aria-label="Filter by programme"
            >
              <option value="">All programmes</option>
              {programOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {ROW_SELECT_QUICK_CHIPS.map((chip) => {
            const active = isQuickChipActive(chip, filters);
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => patchFilters(toggleQuickChip(chip, filters))}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  active
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/30',
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showAllMappings}
            onChange={(e) => setShowAllMappings(e.target.checked)}
            className="rounded border-border"
          />
          Show all mappings
        </label>
      </div>

      <Command shouldFilter={false} className="flex min-h-0 flex-1 flex-col bg-background">
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-background p-2">
          <Command.List>
            {query.isLoading ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                Loading curriculum rows…
              </p>
            ) : query.isError ? (
              <p className="px-2 py-6 text-center text-sm text-destructive">
                Could not load curriculum rows.
              </p>
            ) : rows.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                No mappings match — widen filters or enable Show all mappings.
              </p>
            ) : (
              grouped.map((semGroup) => (
                <div key={semGroup.semester ?? 'none'} className="mb-3">
                  <p className="sticky top-0 z-10 bg-background px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {semGroup.semesterLabel}
                  </p>
                  {semGroup.categories.map((catGroup) => (
                    <div key={`${semGroup.semester}-${catGroup.category}`} className="mb-2">
                      <p className="bg-background px-1 py-0.5 text-[10px] font-semibold uppercase text-foreground/70">
                        {catGroup.category}
                      </p>
                      <div className="space-y-0.5">
                        {catGroup.rows.map((row) => (
                          <CurriculumRowSelectOption
                            key={row.id}
                            row={row}
                            selected={value === row.id}
                            onSelect={() => onSelect(row)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
            <div ref={loadMoreRef} className="h-4" />
          </Command.List>
        </div>
      </Command>

      <div className="shrink-0 border-t border-border bg-background px-3 py-2 text-[11px] text-muted-foreground">
        {total.toLocaleString()} matching
        {rows.length < total ? ` · showing ${rows.length}` : ''}
        {query.isFetchingNextPage ? ' · loading more…' : ''}
      </div>
    </div>
  );
}
