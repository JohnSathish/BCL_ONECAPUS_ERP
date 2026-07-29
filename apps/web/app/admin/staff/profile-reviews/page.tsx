'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  approveStaffProfileReview,
  fetchStaffProfileReviewPending,
  rejectStaffProfileReview,
} from '@/services/staff';
import { apiErrorMessage } from '@/utils/api-error';

export default function StaffProfileReviewsPage() {
  const qc = useQueryClient();
  const pending = useQuery({
    queryKey: ['staff', 'profile-reviews', 'pending'],
    queryFn: fetchStaffProfileReviewPending,
  });
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const approve = useMutation({
    mutationFn: ({ kind, id }: { kind: string; id: string }) =>
      approveStaffProfileReview(kind, id, remarks[`${kind}:${id}`]),
    onSuccess: () => {
      setMessage('Approved');
      void qc.invalidateQueries({ queryKey: ['staff', 'profile-reviews'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Approve failed')),
  });

  const reject = useMutation({
    mutationFn: ({ kind, id }: { kind: string; id: string }) =>
      rejectStaffProfileReview(kind, id, remarks[`${kind}:${id}`] || 'Rejected'),
    onSuccess: () => {
      setMessage('Rejected');
      void qc.invalidateQueries({ queryKey: ['staff', 'profile-reviews'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Reject failed')),
  });

  return (
    <DashboardShell
      title="Staff Profile Reviews"
      subtitle="Approve or reject self-service profile updates"
    >
      <ErpWorkspace className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            ['Qualifications', pending.data?.counts.qualifications],
            ['Experience', pending.data?.counts.experiences],
            ['Certifications', pending.data?.counts.certifications],
            ['Documents', pending.data?.counts.documents],
          ].map(([label, value]) => (
            <GlassCard key={String(label)} className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{value ?? 0}</p>
            </GlassCard>
          ))}
        </div>

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        <GlassCard className="space-y-3 p-5">
          {(pending.data?.items ?? []).map((item) => {
            const key = `${item.kind}:${item.id}`;
            return (
              <div key={key} className="space-y-3 rounded-xl border border-border/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{item.kind}</Badge>
                      <p className="font-medium">{item.title}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.staff.fullName} ({item.staff.employeeCode})
                      {item.staff.department?.name ? ` · ${item.staff.department.name}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.subtitle}
                      {item.submittedAt ? ` · ${new Date(item.submittedAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                </div>
                <Input
                  placeholder="Remarks (required for reject)"
                  value={remarks[key] ?? ''}
                  onChange={(e) => setRemarks((prev) => ({ ...prev, [key]: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="rounded-xl"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate({ kind: item.kind, id: item.id })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="rounded-xl"
                    disabled={reject.isPending}
                    onClick={() => reject.mutate({ kind: item.kind, id: item.id })}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
          {!pending.data?.items?.length && !pending.isLoading ? (
            <p className="text-sm text-muted-foreground">No pending profile updates.</p>
          ) : null}
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
