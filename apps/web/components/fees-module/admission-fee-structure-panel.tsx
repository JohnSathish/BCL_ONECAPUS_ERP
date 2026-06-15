'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Layers, Save } from 'lucide-react';
import { fetchFeeCycles, fetchFeeHeads, updateFeeCycle } from '@/services/fee-cycle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/utils/api-error';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function AdmissionFeeStructurePanel() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const cyclesQ = useQuery({ queryKey: ['fee-cycles'], queryFn: () => fetchFeeCycles() });
  const headsQ = useQuery({ queryKey: ['fee-heads'], queryFn: () => fetchFeeHeads() });

  const cycles = cyclesQ.data ?? [];
  const selected = cycles.find((c) => c.id === selectedId) ?? cycles[0] ?? null;

  const computedTotal = useMemo(() => {
    if (!selected?.lines) return 0;
    return selected.lines.reduce((sum, line) => {
      const key = line.id;
      const val = lineAmounts[key] ?? String(line.amount);
      return sum + Number(val || 0);
    }, 0);
  }, [selected, lineAmounts]);

  const saveMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No cycle selected');
      const lines = (selected.lines ?? []).map((line) => ({
        feeHeadId: line.feeHeadId,
        amount: Number(lineAmounts[line.id] ?? line.amount),
        sortOrder: line.sortOrder,
      }));
      return updateFeeCycle(selected.id, { lines, totalAmount: computedTotal });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fee-cycles'] });
      setMessage(
        selected
          ? `${selected.name} saved — total updated to ${formatInr(computedTotal)}.`
          : 'Fee structure saved successfully.',
      );
    },
    onError: () => setMessage(''),
  });

  return (
    <Card className="glass-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Admission & Session Fee Structure
        </CardTitle>
        <CardDescription>
          FYUP model — configure fee heads per semester group (I–II, III–IV, V–VI, VII–VIII). Total
          is calculated automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {cycles.map((cycle) => (
            <button
              key={cycle.id}
              type="button"
              onClick={() => {
                setSelectedId(cycle.id);
                setLineAmounts({});
                setMessage('');
              }}
              className={`w-full rounded-xl border px-4 py-3 text-left ${
                selected?.id === cycle.id ? 'border-primary bg-primary/5' : 'border-border'
              }`}
            >
              <p className="font-semibold">{cycle.name}</p>
              <p className="text-xs text-muted-foreground">
                Sem {ROMAN[cycle.startSemester - 1]} & {ROMAN[cycle.endSemester - 1]}
              </p>
              <p className="mt-1 text-sm font-medium">{formatInr(Number(cycle.totalAmount))}</p>
            </button>
          ))}
        </div>

        {selected ? (
          <div>
            <h3 className="text-lg font-semibold">{selected.name}</h3>
            <p className="text-sm text-muted-foreground">{selected.description}</p>
            <div className="mt-4 overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Fee head</th>
                    <th className="px-3 py-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {(selected.lines ?? []).map((line) => (
                    <tr key={line.id} className="border-t">
                      <td className="px-3 py-2">{line.feeHead?.name ?? line.feeHeadId}</td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          className="ml-auto h-8 w-28 text-right"
                          type="number"
                          defaultValue={String(line.amount)}
                          onChange={(e) =>
                            setLineAmounts((prev) => ({ ...prev, [line.id]: e.target.value }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">{formatInr(computedTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Button className="mt-4" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              <Save className="mr-2 h-4 w-4" />
              {saveMut.isPending ? 'Saving…' : 'Save structure'}
            </Button>
            {message ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{message}</p>
              </div>
            ) : null}
            {saveMut.error ? (
              <p className="mt-2 text-sm text-destructive">
                {apiErrorMessage(saveMut.error, 'Save failed')}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
      {headsQ.data ? (
        <p className="px-6 pb-4 text-xs text-muted-foreground">
          Master catalog: {headsQ.data.count} heads · {formatInr(headsQ.data.totalAmount)} reference
          total
        </p>
      ) : null}
    </Card>
  );
}
