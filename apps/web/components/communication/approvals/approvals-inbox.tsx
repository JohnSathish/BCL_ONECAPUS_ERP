'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { approveMessage, fetchApprovals, rejectMessage } from '@/services/communication';

export function ApprovalsInbox() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const approvals = useQuery({
    queryKey: ['communication', 'approvals'],
    queryFn: () => fetchApprovals(),
    enabled,
  });

  const approve = useMutation({
    mutationFn: (id: string) => approveMessage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication'] }),
  });

  const reject = useMutation({
    mutationFn: (id: string) => rejectMessage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['communication'] }),
  });

  return (
    <div className="space-y-3">
      {(approvals.data ?? []).map((a) => (
        <div
          key={a.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-4"
        >
          <div>
            <p className="font-medium">Campaign approval</p>
            <p className="text-sm text-muted-foreground">
              {a.status} · {a.currentApproverRole ?? '—'}
            </p>
          </div>
          {!['APPROVED', 'REJECTED'].includes(a.status) ? (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => approve.mutate(a.id)}>
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={() => reject.mutate(a.id)}>
                Reject
              </Button>
            </div>
          ) : null}
        </div>
      ))}
      {!approvals.data?.length ? (
        <p className="text-sm text-muted-foreground">No pending approvals.</p>
      ) : null}
    </div>
  );
}
