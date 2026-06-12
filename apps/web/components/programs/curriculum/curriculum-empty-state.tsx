'use client';

import { Button } from '@/components/ui/button';
import type { CurriculumFilters } from '@/types/curriculum-filters';

type Props = {
  filters: CurriculumFilters;
  onReset: () => void;
  onOpenAdvanced: () => void;
  onClearSemesters: () => void;
};

export function CurriculumEmptyState({
  filters,
  onReset,
  onOpenAdvanced,
  onClearSemesters,
}: Props) {
  const suggestions: string[] = [];

  if (filters.semesters.length) {
    suggestions.push('Clear the semester filter to see all semesters');
  }
  if (filters.sharedPool === 'pool') {
    suggestions.push('Include programme-specific mappings alongside shared pools');
  }
  if (filters.facultyAssigned === 'false' || filters.quickToggle === 'MISSING_FACULTY') {
    suggestions.push('Remove the faculty restriction to see all courses');
  }
  if (filters.mappingStatus === 'UNMAPPED') {
    suggestions.push('Clear the mapping status filter to include partially mapped courses');
  }
  if (!suggestions.length) {
    suggestions.push('Reset all filters', 'Try a broader programme or department scope');
  }

  return (
    <div className="glass-card rounded-2xl border border-dashed border-border/60 px-6 py-10 text-center">
      <p className="text-sm font-semibold">No curriculum matches current filters</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Adjust filters or try one of these suggestions
      </p>
      <ul className="mx-auto mt-4 max-w-md space-y-1 text-left text-xs text-muted-foreground">
        {suggestions.map((s) => (
          <li key={s} className="flex gap-2">
            <span className="text-primary">•</span>
            {s}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onReset}>
          Clear all filters
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onOpenAdvanced}>
          Advanced filters
        </Button>
        {filters.semesters.length ? (
          <Button type="button" size="sm" variant="ghost" onClick={onClearSemesters}>
            Reset semester
          </Button>
        ) : null}
      </div>
    </div>
  );
}
