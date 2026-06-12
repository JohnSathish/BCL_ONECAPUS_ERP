'use client';

import type { StudentDirectoryRow } from '@/types/students';

type Props = {
  rows: StudentDirectoryRow[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onPageSelect: (ids: string[], selected: boolean) => void;
  loading?: boolean;
  total?: number;
  page: number;
  onPageChange: (page: number) => void;
  pageSize: number;
  disabled?: boolean;
};

export function BulkUpdateSelectStep({
  rows,
  selectedIds,
  onToggle,
  onPageSelect,
  loading,
  total,
  page,
  onPageChange,
  pageSize,
  disabled,
}: Props) {
  const pageIds = rows.map((r) => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const totalPages = total ? Math.ceil(total / pageSize) : 1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Select students</h2>
          <p className="text-xs text-muted-foreground">
            {disabled
              ? 'Using filter scope — selection is optional for reference.'
              : 'Choose students to include in this bulk update.'}
          </p>
        </div>
        {!disabled ? (
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={(e) => onPageSelect(pageIds, e.target.checked)}
              />
              Select page
            </label>
            <span className="text-muted-foreground">{selectedIds.size} selected</span>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 text-left">
            <tr>
              {!disabled ? <th className="w-8 px-2 py-2" /> : null}
              <th className="px-2 py-2">Name</th>
              <th className="px-2 py-2">Roll</th>
              <th className="px-2 py-2">Reg. No.</th>
              <th className="px-2 py-2">Programme</th>
              <th className="px-2 py-2">Sem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={disabled ? 5 : 6}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  Loading students…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={disabled ? 5 : 6}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  No students match the current scope.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-border/60 hover:bg-muted/20">
                  {!disabled ? (
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => onToggle(row.id)}
                      />
                    </td>
                  ) : null}
                  <td className="px-2 py-2 font-medium">{row.fullName}</td>
                  <td className="px-2 py-2">{row.rollNumber ?? '—'}</td>
                  <td className="px-2 py-2">{row.enrollmentNumber}</td>
                  <td className="px-2 py-2">{row.programme ?? '—'}</td>
                  <td className="px-2 py-2">{row.semester ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
            {total != null ? ` · ${total} total` : ''}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page <= 1}
              className="rounded border border-border px-2 py-1 disabled:opacity-40"
              onClick={() => onPageChange(page - 1)}
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              className="rounded border border-border px-2 py-1 disabled:opacity-40"
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
