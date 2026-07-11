'use client';

import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function money(n: unknown) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return String(n ?? '—');
  return `₹${v.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function flattenRows(rows: unknown): Record<string, unknown>[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (row == null || typeof row !== 'object') {
      return { value: row };
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      if (v != null && typeof v === 'object' && !Array.isArray(v)) {
        for (const [sk, sv] of Object.entries(v as Record<string, unknown>)) {
          out[`${k}.${sk}`] = sv;
        }
      } else if (Array.isArray(v)) {
        out[k] = JSON.stringify(v);
      } else {
        out[k] = v;
      }
    }
    return out;
  });
}

function formatCell(key: string, value: unknown) {
  if (value == null || value === '') return '—';
  if (
    /amount|fee|total|collection/i.test(key) &&
    (typeof value === 'number' ||
      (typeof value === 'string' && value !== '' && !Number.isNaN(Number(value))))
  ) {
    return money(value);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function toCsv(columns: string[], rows: Record<string, unknown>[]) {
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    columns.join(','),
    ...rows.map((row) => columns.map((c) => escape(row[c])).join(',')),
  ];
  return lines.join('\n');
}

export function ExamFeeReportPanel({
  title,
  rows,
  tabLabel,
}: {
  title: string;
  rows: unknown;
  tabLabel: string;
}) {
  const flat = useMemo(() => flattenRows(rows), [rows]);
  const columns = useMemo(() => {
    const keys = new Set<string>();
    for (const row of flat) {
      Object.keys(row).forEach((k) => keys.add(k));
    }
    return [...keys];
  }, [flat]);

  function downloadCsv() {
    const csv = toCsv(columns, flat);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exam-fee-${tabLabel.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {flat.length} row{flat.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!flat.length}
          onClick={downloadCsv}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        {!flat.length ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No records for this report yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {col.replace(/([A-Z])/g, ' $1').replace(/\./g, ' · ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {flat.map((row, idx) => (
                  <tr key={idx} className="border-t">
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-2 align-top">
                        {col.toLowerCase().includes('status') ? (
                          <Badge variant="secondary">{formatCell(col, row[col])}</Badge>
                        ) : (
                          formatCell(col, row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
