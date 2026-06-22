'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { History } from 'lucide-react';
import type { FeePaymentHistoryRow } from '@/types/fee-cycle';
import { openFeeReceiptPdf } from '@/services/fee-cycle';
import { clearChequePayment } from '@/services/fees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function FeePaymentHistoryCard({
  rows,
  onUpdated,
}: {
  rows: FeePaymentHistoryRow[];
  onUpdated?: () => void;
}) {
  const qc = useQueryClient();
  const clearMut = useMutation({
    mutationFn: (paymentId: string) => clearChequePayment(paymentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fee-account'] });
      onUpdated?.();
    },
  });
  if (!rows.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Payment history
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Payment history
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[280px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="pb-2 pr-2">Date</th>
              <th className="pb-2 pr-2 text-right">Amount</th>
              <th className="pb-2 pr-2">Method</th>
              <th className="pb-2 pr-2">Reference</th>
              <th className="pb-2">Collected by</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((row) => (
              <tr key={row.id} className="border-t align-top">
                <td className="py-2 pr-2 whitespace-nowrap">
                  {new Date(row.paidAt).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className="py-2 pr-2 text-right font-medium">{formatInr(row.amount)}</td>
                <td className="py-2 pr-2">
                  <span className="block">{row.paymentMethodLabel ?? row.paymentSourceLabel}</span>
                  {row.clearanceStatus === 'PENDING' ? (
                    <div className="mt-1 space-y-1">
                      <Badge variant="outline" className="text-[10px]">
                        Pending clearance
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-full text-[10px]"
                        disabled={clearMut.isPending}
                        onClick={() => clearMut.mutate(row.id)}
                      >
                        Mark cleared
                      </Button>
                    </div>
                  ) : null}
                </td>
                <td className="py-2 pr-2 font-mono text-xs">
                  {row.utrNumber || row.externalReference || '—'}
                </td>
                <td className="py-2">
                  <span className="block">{row.collectedByName ?? '—'}</span>
                  {row.receiptId ? (
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => void openFeeReceiptPdf(row.receiptId!)}
                    >
                      {row.receiptNo ?? 'Receipt'}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
