'use client';

import type { SharedPoolAuditRow } from '@/types/curriculum-completion';
import { STATUS_STYLES } from '@/types/curriculum-completion';

type Props = {
  rows: SharedPoolAuditRow[];
  isLoading: boolean;
};

export function SharedPoolsAuditPanel({ rows, isLoading }: Props) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading shared pool audit…</p>;
  }

  const failing = rows.filter((r) => r.status !== 'COMPLETE');
  if (!rows.length) {
    return <p className="text-sm text-muted-foreground">No pool data available.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {failing.length} pool slot{failing.length === 1 ? '' : 's'} need attention across MDC, AEC,
        SEC, VAC, VTC
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Sem</th>
              <th className="px-3 py-2 text-left">Pool</th>
              <th className="px-3 py-2 text-left">Courses</th>
              <th className="px-3 py-2 text-left">Sections</th>
              <th className="px-3 py-2 text-left">Programmes</th>
              <th className="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.category}-${row.semesterNo}`} className="border-b border-border/60">
                <td className="px-3 py-2 font-medium">{row.category}</td>
                <td className="px-3 py-2">{row.semesterNo}</td>
                <td className="px-3 py-2">{row.poolName ?? (row.poolExists ? '—' : 'Missing')}</td>
                <td className="px-3 py-2">{row.courseCount}</td>
                <td className="px-3 py-2">{row.sectionCount}</td>
                <td className="px-3 py-2">{row.programmesAssigned}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${STATUS_STYLES[row.status]}`}
                  >
                    {row.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
