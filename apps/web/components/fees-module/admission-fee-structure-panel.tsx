'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CheckCircle2, Layers, Plus, Save, Trash2 } from 'lucide-react';
import { fetchFeeCycles, fetchFeeHeads, updateFeeCycle } from '@/services/fee-cycle';
import type { AcademicFeeCycle, FeeHeadMaster } from '@/types/fee-cycle';
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

type DraftRow = {
  key: string;
  feeHeadId: string;
  name: string;
  amount: string;
  isNew?: boolean;
};

function rowsFromCycle(cycle: AcademicFeeCycle | null): DraftRow[] {
  return (cycle?.lines ?? []).map((line) => ({
    key: line.id,
    feeHeadId: line.feeHeadId,
    name: line.feeHead?.name ?? line.feeHeadId,
    amount: String(line.amount),
  }));
}

export function AdmissionFeeStructurePanel() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftRows, setDraftRows] = useState<DraftRow[] | null>(null);
  const [headToAdd, setHeadToAdd] = useState('');
  const [message, setMessage] = useState('');

  const cyclesQ = useQuery({ queryKey: ['fee-cycles'], queryFn: () => fetchFeeCycles() });
  const headsQ = useQuery({ queryKey: ['fee-heads'], queryFn: () => fetchFeeHeads() });

  const cycles = cyclesQ.data ?? [];
  const selected = cycles.find((c) => c.id === selectedId) ?? cycles[0] ?? null;
  const masterHeads = headsQ.data?.heads ?? [];
  const rows = draftRows ?? rowsFromCycle(selected);

  const usedHeadIds = useMemo(() => new Set(rows.map((row) => row.feeHeadId)), [rows]);
  const availableHeads = masterHeads.filter(
    (head) => head.isActive !== false && !usedHeadIds.has(head.id),
  );
  const computedTotal = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const resetDraft = () => {
    setDraftRows(null);
    setHeadToAdd('');
    setMessage('');
  };

  const updateRows = (next: DraftRow[]) => setDraftRows(next);

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const current = next[index];
    const swap = next[target];
    if (!current || !swap) return;
    next[index] = swap;
    next[target] = current;
    updateRows(next);
  };

  const saveMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No cycle selected');
      return updateFeeCycle(selected.id, {
        lines: rows.map((row, index) => ({
          feeHeadId: row.feeHeadId,
          amount: Number(row.amount || 0),
          sortOrder: (index + 1) * 10,
        })),
        totalAmount: computedTotal,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['fee-cycles'] });
      setDraftRows(null);
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
    updateRows([
      ...rows,
      {
        key: `new-${head.id}`,
        feeHeadId: head.id,
        name: head.name,
        amount: String(head.amount),
        isNew: true,
      },
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
          Heads, amounts, and order are saved only for the selected cycle. Use the arrows to move a
          head up or down, then Save structure.
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
                    <th className="px-3 py-2">Order</th>
                    <th className="px-3 py-2">Fee head</th>
                    <th className="px-3 py-2 text-right">Amount (₹)</th>
                    <th className="px-3 py-2 text-right">This cycle</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.key} className={`border-t ${row.isNew ? 'bg-primary/5' : ''}`}>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={index === 0}
                            title="Move up"
                            onClick={() => moveRow(index, -1)}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={index === rows.length - 1}
                            title="Move down"
                            onClick={() => moveRow(index, 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {row.name}
                        {row.isNew ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            New on this cycle
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Input
                          className="ml-auto h-8 w-28 text-right"
                          type="number"
                          value={row.amount}
                          onChange={(e) =>
                            updateRows(
                              rows.map((item) =>
                                item.key === row.key ? { ...item, amount: e.target.value } : item,
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
                          title="Remove from this cycle only"
                          onClick={() => updateRows(rows.filter((item) => item.key !== row.key))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold">
                    <td className="px-3 py-2" colSpan={2}>
                      Total
                    </td>
                    <td className="px-3 py-2 text-right">{formatInr(computedTotal)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-semibold">Add a fee head to {selected.name} only</p>
              <p className="text-xs text-muted-foreground">
                Added heads apply only to this cycle. After adding, use the arrows to place ID Card
                where you want it, then Save structure.
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
