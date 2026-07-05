'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cleanupOrphanFeeDemands, fetchOrphanFeeDemands } from '@/services/fees';

function money(value?: number) {
  return `₹${Number(value ?? 0).toLocaleString('en-IN')}`;
}

export function OrphanDemandsPanel() {
  const qc = useQueryClient();
  const listQ = useQuery({
    queryKey: ['fees', 'orphan-demands'],
    queryFn: fetchOrphanFeeDemands,
    staleTime: 30_000,
  });

  const cleanupMut = useMutation({
    mutationFn: (dryRun: boolean) => cleanupOrphanFeeDemands({ dryRun }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['fees', 'orphan-demands'] });
      await qc.invalidateQueries({ queryKey: ['fees'] });
    },
  });

  const summary = listQ.data?.summary;
  const rows = listQ.data?.rows ?? [];
  const cancellableAmount = rows
    .filter((r) => r.canAutoCancel)
    .reduce((s, r) => s + r.balanceAmount, 0);

  if (listQ.isLoading) {
    return (
      <Card className="border-amber-200 bg-amber-50/40">
        <CardContent className="flex items-center gap-2 py-4 text-sm text-amber-900">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking orphan fee demands…
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.total === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/40">
        <CardContent className="py-4 text-sm font-medium text-emerald-800">
          Outstanding fee reports are accurate — no orphan demands (missing student records).
        </CardContent>
      </Card>
    );
  }

  const result = cleanupMut.data;

  return (
    <Card className="border-amber-300 bg-amber-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-amber-950">
          <AlertTriangle className="h-4 w-4" />
          Orphan fee demands (data cleanup)
        </CardTitle>
        <p className="text-sm text-amber-900/80">
          These demands reference students that no longer exist. They inflate outstanding totals and
          appear without names on reports. Unpaid orphans can be cancelled safely.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <Stat label="Orphan demands" value={String(summary.total)} />
          <Stat label="Cancellable (unpaid)" value={String(summary.cancellable)} />
          <Stat label="Blocked (has payments)" value={String(summary.blockedPaid)} />
          <Stat label="Outstanding amount" value={money(summary.outstandingAmount)} />
        </div>

        <div className="max-h-40 overflow-auto rounded-lg border border-amber-200 bg-white">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-amber-100/80 text-amber-950">
              <tr>
                <th className="px-2 py-1.5">Demand</th>
                <th className="px-2 py-1.5">Type</th>
                <th className="px-2 py-1.5">Balance</th>
                <th className="px-2 py-1.5">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 25).map((r) => (
                <tr key={r.id} className="border-t border-amber-100">
                  <td className="px-2 py-1 font-medium">{r.demandNo}</td>
                  <td className="px-2 py-1">{r.demandType}</td>
                  <td className="px-2 py-1">{money(r.balanceAmount)}</td>
                  <td className="px-2 py-1">
                    {r.canAutoCancel ? (
                      <span className="text-emerald-700">Can cancel</span>
                    ) : (
                      <span className="text-rose-700">{r.blockReason}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 25 ? (
            <p className="border-t border-amber-100 px-2 py-1 text-[11px] text-amber-800">
              Showing 25 of {rows.length}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={cleanupMut.isPending}
            onClick={() => cleanupMut.mutate(true)}
          >
            Preview cleanup
          </Button>
          <Button
            size="sm"
            className="bg-amber-700 hover:bg-amber-800"
            disabled={cleanupMut.isPending || summary.cancellable === 0}
            onClick={() => {
              if (
                !window.confirm(
                  `Cancel ${summary.cancellable} unpaid orphan demand(s) totalling ${money(cancellableAmount)}? This cannot be undone automatically.`,
                )
              ) {
                return;
              }
              cleanupMut.mutate(false);
            }}
          >
            {cleanupMut.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Cancel unpaid orphans
          </Button>
        </div>

        {result ? (
          <p className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950">
            {result.dryRun
              ? `Preview: would cancel ${result.wouldCancel} demand(s) worth ${money(result.wouldCancelAmount)}. Skipped ${result.skipped} paid.`
              : `Cancelled ${result.cancelled} demand(s) worth ${money(result.cancelledAmount)}. Skipped ${result.skipped} paid. Outstanding reports now exclude these rows.`}
            {result.errors?.length ? ` Errors: ${result.errors.length}.` : null}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/80">{label}</p>
      <p className="text-sm font-bold text-amber-950">{value}</p>
    </div>
  );
}
