'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { actOnIaApproval, fetchPendingIaApprovals } from '@/services/examinations-ia';
import { useRequireAuth } from '@/hooks/use-auth';

export default function StaffIaApprovalsPage() {
  const session = useRequireAuth();
  const qc = useQueryClient();
  const pending = useQuery({ queryKey: ['ia', 'approvals'], queryFn: fetchPendingIaApprovals });

  const approve = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      actOnIaApproval(id, { action }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ia', 'approvals'] }),
  });

  if (!session) return null;

  return (
    <DashboardShell role="staff" title="IA Approvals">
      <section className="rounded-2xl border border-border/60 bg-card p-4">
        <h1 className="text-lg font-bold">Pending Approvals</h1>
        <ul className="mt-4 divide-y text-sm">
          {(pending.data ?? []).map((a: { id: string; step: string; sheet?: { name: string } }) => (
            <li key={a.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{a.sheet?.name ?? 'Sheet'}</p>
                <p className="text-xs text-muted-foreground">{a.step}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => approve.mutate({ id: a.id, action: 'APPROVE' })}>
                  <CheckCircle2 className="h-3 w-3" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => approve.mutate({ id: a.id, action: 'REJECT' })}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {!pending.data?.length && (
          <p className="mt-4 text-sm text-muted-foreground">No pending approvals.</p>
        )}
      </section>
    </DashboardShell>
  );
}
