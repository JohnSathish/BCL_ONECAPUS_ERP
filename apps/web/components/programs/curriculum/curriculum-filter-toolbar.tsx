'use client';

import { Settings2 } from 'lucide-react';

import { FilterPill, FilterPillMulti } from '@/components/erp/filter-pill';
import { Button } from '@/components/ui/button';
import { CURRICULUM_CATEGORIES, type CurriculumFilters } from '@/types/curriculum-filters';
import { cn } from '@/utils/cn';
import { categoryColorToken } from './curriculum-category-tokens';
import { CurriculumCommandSearch } from './curriculum-command-search';
import { CurriculumSemesterSwitcher } from './curriculum-semester-switcher';

type Option = { id: string; label: string };

type Props = {
  filters: CurriculumFilters;
  searchInput: string;
  onSearchChange: (value: string) => void;
  onPatch: (patch: Partial<CurriculumFilters>) => void;
  onToggleSemester: (sem: number) => void;
  onReset: () => void;
  onOpenAdvanced: () => void;
  advancedFilterCount: number;
  programOptions: Option[];
};

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
  id: String(s),
  label: `Sem ${s}`,
}));

const CATEGORY_OPTIONS = CURRICULUM_CATEGORIES.map((c) => ({ id: c, label: c }));

export function CurriculumFilterToolbar({
  filters,
  searchInput,
  onSearchChange,
  onPatch,
  onToggleSemester,
  onReset,
  onOpenAdvanced,
  advancedFilterCount,
  programOptions,
}: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <CurriculumCommandSearch
          value={searchInput}
          onChange={onSearchChange}
          onQuickFilter={(patch) => onPatch(patch)}
        />
        <FilterPill
          label="Programme"
          value={filters.programVersionId}
          options={programOptions}
          onChange={(v) => onPatch({ programVersionId: v })}
          searchable
        />
        <FilterPillMulti
          label="Semester"
          values={filters.semesters.map(String)}
          options={SEMESTER_OPTIONS}
          onChange={(values) =>
            onPatch({
              semesters: values.map(Number).sort((a, b) => a - b),
            })
          }
        />
        <FilterPillMulti
          label="Category"
          values={filters.categories}
          options={CATEGORY_OPTIONS}
          onChange={(categories) => onPatch({ categories })}
          renderOptionLabel={(option, selected) => {
            const token = categoryColorToken(option.id);
            return (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 truncate rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                  selected ? token.pill : '',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', token.dot)} />
                {option.label}
              </span>
            );
          }}
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
          Advanced
          {advancedFilterCount > 0 ? (
            <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {advancedFilterCount}
            </span>
          ) : null}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onReset}>
          Reset
        </Button>
      </div>

      <CurriculumSemesterSwitcher
        selected={filters.semesters}
        onToggle={onToggleSemester}
        onClear={() => onPatch({ semesters: [] })}
      />
    </div>
  );
}
