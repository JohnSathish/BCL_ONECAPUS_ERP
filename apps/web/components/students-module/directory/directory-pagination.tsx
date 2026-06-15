'use client';

import { Button } from '@/components/ui/button';
import { erpSelectClass } from '@/components/erp/form-primitives';
import type { PaginatedStudents } from '@/types/students';
import { cn } from '@/utils/cn';

type Props = {
  meta: PaginatedStudents['meta'];
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  className?: string;
};

const LIMIT_OPTIONS = [25, 50, 100];

export function DirectoryPagination({ meta, onPageChange, onLimitChange, className }: Props) {
  const { page, limit, total, totalPages } = meta;
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-background/80 px-1 py-2.5',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Per page
          <select
            className={`${erpSelectClass} h-8 w-[72px] text-xs`}
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground">
          Page {page} of {totalPages || 1}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
