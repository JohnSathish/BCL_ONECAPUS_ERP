'use client';

import { Filter, Search, X } from 'lucide-react';
import { useState } from 'react';
import { CourseCatalogFilterFields } from '@/components/programs/course-catalog-filter-fields';
import { CourseCatalogFiltersDialog } from '@/components/programs/course-catalog-filters-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CourseCatalogFilterState } from '@/hooks/use-course-catalog-filters';
import type { Department } from '@/types/organization';
import type { ProgramVersion } from '@/types/programs';

type ProgramVersionOption = ProgramVersion & {
  program: { code: string; name: string };
};

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  filters: CourseCatalogFilterState;
  onFilterChange: <K extends keyof CourseCatalogFilterState>(
    key: K,
    value: CourseCatalogFilterState[K],
  ) => void;
  onFiltersApply: (filters: CourseCatalogFilterState) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  totalCount?: number;
  isLoading?: boolean;
  departments: Department[];
  programVersions: ProgramVersionOption[];
};

export function CourseCatalogToolbar({
  search,
  onSearchChange,
  filters,
  onFilterChange,
  onFiltersApply,
  onClearFilters,
  hasActiveFilters,
  totalCount,
  isLoading,
  departments,
  programVersions,
}: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <div className="space-y-3 border-b border-border/60 pb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Course catalog</p>
          <p className="text-xs text-muted-foreground">
            {isLoading
              ? 'Searching…'
              : totalCount != null
                ? `Showing ${totalCount} course${totalCount === 1 ? '' : 's'}`
                : '—'}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:max-w-md lg:justify-end">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search courses, codes, departments, programmes…"
              className="h-9 pl-9 pr-8 text-sm"
              aria-label="Search courses"
            />
            {search ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 lg:hidden"
            onClick={() => setFiltersOpen(true)}
          >
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Filters
            {hasActiveFilters ? (
              <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                on
              </span>
            ) : null}
          </Button>
        </div>
      </div>

      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        <CourseCatalogFilterFields
          filters={filters}
          onFilterChange={onFilterChange}
          departments={departments}
          programVersions={programVersions}
          layout="inline"
        />
        {hasActiveFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <CourseCatalogFiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onApply={onFiltersApply}
        onClear={onClearFilters}
        departments={departments}
        programVersions={programVersions}
      />
    </div>
  );
}
