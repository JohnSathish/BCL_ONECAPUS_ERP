'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';

export type DataTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => React.ReactNode;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  onDelete?: (row: T) => void;
  onEdit?: (row: T) => void;
  canManage?: boolean;
  deletePending?: boolean;
};

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = 'No records yet.',
  onDelete,
  onEdit,
  canManage = false,
  deletePending = false,
}: DataTableProps<T>) {
  const hasActions = canManage && (onDelete || onEdit);

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden rounded-md border border-border">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead className="bg-muted/90">
          <tr className="border-b border-border text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'truncate px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
            {hasActions ? (
              <th className="w-[88px] shrink-0 px-2 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Actions
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getRowKey(row)}
              className="border-b border-border/70 transition-colors hover:bg-muted/30"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn('max-w-0 truncate px-3 py-2 align-middle', col.className)}
                >
                  {col.cell(row)}
                </td>
              ))}
              {hasActions ? (
                <td className="w-[88px] shrink-0 px-2 py-1.5 text-right">
                  <div className="flex justify-end gap-1">
                    {onEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0"
                        onClick={() => onEdit(row)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    {onDelete ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0 text-danger hover:bg-danger/10 hover:text-danger"
                        disabled={deletePending}
                        onClick={() => onDelete(row)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
