'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckSquare, Loader2, Printer, Square } from 'lucide-react';
import {
  fetchRecentFeeReceipts,
  openBulkFeeReceiptPdf,
  saveBulkFeeReceiptPdf,
} from '@/services/fee-cycle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function BulkReceiptPrintPanel({
  extraReceiptIds,
  className,
  /** Sync receipt date with parent (e.g. day closing) */
  controlledDate,
  hideDatePicker = false,
  title = 'Bulk receipt print',
  description = 'Select receipts and print on half-A4 (2 per sheet) or full-page layout. Optimized for cutting one A4 into two receipts.',
}: {
  extraReceiptIds?: string[];
  className?: string;
  controlledDate?: string;
  hideDatePicker?: boolean;
  title?: string;
  description?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(controlledDate ?? today);
  const [layout, setLayout] = useState<'two_per_page' | 'single'>('two_per_page');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (controlledDate) setDate(controlledDate);
  }, [controlledDate]);

  const receiptsQ = useQuery({
    queryKey: ['fee-receipts-recent', date],
    queryFn: () => fetchRecentFeeReceipts({ date, limit: 100 }),
    staleTime: 30_000,
  });

  const rows = receiptsQ.data ?? [];

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);

  const printMut = useMutation({
    mutationFn: async (mode: 'open' | 'save') => {
      const ids = [...selected];
      if (!ids.length) throw new Error('Select at least one receipt');
      if (mode === 'open') await openBulkFeeReceiptPdf(ids, layout);
      else await saveBulkFeeReceiptPdf(ids, layout);
    },
    onSuccess: (_, mode) => {
      setMessage(mode === 'open' ? 'Bulk PDF opened for printing.' : 'Bulk PDF downloaded.');
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Bulk print failed')),
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allIds));
  }

  function clearAll() {
    setSelected(new Set());
  }

  function selectExtra() {
    if (!extraReceiptIds?.length) return;
    setSelected((prev) => new Set([...prev, ...extraReceiptIds]));
  }

  return (
    <Card className={cn('border-primary/15', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Printer className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          {!hideDatePicker ? (
            <div className="space-y-1">
              <Label className="text-xs">Receipt date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSelected(new Set());
                }}
                className="h-9 w-40"
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Closing date: <strong>{date}</strong>
            </p>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Print layout</Label>
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant={layout === 'two_per_page' ? 'default' : 'outline'}
                onClick={() => setLayout('two_per_page')}
              >
                2 per A4 (recommended)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={layout === 'single' ? 'default' : 'outline'}
                onClick={() => setLayout('single')}
              >
                1 per page
              </Button>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={selectAll}
              disabled={!rows.length}
            >
              <CheckSquare className="mr-1 h-3.5 w-3.5" />
              Select all ({rows.length})
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
              Clear
            </Button>
            {extraReceiptIds?.length ? (
              <Button type="button" size="sm" variant="outline" onClick={selectExtra}>
                Add current student
              </Button>
            ) : null}
          </div>
        </div>

        <div className="max-h-56 overflow-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-10 px-2 py-2" />
                <th className="px-2 py-2">Receipt</th>
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2 text-right">Amount</th>
                <th className="px-2 py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    'border-t cursor-pointer hover:bg-muted/40',
                    selected.has(r.id) && 'bg-primary/5',
                  )}
                  onClick={() => toggle(r.id)}
                >
                  <td className="px-2 py-2">
                    {selected.has(r.id) ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{r.receiptNo}</td>
                  <td className="px-2 py-2">
                    <span className="font-medium">{r.studentName}</span>
                    {r.enrollmentNumber ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {r.enrollmentNumber}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">{formatInr(r.amount)}</td>
                  <td className="px-2 py-2 text-xs text-muted-foreground">
                    {new Date(r.issuedAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
              {!rows.length && !receiptsQ.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No receipts for this date.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            disabled={!selected.size || printMut.isPending}
            onClick={() => printMut.mutate('open')}
          >
            {printMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            Print {selected.size ? `(${selected.size})` : ''}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!selected.size || printMut.isPending}
            onClick={() => printMut.mutate('save')}
          >
            Download PDF
          </Button>
          <span className="text-xs text-muted-foreground">
            {layout === 'two_per_page'
              ? 'Half A4 portrait · 2 receipts per sheet'
              : 'Full page per receipt'}
          </span>
        </div>

        {message ? (
          <p
            className={cn(
              'text-sm',
              message.includes('failed') ? 'text-destructive' : 'text-emerald-700',
            )}
          >
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
