'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarRange, CheckCircle2, Layers, Plus } from 'lucide-react';
import {
  activateFeeCycle,
  bulkGenerateCycleDemands,
  createFeeCycle,
  deactivateFeeCycle,
  fetchFeeCycles,
  fetchFeeHeads,
} from '@/services/fee-cycle';
import type { AcademicFeeCycle } from '@/types/fee-cycle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function semesterLabel(n: number) {
  return `Semester ${ROMAN[n - 1] ?? n}`;
}

export function FeeCycleConfigPanel() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cyclesQ = useQuery({
    queryKey: ['fee-cycles'],
    queryFn: () => fetchFeeCycles(),
  });

  const headsQ = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => fetchFeeHeads(true),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['fee-cycles'] });

  const activateMut = useMutation({
    mutationFn: activateFeeCycle,
    onSuccess: invalidate,
  });

  const deactivateMut = useMutation({
    mutationFn: deactivateFeeCycle,
    onSuccess: invalidate,
  });

  const bulkMut = useMutation({
    mutationFn: bulkGenerateCycleDemands,
  });

  const cycles = cyclesQ.data ?? [];
  const selected = cycles.find((c) => c.id === selectedId) ?? cycles[0] ?? null;

  return (
    <div className="space-y-6">
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Fee Cycle Configuration
          </CardTitle>
          <CardDescription>
            Don Bosco FYUP model: one demand per academic year covering two semesters. Demands are
            auto-generated when a student enters Semester I, III, V, or VII.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-2">
            {cycles.map((cycle) => (
              <button
                key={cycle.id}
                type="button"
                onClick={() => setSelectedId(cycle.id)}
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-left transition',
                  selected?.id === cycle.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/40',
                )}
              >
                <p className="font-semibold">{cycle.name}</p>
                <p className="text-xs text-muted-foreground">
                  {semesterLabel(cycle.startSemester)} & {semesterLabel(cycle.endSemester)}
                </p>
                <p className="mt-1 text-sm font-medium">{formatInr(Number(cycle.totalAmount))}</p>
                <StatusPill status={cycle.status} />
              </button>
            ))}
            <CreateCycleForm heads={headsQ.data?.heads ?? []} onCreated={invalidate} />
          </div>

          {selected ? (
            <CycleDetail
              cycle={selected}
              onActivate={() => activateMut.mutate(selected.id)}
              onDeactivate={() => deactivateMut.mutate(selected.id)}
              onGenerate={() =>
                bulkMut.mutate({ semesterNumber: selected.startSemester, publish: true })
              }
              generating={bulkMut.isPending}
              generateResult={
                bulkMut.data as { createdCount?: number; skippedCount?: number } | undefined
              }
            />
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
              No fee cycles configured yet. Seed defaults or create a cycle.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CycleDetail({
  cycle,
  onActivate,
  onDeactivate,
  onGenerate,
  generating,
  generateResult,
}: {
  cycle: AcademicFeeCycle;
  onActivate: () => void;
  onDeactivate: () => void;
  onGenerate: () => void;
  generating: boolean;
  generateResult?: { createdCount?: number; skippedCount?: number };
}) {
  const lineTotal = useMemo(
    () => (cycle.lines ?? []).reduce((sum, line) => sum + Number(line.amount), 0),
    [cycle.lines],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{cycle.name}</h3>
          <p className="text-sm text-muted-foreground">{cycle.description}</p>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <CalendarRange className="h-4 w-4" />
            Covers {semesterLabel(cycle.startSemester)} & {semesterLabel(cycle.endSemester)}
            {cycle.fyugpYear ? ` · FYUGP Year ${cycle.fyugpYear}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {cycle.status !== 'ACTIVE' ? (
            <Button size="sm" onClick={onActivate}>
              Activate
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onDeactivate}>
              Deactivate
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            disabled={generating || cycle.status !== 'ACTIVE'}
            onClick={onGenerate}
          >
            Generate demands (Sem {ROMAN[cycle.startSemester - 1]})
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Cycle amount" value={formatInr(Number(cycle.totalAmount))} />
        <Metric label="Head breakdown" value={formatInr(lineTotal)} />
        <Metric label="Status" value={cycle.status} />
      </div>

      {generateResult ? (
        <p className="text-sm text-muted-foreground">
          Bulk run: {generateResult.createdCount ?? 0} created, {generateResult.skippedCount ?? 0}{' '}
          skipped.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Fee head</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(cycle.lines ?? []).map((line) => (
              <tr key={line.id} className="border-t border-border">
                <td className="px-3 py-2">{line.feeHead?.name ?? line.feeHeadId}</td>
                <td className="px-3 py-2 text-right">{formatInr(Number(line.amount))}</td>
              </tr>
            ))}
            <tr className="border-t border-border font-semibold">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">{formatInr(Number(cycle.totalAmount))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <p className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4" />
          Core rule enforced
        </p>
        <p className="mt-1 text-xs">
          No demand is generated for Semester {ROMAN[cycle.endSemester - 1]} — the prior cycle
          payment covers both semesters in this pair.
        </p>
      </div>
    </div>
  );
}

function CreateCycleForm({
  heads,
  onCreated,
}: {
  heads: Array<{ id: string; code: string; name: string; amount: number }>;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [startSemester, setStartSemester] = useState('1');
  const [totalAmount, setTotalAmount] = useState('9500');

  const createMut = useMutation({
    mutationFn: () => {
      const start = Number(startSemester);
      return createFeeCycle({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        startSemester: start,
        endSemester: start + 1,
        fyugpYear: Math.ceil(start / 2),
        totalAmount: Number(totalAmount),
        status: 'DRAFT',
        lines: heads.map((head, index) => ({
          feeHeadId: head.id,
          amount: Number(head.amount),
          sortOrder: (index + 1) * 10,
        })),
      });
    },
    onSuccess: () => {
      setOpen(false);
      setCode('');
      setName('');
      onCreated();
    },
  });

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        New cycle
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-border p-3 space-y-2">
      <Label>Code</Label>
      <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CYCLE_4" />
      <Label>Name</Label>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Admission Cycle" />
      <Label>Start semester (I, III, V, or VII)</Label>
      <Input
        type="number"
        min={1}
        max={7}
        step={2}
        value={startSemester}
        onChange={(e) => setStartSemester(e.target.value)}
      />
      <Label>Total amount (₹)</Label>
      <Input type="number" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
      <div className="flex gap-2 pt-1">
        <Button size="sm" disabled={createMut.isPending} onClick={() => createMut.mutate()}>
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {createMut.error ? (
        <p className="text-xs text-destructive">
          {apiErrorMessage(createMut.error, 'Could not create cycle')}
        </p>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const active = status === 'ACTIVE';
  return (
    <span
      className={cn(
        'mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
        active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600',
      )}
    >
      {status}
    </span>
  );
}
