'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle2, IndianRupee, Plus, Save } from 'lucide-react';
import {
  createMonthlyPlan,
  fetchMonthlyPlans,
  generateMonthlyDemands,
  updateMonthlyPlan,
} from '@/services/fee-cycle';
import { MonthlyFeeSetupGuide } from '@/components/fees-module/monthly-fee-setup-guide';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/utils/api-error';

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export function MonthlyFeePlansPanel() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lineAmounts, setLineAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newPlan, setNewPlan] = useState({
    code: '',
    name: '',
    majorSlug: '',
    tuition: '500',
    collegeFee: '200',
    development: '100',
  });

  const plansQ = useQuery({ queryKey: ['monthly-plans'], queryFn: fetchMonthlyPlans });
  const genMut = useMutation({
    mutationFn: () => generateMonthlyDemands(),
    onSuccess: (res: { created?: number; skipped?: number; billingPeriod?: string }) => {
      setMessage(
        `Monthly generation complete — ${res.created ?? 0} demand(s) created, ${res.skipped ?? 0} skipped (${res.billingPeriod ?? 'current period'}).`,
      );
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Monthly generation failed')),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createMonthlyPlan({
        code: newPlan.code.trim().toUpperCase(),
        name: newPlan.name.trim(),
        majorSlug: newPlan.majorSlug.trim() || undefined,
        lines: [
          { code: 'TUITION', name: 'Tuition Fee', amount: Number(newPlan.tuition) },
          { code: 'COLLEGE', name: 'College Fee', amount: Number(newPlan.collegeFee) },
          { code: 'DEVELOPMENT', name: 'Development Fee', amount: Number(newPlan.development) },
        ],
      }),
    onSuccess: (plan) => {
      void qc.invalidateQueries({ queryKey: ['monthly-plans'] });
      setSelectedId(plan.id);
      setShowCreate(false);
      setMessage(`Plan "${plan.name}" created successfully.`);
      setNewPlan({
        code: '',
        name: '',
        majorSlug: '',
        tuition: '500',
        collegeFee: '200',
        development: '100',
      });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Create failed')),
  });

  const plans = plansQ.data ?? [];
  const selected = plans.find((p) => p.id === selectedId) ?? plans[0] ?? null;

  const computedTotal = useMemo(() => {
    if (!selected?.lines) return 0;
    return selected.lines.reduce((sum, line) => {
      const key = line.id ?? line.code;
      const val = lineAmounts[key] ?? String(line.amount);
      return sum + Number(val || 0);
    }, 0);
  }, [selected, lineAmounts]);

  const saveMut = useMutation({
    mutationFn: () => {
      if (!selected) throw new Error('No plan selected');
      const lines = (selected.lines ?? []).map((line) => ({
        code: line.code,
        name: line.name,
        amount: Number(lineAmounts[line.id ?? line.code] ?? line.amount),
      }));
      return updateMonthlyPlan(selected.id, { lines });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['monthly-plans'] });
      setMessage(
        selected
          ? `${selected.name} updated — new monthly total ${formatInr(computedTotal)}.`
          : 'Monthly fee plan saved.',
      );
    },
    onError: () => setMessage(''),
  });

  return (
    <div className="space-y-6">
      <MonthlyFeeSetupGuide compact />
      <Card className="glass-card border-0">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Fee Plans
            </CardTitle>
            <CardDescription>
              Update tuition and college fee amounts here each academic year — no code change
              needed. VTC (+₹100/month) and science practical rules apply automatically when demands
              are generated.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={genMut.isPending}
            onClick={() => genMut.mutate()}
          >
            Run monthly generation
          </Button>
          <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" />
            New plan
          </Button>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {showCreate ? (
            <div className="lg:col-span-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
              <h3 className="font-semibold">Create monthly fee plan</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Define a new programme/shift fee plan with default monthly components.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Plan code</span>
                  <Input
                    value={newPlan.code}
                    onChange={(e) => setNewPlan((p) => ({ ...p, code: e.target.value }))}
                    placeholder="BA-ENGLISH-DAY"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Plan name</span>
                  <Input
                    value={newPlan.name}
                    onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))}
                    placeholder="BA English — Day Shift"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Major slug (optional)</span>
                  <Input
                    value={newPlan.majorSlug}
                    onChange={(e) => setNewPlan((p) => ({ ...p, majorSlug: e.target.value }))}
                    placeholder="english"
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Tuition (₹)</span>
                  <Input
                    type="number"
                    value={newPlan.tuition}
                    onChange={(e) => setNewPlan((p) => ({ ...p, tuition: e.target.value }))}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">College fee (₹)</span>
                  <Input
                    type="number"
                    value={newPlan.collegeFee}
                    onChange={(e) => setNewPlan((p) => ({ ...p, collegeFee: e.target.value }))}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Development (₹)</span>
                  <Input
                    type="number"
                    value={newPlan.development}
                    onChange={(e) => setNewPlan((p) => ({ ...p, development: e.target.value }))}
                  />
                </label>
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  disabled={!newPlan.code || !newPlan.name || createMut.isPending}
                  onClick={() => createMut.mutate()}
                >
                  {createMut.isPending ? 'Creating…' : 'Create plan'}
                </Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
          <div className="space-y-2">
            {plans.map((plan) => {
              const total = (plan.lines ?? []).reduce((s, l) => s + Number(l.amount), 0);
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(plan.id);
                    setLineAmounts({});
                    setMessage('');
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-left ${
                    selected?.id === plan.id ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.code} · {plan.majorSlug ?? 'any major'}
                  </p>
                  <p className="mt-1 text-sm font-medium">{formatInr(total)}/month</p>
                </button>
              );
            })}
          </div>

          {selected ? (
            <div>
              <h3 className="text-lg font-semibold">{selected.name}</h3>
              <p className="text-sm text-muted-foreground">
                Edit line amounts below, then click Save. New demands generated after this date will
                use the updated rates. Already-issued monthly demands are not changed automatically.
              </p>
              <div className="mt-4 overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Component</th>
                      <th className="px-3 py-2 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selected.lines ?? []).map((line) => {
                      const key = line.id ?? line.code;
                      return (
                        <tr key={key} className="border-t">
                          <td className="px-3 py-2">{line.name}</td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              className="ml-auto h-8 w-28 text-right"
                              type="number"
                              defaultValue={String(line.amount)}
                              onChange={(e) =>
                                setLineAmounts((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t font-semibold">
                      <td className="px-3 py-2">Total per month</td>
                      <td className="px-3 py-2 text-right">{formatInr(computedTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <Button
                className="mt-4"
                disabled={saveMut.isPending}
                onClick={() => saveMut.mutate()}
              >
                <Save className="mr-2 h-4 w-4" />
                {saveMut.isPending ? 'Saving…' : 'Save plan'}
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
      </Card>
    </div>
  );
}
