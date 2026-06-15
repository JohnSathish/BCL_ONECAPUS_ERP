'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, IndianRupee, Plus, Trash2 } from 'lucide-react';
import {
  createFeeHead,
  deleteFeeHead,
  fetchFeeHeads,
  reorderFeeHeads,
  updateFeeHead,
} from '@/services/fee-cycle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiErrorMessage } from '@/utils/api-error';

function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function FeeHeadMasterPanel() {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');

  const headsQ = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => fetchFeeHeads(),
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['fee-heads'] });

  const createMut = useMutation({
    mutationFn: () =>
      createFeeHead({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        amount: Number(amount),
      }),
    onSuccess: () => {
      setCode('');
      setName('');
      setAmount('');
      invalidate();
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateFeeHead(id, payload),
    onSuccess: invalidate,
  });

  const deleteMut = useMutation({
    mutationFn: deleteFeeHead,
    onSuccess: invalidate,
  });

  const reorderMut = useMutation({
    mutationFn: reorderFeeHeads,
    onSuccess: invalidate,
  });

  const heads = headsQ.data?.heads ?? [];

  const move = (index: number, direction: -1 | 1) => {
    const next = [...heads];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorderMut.mutate(next.map((h) => h.id));
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Fee Head Master
          </CardTitle>
          <CardDescription>
            Configure reusable fee heads (Admission, Library, Development, etc.). Cycles compose
            these heads into biennial demands — Sem I+II, III+IV, V+VI.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
            <span className="font-medium">{heads.length} heads</span>
            {' · '}
            <span>Master total: {formatInr(headsQ.data?.totalAmount ?? 0)}</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Head name</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Active</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {heads.map((head, index) => (
                  <tr key={head.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{head.code}</td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8"
                        defaultValue={head.name}
                        onBlur={(e) => {
                          if (e.target.value !== head.name) {
                            updateMut.mutate({ id: head.id, payload: { name: e.target.value } });
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-8 w-28"
                        type="number"
                        defaultValue={String(head.amount)}
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (val !== head.amount) {
                            updateMut.mutate({ id: head.id, payload: { amount: val } });
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Switch
                        checked={head.isActive}
                        onCheckedChange={(checked) =>
                          updateMut.mutate({ id: head.id, payload: { isActive: checked } })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteMut.mutate(head.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="text-base">Add fee head</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="LIBRARY" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Head name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Library" />
          </div>
          <div className="space-y-1">
            <Label>Amount (₹)</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="sm:col-span-4">
            <Button
              disabled={!code || !name || !amount || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add head
            </Button>
            {createMut.error ? (
              <p className="mt-2 text-sm text-destructive">
                {apiErrorMessage(createMut.error, 'Could not create fee head')}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
