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

const LIMIT_OPTIONS = [25, 50, 100, 200];

function pageWindow(page: number, totalPages: number): Array<number | '…'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push('…');
    out.push(n);
  });
  return out;
}

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
        Showing {from}–{to} of {total.toLocaleString('en-IN')} students
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Rows per page
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
        <div className="flex items-center gap-1">
          {pageWindow(page, totalPages || 1).map((item, index) =>
            item === '…' ? (
              <span key={`gap-${index}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={item === page ? 'default' : 'outline'}
                className="h-8 min-w-8 px-2"
                onClick={() => onPageChange(item)}
              >
                {item}
              </Button>
            ),
          )}
        </div>
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
