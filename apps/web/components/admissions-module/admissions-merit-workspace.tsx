'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import { canManageAdmissions } from '@/lib/can-manage-academic';
import {
  fetchAllocations,
  fetchIntakes,
  fetchMeritList,
  fetchMeritLists,
  generateMeritList,
  publishMeritList,
  runSeatAllocation,
  updateAllocationStatus,
} from '@/services/admissions';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const selectClass = 'h-10 w-full rounded-md border border-border bg-card px-3 text-sm';

export function AdmissionsMeritWorkspace() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const [selectedIntakeId, setSelectedIntakeId] = useState('');
  const [selectedMeritListId, setSelectedMeritListId] = useState('');

  const canManage = useMemo(() => canManageAdmissions(session), [session]);

  const intakes = useQuery({
    queryKey: ['admissions', 'intakes'],
    queryFn: fetchIntakes,
    enabled: Boolean(session),
  });

  const meritLists = useQuery({
    queryKey: ['admissions', 'merit-lists', selectedIntakeId],
    queryFn: () => fetchMeritLists(selectedIntakeId || undefined),
    enabled: Boolean(session),
  });

  const meritDetail = useQuery({
    queryKey: ['admissions', 'merit-list', selectedMeritListId],
    queryFn: () => fetchMeritList(selectedMeritListId),
    enabled: Boolean(session) && Boolean(selectedMeritListId),
  });

  const allocations = useQuery({
    queryKey: ['admissions', 'allocations', selectedIntakeId],
    queryFn: () => fetchAllocations(selectedIntakeId || undefined),
    enabled: Boolean(session),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admissions'] });

  const generateMeritMut = useMutation({
    mutationFn: (intakeId: string) => generateMeritList({ intakeId, round: 1 }),
    onSuccess: (data) => {
      setSelectedMeritListId(data?.id ?? '');
      invalidate();
    },
  });

  const publishMeritMut = useMutation({
    mutationFn: publishMeritList,
    onSuccess: invalidate,
  });

  const runAllocationMut = useMutation({
    mutationFn: ({ intakeId, meritListId }: { intakeId: string; meritListId: string }) =>
      runSeatAllocation({ intakeId, meritListId }),
    onSuccess: invalidate,
  });

  const confirmAllocMut = useMutation({
    mutationFn: (id: string) => updateAllocationStatus(id, 'confirmed'),
    onSuccess: invalidate,
  });

  const publishedMerit = meritLists.data?.find((m) => m.status === 'published');

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Merit & selection">
      <div className="space-y-6 pb-8">
        <div className="rounded-2xl border border-border/80 bg-gradient-to-r from-primary/5 via-card to-accent/5 p-4 md:p-5">
          <p className="text-sm text-muted-foreground">Online admission</p>
          <h2 className="text-xl font-semibold tracking-tight">Merit list & seat selection</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate merit rankings, publish lists to the applicant portal, and run seat allocation.
          </p>
        </div>

        <div className="max-w-xs">
          <Label>Intake</Label>
          <select
            className={cn(selectClass, 'mt-1')}
            value={selectedIntakeId}
            onChange={(e) => {
              setSelectedIntakeId(e.target.value);
              setSelectedMeritListId('');
            }}
          >
            <option value="">All intakes</option>
            {(intakes.data ?? []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} — {i.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass-card border-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Merit lists</CardTitle>
                <CardDescription>Generate from merit scores, then publish</CardDescription>
              </div>
              {selectedIntakeId && canManage ? (
                <Button
                  size="sm"
                  disabled={generateMeritMut.isPending}
                  onClick={() => generateMeritMut.mutate(selectedIntakeId)}
                >
                  Generate
                </Button>
              ) : null}
            </CardHeader>
            {generateMeritMut.error ? (
              <p className="px-6 pb-2 text-sm text-destructive" role="alert">
                {apiErrorMessage(generateMeritMut.error, 'Could not generate merit list')}
              </p>
            ) : null}
            <CardContent className="space-y-2">
              {(meritLists.data ?? []).map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelectedMeritListId(list.id)}
                  className={cn(
                    'w-full rounded-xl border p-3 text-left transition',
                    selectedMeritListId === list.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{list.name}</p>
                    <StatusBadge status={list.status} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Round {list.round} · {list._count.entries} candidates
                  </p>
                  {list.status === 'draft' && canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      disabled={publishMeritMut.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        publishMeritMut.mutate(list.id);
                      }}
                    >
                      Publish
                    </Button>
                  ) : null}
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle>Merit ranking</CardTitle>
              <CardDescription>
                {meritDetail.data
                  ? `${meritDetail.data.entries.length} ranked applicants`
                  : 'Select a merit list'}
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[480px] space-y-1 overflow-y-auto">
              {(meritDetail.data?.entries ?? []).map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-muted-foreground">#{e.rank}</span>
                  <span className="flex-1 px-3">
                    {e.application.firstName} {e.application.lastName}
                  </span>
                  <span className="font-medium">{String(e.score)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="glass-card border-0">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Seat allocation</CardTitle>
              <CardDescription>Run allocation from a published merit list</CardDescription>
            </div>
            {selectedIntakeId && publishedMerit && canManage ? (
              <Button
                disabled={runAllocationMut.isPending}
                onClick={() =>
                  runAllocationMut.mutate({
                    intakeId: selectedIntakeId,
                    meritListId: publishedMerit.id,
                  })
                }
              >
                Run allocation
              </Button>
            ) : null}
          </CardHeader>
          {runAllocationMut.error ? (
            <p className="px-6 pb-2 text-sm text-destructive" role="alert">
              {apiErrorMessage(runAllocationMut.error, 'Seat allocation failed')}
            </p>
          ) : null}
          <CardContent className="space-y-2">
            {(allocations.data ?? []).map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"
              >
                <div>
                  <p className="font-medium">
                    {a.application.applicationNumber} — {a.application.firstName}{' '}
                    {a.application.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.intake.name} · Round {a.round}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  {a.status === 'provisional' && canManage ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => confirmAllocMut.mutate(a.id)}
                    >
                      Confirm
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-success/10 text-success',
    closed: 'bg-muted text-muted-foreground',
    draft: 'bg-warning/10 text-warning',
    published: 'bg-primary/10 text-primary',
    provisional: 'bg-warning/10 text-warning',
    confirmed: 'bg-success/10 text-success',
  };

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        styles[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
