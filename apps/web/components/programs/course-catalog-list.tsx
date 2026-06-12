'use client';

import { HighlightMatch } from '@/components/programs/highlight-match';
import { Button } from '@/components/ui/button';
import type { Course } from '@/types/programs';
import { formatCourseCatalogMeta } from '@/utils/course-delivery-meta';

function formatMappingChip(m: NonNullable<Course['mappingSummary']>[number]) {
  const parts = [m.programCode];
  if (m.semesterSequence != null) parts.push(`Sem ${m.semesterSequence}`);
  if (m.category) parts.push(m.category);
  return parts.join(' · ');
}

type Props = {
  courses: Course[];
  searchQuery?: string;
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  onLoadMore?: () => void;
  canManage?: boolean;
  onEdit: (course: Course) => void;
  onRemove: (course: Course) => void;
  isRemovePending?: boolean;
};

export function CourseCatalogList({
  courses,
  searchQuery,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onLoadMore,
  canManage,
  onEdit,
  onRemove,
  isRemovePending,
}: Props) {
  if (isLoading && courses.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-lg border border-border/50 bg-muted/30"
          />
        ))}
      </div>
    );
  }

  if (!isLoading && courses.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No courses found matching your filters.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {courses.map((c) => (
        <article
          key={c.id}
          className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/50 p-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              <HighlightMatch text={c.code} query={searchQuery} />
              {' — '}
              <HighlightMatch text={c.title} query={searchQuery} />
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {formatCourseCatalogMeta(c)} · {c.courseType}
              {c.department ? (
                <>
                  {' · '}
                  <HighlightMatch text={c.department.name} query={searchQuery} />
                </>
              ) : null}
            </p>
            {c.mappingSummary && c.mappingSummary.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.mappingSummary.map((m, i) => (
                  <span
                    key={`${m.programCode}-${m.category}-${m.semesterSequence}-${i}`}
                    className="inline-flex rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {formatMappingChip(m)}
                  </span>
                ))}
                {c.mappingSummaryTruncated ? (
                  <span className="inline-flex px-1 text-[10px] text-muted-foreground">
                    +{(c.mappingSummaryTotal ?? 0) - (c.mappingSummary?.length ?? 0)} more
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="mt-1.5 text-[10px] italic text-muted-foreground">
                No curriculum mapping yet
              </p>
            )}
          </div>
          {canManage ? (
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onEdit(c)}>
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRemovePending}
                onClick={() => onRemove(c)}
              >
                Remove
              </Button>
            </div>
          ) : null}
        </article>
      ))}

      {hasNextPage ? (
        <div className="pt-2 text-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetchingNextPage}
            onClick={onLoadMore}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more courses'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
