'use client';

import { cn } from '@/utils/cn';

type Cell = { row: string; col: string; value: number };

type Props = {
  cells: Cell[];
  className?: string;
};

export function HeatmapGrid({ cells, className }: Props) {
  const rows = [...new Set(cells.map((c) => c.row))];
  const cols = [...new Set(cells.map((c) => c.col))];
  const max = Math.max(...cells.map((c) => c.value), 1);

  const valueAt = (row: string, col: string) =>
    cells.find((c) => c.row === row && c.col === col)?.value ?? 0;

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-[280px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="p-2 text-left font-medium text-muted-foreground" />
            {cols.map((col) => (
              <th key={col} className="p-2 text-center font-medium text-muted-foreground">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <td className="p-2 font-medium text-foreground">{row}</td>
              {cols.map((col) => {
                const v = valueAt(row, col);
                const intensity = v / max;
                return (
                  <td key={col} className="p-1">
                    <div
                      className="flex h-9 min-w-[2.5rem] items-center justify-center rounded-md text-[10px] font-semibold"
                      style={{
                        background: `color-mix(in srgb, var(--institution-primary, hsl(var(--primary))) ${Math.round(intensity * 85)}%, transparent)`,
                        color: intensity > 0.55 ? 'white' : 'hsl(var(--foreground))',
                      }}
                      title={`${row} · ${col}: ${v}`}
                    >
                      {v}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
