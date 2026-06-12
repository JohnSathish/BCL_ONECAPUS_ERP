'use client';

import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import type { CompletionSummary } from '@/types/curriculum-completion';

type Props = {
  summary: CompletionSummary | undefined;
  isLoading: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  isRetrying?: boolean;
  onSelectIssue?: (
    issue:
      | 'missingMappings'
      | 'unmappedCourses'
      | 'sharedPoolsMissing'
      | 'pendingFacultyAssignment',
  ) => void;
};

const cards = [
  { key: 'totalProgrammes' as const, label: 'Total programmes' },
  { key: 'completedSemesters' as const, label: 'Completed semesters' },
  {
    key: 'missingMappings' as const,
    label: 'Missing mappings',
    clickable: 'missingMappings' as const,
  },
  {
    key: 'unmappedCourses' as const,
    label: 'Unmapped courses',
    clickable: 'unmappedCourses' as const,
  },
  {
    key: 'sharedPoolsMissing' as const,
    label: 'Shared pools missing',
    clickable: 'sharedPoolsMissing' as const,
  },
  {
    key: 'pendingFacultyAssignment' as const,
    label: 'Pending faculty',
    clickable: 'pendingFacultyAssignment' as const,
  },
];

export function CompletionSummaryCards({
  summary,
  isLoading,
  isError,
  error,
  onRetry,
  isRetrying,
  onSelectIssue,
}: Props) {
  if (isError) {
    return (
      <QueryErrorPanel
        title="Summary unavailable"
        error={error}
        onRetry={onRetry}
        isRetrying={isRetrying}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const value = summary?.[card.key] ?? 0;
        const clickable = 'clickable' in card ? card.clickable : undefined;
        return (
          <button
            key={card.key}
            type="button"
            disabled={!clickable || isLoading}
            onClick={() => clickable && onSelectIssue?.(clickable)}
            className={`rounded-md border border-border p-3 text-left ${
              clickable ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default'
            }`}
          >
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{isLoading ? '—' : value}</p>
          </button>
        );
      })}
    </div>
  );
}
