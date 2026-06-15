'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRequireAuth } from '@/hooks/use-auth';
import { closeCycle, fetchCycle, publishCycle, upsertIntakeShift } from '@/services/admissions';
import { fetchShifts } from '@/services/academic-engine';
import { apiErrorMessage } from '@/utils/api-error';
import { useState } from 'react';
import { AdmissionsCycleSettingsPanel } from '@/components/admissions-module/admissions-cycle-settings-panel';

export default function AdmissionCycleDetailPage() {
  useRequireAuth();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: cycle, isLoading } = useQuery({
    queryKey: ['admission-cycle', id],
    queryFn: () => fetchCycle(id),
    enabled: Boolean(id),
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['shifts'],
    queryFn: fetchShifts,
  });

  const publishMutation = useMutation({
    mutationFn: () => publishCycle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admission-cycle', id] }),
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeCycle(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admission-cycle', id] }),
    onError: (e) => setError(apiErrorMessage(e, 'Request failed')),
  });

  if (isLoading || !cycle) {
    return (
      <DashboardShell role="admin" title="Cycle Configuration">
        <p className="text-muted-foreground">Loading…</p>
      </DashboardShell>
    );
  }

  const readOnly = cycle.status === 'ARCHIVED';
  const intake = cycle.intakes?.[0];

  return (
    <DashboardShell role="admin" title={cycle.title}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" asChild>
          <Link href="/admin/admissions/cycles">← All Cycles</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/admissions">← Control center</Link>
        </Button>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
          {cycle.status}
        </span>
        {!readOnly && cycle.status === 'DRAFT' && (
          <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
            Publish Cycle
          </Button>
        )}
        {!readOnly && cycle.status === 'OPEN' && (
          <Button variant="secondary" onClick={() => closeMutation.mutate()}>
            Close Cycle
          </Button>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <AdmissionsCycleSettingsPanel
        cycle={cycle}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ['admission-cycle', id] })}
      />

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Seat Matrix {intake ? `— ${intake.program?.name}` : ''}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {intake?.shiftCaps?.map(
            (cap: {
              id: string;
              shiftId: string;
              totalSeats: number;
              reservedSeats: Record<string, number>;
              shift: { name: string };
            }) => (
              <div key={cap.id} className="rounded-md border p-3">
                <p className="font-medium">{cap.shift?.name}</p>
                <p className="text-sm text-muted-foreground">Total seats: {cap.totalSeats}</p>
                <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(cap.reservedSeats, null, 2)}
                </pre>
              </div>
            ),
          )}
          {!intake ? (
            <p className="text-sm text-muted-foreground">
              No intake linked to this cycle yet. Create one from the Admissions desk.
            </p>
          ) : null}
          {!readOnly && intake && shifts.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const shift = shifts[0];
                upsertIntakeShift(intake.id, {
                  shiftId: shift.id,
                  totalSeats: 60,
                  reservedSeats: { GENERAL: 30, OBC: 12, SC: 9, ST: 5, EWS: 4 },
                }).then(() => queryClient.invalidateQueries({ queryKey: ['admission-cycle', id] }));
              }}
            >
              Reset default shift caps
            </Button>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
