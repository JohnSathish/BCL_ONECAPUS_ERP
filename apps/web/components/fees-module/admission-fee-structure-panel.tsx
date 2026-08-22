'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Layers, Plus, Save, Trash2 } from 'lucide-react';
import { fetchFeeCycles, fetchFeeHeads, updateFeeCycle } from '@/services/fee-cycle';
import type { FeeHeadMaster } from '@/types/fee-cycle';
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

type DraftHead = {
  feeHeadId: string;
  amount: string;
  feeHead: FeeHeadMaster;
};

export function AdmissionFeeStructurePanel() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});
  const [addedHeads, setAddedHeads] = useState<DraftHead[]>([]);
  const [removedLineIds, setRemovedLineIds] = useState<string[]>([]);
  const [headToAdd, setHeadToAdd] = useState('');
  const [message, setMessage] = useState('');

  const cyclesQ = useQuery({ queryKey: ['fee-cycles'], queryFn: () => fetchFeeCycles() });
  const headsQ = useQuery({ queryKey: ['fee-heads'], queryFn: () => fetchFeeHeads() });

  const cycles = cyclesQ.data ?? [];
  const selected = cycles.find((c) => c.id === selectedId) ?? cycles[0] ?? null;
  const masterHeads = headsQ.data?.heads ?? [];

  const visibleLines = useMemo(
    () => (selected?.lines ?? []).filter((line) => !removedLineIds.includes(line.id)),
    [selected, removedLineIds],
  );

  const usedHeadIds = useMemo(() => {
    const ids = new Set(visibleLines.map((line) => line.feeHeadId));
    for (const row of addedHeads) ids.add(row.feeHeadId);
    return ids;
  }, [visibleLines, addedHeads]);

  const availableHeads = masterHeads.filter(
    (head) => head.isActive !== false && !usedHeadIds.has(head.id),
  );

  const computedTotal = useMemo(() => {
    const existing = visibleLines.reduce((sum, line) => {
      const val = lineAmounts[line.id] ?? String(line.amount);
      return sum + Number(val || 0);
    }, 0);
    const extra = addedHeads.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    return existing + extra;
  }, [visibleLines, lineAmounts, addedHeads]);

  const resetDraft = () => {
    setLineAmounts({});
    setAddedHeads([]);
    setRemovedLineIds([]);
    setHeadToAdd('');
    setMessage('');
  };

  const saveMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No cycle selected');
      const existing = visibleLines.map((line, index) => ({
        feeHeadId: line.feeHeadId,
        amount: Number(lineAmounts[line.id] ?? line.amount),
        sortOrder: line.sortOrder ?? (index + 1) * 10,
      }));
      const extra = addedHeads.map((row, index) => ({
        feeHeadId: row.feeHeadId,
        amount: Number(row.amount || 0),
        sortOrder: (existing.length + index + 1) * 10,
      }));
      return updateFeeCycle(selected.id, {
        lines: [...existing, ...extra],
        totalAmount: computedTotal,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fee-cycles'] });
      setAddedHeads([]);
      setRemovedLineIds([]);
      setLineAmounts({});
      setMessage(
        selected
          ? `${selected.name} saved — total ${formatInr(computedTotal)}. Other cycles were not changed.`
          : 'Fee structure saved successfully.',
      );
    },
    onError: () => setMessage(''),
  });

  const addSelectedHead = () => {
    const head = availableHeads.find((row) => row.id === headToAdd);
    if (!head) return;
    setAddedHeads((prev) => [
      ...prev,
      { feeHeadId: head.id, amount: String(head.amount), feeHead: head },
    ]);
    setHeadToAdd('');
    setMessage('');
  };

  return (
    <Card className="glass-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Admission & Session Fee Structure
        </CardTitle>
        <CardDescription>
          Heads and amounts are saved only for the selected cycle (I–II, III–IV, V–VI, or VII–VIII).
          Adding ID Card to Cycle 4 does not add it to Cycle 2 or Cycle 3.
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
                resetDraft();
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
                    <th className="px-3 py-2 text-right">This cycle</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLines.map((line) => (
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
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          title="Remove from this cycle only"
                          onClick={() =>
                            setRemovedLineIds((prev) =>
                              prev.includes(line.id) ? prev : [...prev, line.id],
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {addedHeads.map((row) => (
                    <tr key={`new-${row.feeHeadId}`} className="border-t bg-primary/5">
                      <td className="px-3 py-2">
                        {row.feeHead.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          New on this cycle
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          className="ml-auto h-8 w-28 text-right"
                          type="number"
                          value={row.amount}
                          onChange={(e) =>
                            setAddedHeads((prev) =>
                              prev.map((item) =>
                                item.feeHeadId === row.feeHeadId
                                  ? { ...item, amount: e.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() =>
                            setAddedHeads((prev) =>
                              prev.filter((item) => item.feeHeadId !== row.feeHeadId),
                            )
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">{formatInr(computedTotal)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-semibold">Add a fee head to {selected.name} only</p>
              <p className="text-xs text-muted-foreground">
                Choose ID Card here to charge it on Semester VII &amp; VIII. This does not add it to
                Cycle 2 or Cycle 3.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <select
                  className="h-9 min-w-[240px] flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  value={headToAdd}
                  onChange={(e) => setHeadToAdd(e.target.value)}
                >
                  <option value="">Select a head (e.g. ID Card)</option>
                  {availableHeads.map((head) => (
                    <option key={head.id} value={head.id}>
                      {head.name} — {formatInr(Number(head.amount))}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!headToAdd}
                  onClick={addSelectedHead}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add to this cycle
                </Button>
              </div>
              {availableHeads.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Every master head is already on this cycle. Create a new head under Fee Head
                  Master first, then add it here.
                </p>
              ) : null}
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
          total. Catalog heads are shared; cycle lines are independent.
        </p>
      ) : null}
    </Card>
  );
}
