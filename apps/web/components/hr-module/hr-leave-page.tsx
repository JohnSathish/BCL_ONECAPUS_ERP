'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  approveLeaveApplication,
  fetchLeaveApplications,
  fetchLeaveBalances,
  initializeLeaveBalances,
} from '@/services/hr';
import { apiErrorMessage } from '@/utils/api-error';

export function HrLeavePage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [message, setMessage] = useState('');

  const appsQ = useQuery({
    queryKey: ['hr', 'leave', 'applications'],
    queryFn: () => fetchLeaveApplications({ pendingApproval: true }),
    enabled,
  });

  const balancesQ = useQuery({
    queryKey: ['hr', 'leave', 'balances'],
    queryFn: () => fetchLeaveBalances(),
    enabled,
  });

  const initMut = useMutation({
    mutationFn: () => initializeLeaveBalances({ overwrite: false }),
    onSuccess: (r) => {
      setMessage(`Initialized ${r.initialized} balance records for ${r.staffCount} staff.`);
      void qc.invalidateQueries({ queryKey: ['hr', 'leave'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not initialize balances')),
  });

  const approveMut = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'APPROVE' | 'REJECT' }) =>
      approveLeaveApplication(id, action),
    onSuccess: () => {
      setMessage('Leave application updated.');
      void qc.invalidateQueries({ queryKey: ['hr', 'leave'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Action failed')),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Leave Management</h2>
          <p className="text-sm text-muted-foreground">
            Approval queue, balances, and leave liability.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={initMut.isPending}
            onClick={() => initMut.mutate()}
          >
            Initialize Balances
          </Button>
          <Link href="/admin/staff/attendance/settings">
            <Button size="sm" variant="outline">
              Leave Types
            </Button>
          </Link>
        </div>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <GlassCard className="p-4">
        <h3 className="mb-3 font-semibold">Pending Approvals</h3>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2 pr-2">Staff</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Dates</th>
                <th className="py-2 pr-2">Days</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {appsQ.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : appsQ.data?.length ? (
                appsQ.data.map((a) => (
                  <tr key={a.id} className="border-b border-border/60">
                    <td className="py-2 pr-2">{a.staffProfile?.fullName}</td>
                    <td className="py-2 pr-2">{a.leaveType?.name}</td>
                    <td className="py-2 pr-2 text-xs">
                      {a.fromDate.slice(0, 10)} → {a.toDate.slice(0, 10)}
                    </td>
                    <td className="py-2 pr-2">{Number(a.totalDays)}</td>
                    <td className="py-2 pr-2">
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px]">
                        {a.status}
                      </span>
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
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No pending leave applications.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <h3 className="mb-3 font-semibold">Leave Balances ({new Date().getFullYear()})</h3>
        <div className="max-h-80 overflow-auto text-sm">
          {(balancesQ.data ?? []).slice(0, 100).map((b) => {
            const remaining =
              Number(b.allocatedDays) + Number(b.carriedForward) - Number(b.usedDays);
            return (
              <div key={b.id} className="flex justify-between border-b border-border/40 py-1.5">
                <span>
                  {b.staffProfile?.fullName ?? '—'} · {b.leaveType.name}
                </span>
                <span className="tabular-nums">
                  {remaining} / {Number(b.allocatedDays)} days
                </span>
              </div>
            );
          })}
          {!balancesQ.data?.length ? (
            <p className="text-muted-foreground">
              No balances yet — run Initialize Balances after configuring leave types.
            </p>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}
