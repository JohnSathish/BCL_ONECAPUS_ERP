'use client';

import { Check, Settings2 } from 'lucide-react';

import { FilterPill } from '@/components/erp/filter-pill';
import { Button } from '@/components/ui/button';
import { DirectoryFilterChips } from '@/components/students-module/directory/directory-filter-chips';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import {
  countActiveFilters,
  optionsToMap,
  type FilterOptionMaps,
} from '@/components/students-module/directory/directory-utils';
import { cn } from '@/utils/cn';

type Option = { id: string; label: string };

const STATUS_OPTIONS = ['STUDYING', 'ALUMNI', 'LEAVING', 'DETAINED', 'DROPPED'].map((s) => ({
  id: s,
  label: s,
}));

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
  id: String(s),
  label: `Sem ${s}`,
}));

type Props = {
  filters: DirectoryFilters;
  totalCount?: number;
  onFilterChange: (patch: Partial<DirectoryFilters>) => void;
  onOpenAdvanced: () => void;
  onResetFilters: () => void;
  programOptions: Option[];
  batchOptions: Option[];
  shiftOptions: Option[];
  streamOptions: Option[];
  departmentOptions: Option[];
  sessionOptions: Option[];
  categoryOptions: Option[];
  religionOptions?: Option[];
};

export function DirectoryFilterRail({
  filters,
  totalCount,
  onFilterChange,
  onOpenAdvanced,
  onResetFilters,
  programOptions,
  batchOptions,
  shiftOptions,
  streamOptions,
  departmentOptions,
  sessionOptions,
  categoryOptions,
  religionOptions = [],
}: Props) {
  const advancedFilterCount = countActiveFilters({
    ...filters,
    search: '',
    programVersionId: '',
    semester: '',
    batchId: '',
    shiftId: '',
    studentStatus: '',
  });

  const optionMaps: FilterOptionMaps = {
    program: optionsToMap(programOptions),
    batch: optionsToMap(batchOptions),
    shift: optionsToMap(shiftOptions),
    stream: optionsToMap(streamOptions),
    department: optionsToMap(departmentOptions),
    session: optionsToMap(sessionOptions),
    category: optionsToMap(categoryOptions),
    religion: optionsToMap(religionOptions),
  };

  const clearFilterKey = (key: keyof DirectoryFilters) => {
    onFilterChange({ [key]: '' });
  };

  return (
    <div className="sticky top-0 z-20 space-y-2">
      <div className="glass-card rounded-2xl border border-border/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill
            label="Programme"
            value={filters.programVersionId}
            options={programOptions}
            onChange={(v) => onFilterChange({ programVersionId: v })}
            searchable
          />
          <FilterPill
            label="Semester"
            value={filters.semester}
            options={SEMESTER_OPTIONS}
            onChange={(v) => onFilterChange({ semester: v })}
          />
          <FilterPill
            label="Batch"
            value={filters.batchId}
            options={batchOptions}
            onChange={(v) => onFilterChange({ batchId: v })}
            searchable
          />
          <FilterPill
            label="Shift"
            value={filters.shiftId}
            options={shiftOptions}
            onChange={(v) => onFilterChange({ shiftId: v })}
          />
          <FilterPill
            label="Status"
            value={filters.studentStatus}
            options={STATUS_OPTIONS}
            onChange={(v) => onFilterChange({ studentStatus: v })}
          />
          <FilterPill
            label="Stream"
            value={filters.streamId}
            options={streamOptions}
            onChange={(v) => onFilterChange({ streamId: v })}
            searchable
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={cn(
              'relative h-8 rounded-full border-border/60',
              advancedFilterCount > 0 && 'ring-1 ring-primary/40 shadow-[var(--shadow-glow)]',
            )}
            onClick={onOpenAdvanced}
          >
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            More
            {advancedFilterCount > 0 ? (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {advancedFilterCount}
              </span>
            ) : null}
          </Button>
        </div>

        <DirectoryFilterChips
          filters={filters}
          optionMaps={optionMaps}
          onRemove={clearFilterKey}
          onClearAll={onResetFilters}
        />

        {totalCount != null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {totalCount.toLocaleString()} student{totalCount === 1 ? '' : 's'} in directory
          </p>
        ) : null}
      </div>
    </div>
  );
}
