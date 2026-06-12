'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import { approveLeaveApplication, fetchLeaveApplications } from '@/services/hr';

export function StaffPortalApprovalsPage() {
  useRequireStaffPortal();
  const qc = useQueryClient();

  const appsQ = useQuery({
    queryKey: ['hr', 'leave', 'pending-approvals'],
    queryFn: () => fetchLeaveApplications({ pendingApproval: true }),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      approveLeaveApplication(id, action),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hr', 'leave'] }),
  });

  return (
    <DashboardShell role="staff" title="Approvals">
      <ErpWorkspace>
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Pending Leave Approvals</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and approve leave requests from your department.
          </p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2">Staff</th>
                <th>Type</th>
                <th>Dates</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(appsQ.data ?? []).map((a) => (
                <tr key={a.id} className="border-b border-border/60">
                  <td className="py-2">{a.staffProfile?.fullName}</td>
                  <td className="py-2">{a.leaveType?.name}</td>
                  <td className="py-2 text-xs">
                    {a.fromDate.slice(0, 10)} → {a.toDate.slice(0, 10)}
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-600"
                        onClick={() => approveMut.mutate({ id: a.id, action: 'APPROVE' })}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => approveMut.mutate({ id: a.id, action: 'REJECT' })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!appsQ.data?.length ? (
            <p className="mt-4 text-sm text-muted-foreground">No pending approvals.</p>
          ) : null}
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
