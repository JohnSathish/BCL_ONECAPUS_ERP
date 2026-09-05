'use client';

import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function SchoolOfficeWorkQueueTable({
  columns,
  rows,
  emptyMessage = 'No records found.',
  className,
}: {
  columns: Array<{ key: string; header: string; className?: string }>;
  rows: Array<{ id: string; cells: Record<string, ReactNode> }>;
  emptyMessage?: string;
  className?: string;
}) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border bg-white shadow-sm', className)}>
      <table className="min-w-full text-left text-sm">
        <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={cn('px-3 py-2.5 font-semibold', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-sm text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0 hover:bg-slate-50/80">
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-3 py-2.5 align-middle', col.className)}>
                    {row.cells[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function SchoolOfficeSummaryCards({
  cards,
}: {
  cards: Array<{
    id: string;
    label: string;
    value: string | number;
    hint?: string;
  }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <div key={card.id} className="rounded-xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--school-erp-muted)]">
            {card.label}
          </p>
          <p className="mt-1 text-2xl font-semibold text-[var(--school-erp-primary)]">
            {card.value}
          </p>
          {card.hint ? <p className="mt-0.5 text-xs text-slate-500">{card.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
