'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireStaffPortal } from '@/hooks/use-require-staff-portal';
import {
  fetchPortalLeaveApplications,
  fetchPortalLeaveSummary,
  portalApplyLeave,
} from '@/services/hr';
import { fetchAttendanceSettings } from '@/services/staff-attendance';
import { apiErrorMessage } from '@/utils/api-error';

export function StaffPortalLeavePage() {
  useRequireStaffPortal();
  const qc = useQueryClient();
  const [form, setForm] = useState({ leaveTypeId: '', fromDate: '', toDate: '', reason: '' });
  const [message, setMessage] = useState('');

  const summaryQ = useQuery({
    queryKey: ['staff', 'leave', 'summary'],
    queryFn: fetchPortalLeaveSummary,
  });

  const appsQ = useQuery({
    queryKey: ['staff', 'leave', 'applications'],
    queryFn: fetchPortalLeaveApplications,
  });

  const typesQ = useQuery({
    queryKey: ['staff', 'attendance', 'settings', 'leave-types'],
    queryFn: async () => {
      const settings = await fetchAttendanceSettings();
      return (settings?.leaveTypes ?? []) as Array<{ id: string; name: string; code: string }>;
    },
  });

  const applyMut = useMutation({
    mutationFn: () =>
      portalApplyLeave({
        leaveTypeId: form.leaveTypeId,
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: form.reason,
      }),
    onSuccess: () => {
      setMessage('Leave request submitted for approval.');
      setForm({ leaveTypeId: '', fromDate: '', toDate: '', reason: '' });
      void qc.invalidateQueries({ queryKey: ['staff', 'leave'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not submit leave request')),
  });

  const leave = summaryQ.data;

  return (
    <DashboardShell role="staff" title="Leave Management">
      <ErpWorkspace className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Leave Balances</h2>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-2xl font-bold">{leave?.casual ?? 0}</p>
              <p className="text-xs text-muted-foreground">CL</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-2xl font-bold">{leave?.sick ?? 0}</p>
              <p className="text-xs text-muted-foreground">SL</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-4">
              <p className="text-2xl font-bold">{leave?.earned ?? 0}</p>
              <p className="text-xs text-muted-foreground">EL</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Pending requests: {leave?.pendingRequests ?? 0}
          </p>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Apply Leave</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              applyMut.mutate();
            }}
          >
            <div>
              <Label htmlFor="leave-type">Leave type</Label>
              <select
                id="leave-type"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={form.leaveTypeId}
                onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}
                required
              >
                <option value="">Select leave type</option>
                {(typesQ.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="from">From</Label>
                <Input
                  id="from"
                  type="date"
                  className="mt-1"
                  required
                  value={form.fromDate}
                  onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="to">To</Label>
                <Input
                  id="to"
                  type="date"
                  className="mt-1"
                  required
                  value={form.toDate}
                  onChange={(e) => setForm({ ...form, toDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                className="mt-1"
                required
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={!form.leaveTypeId || applyMut.isPending}
            >
              Submit Request
            </Button>
            {message ? <p className="text-xs text-emerald-600">{message}</p> : null}
          </form>
        </GlassCard>

        <GlassCard className="p-6 lg:col-span-2">
          <h3 className="font-semibold">Recent Requests</h3>
          <ul className="mt-3 divide-y text-sm">
            {(appsQ.data ?? []).map((a) => (
              <li key={a.id} className="flex justify-between py-2">
                <span>
                  {a.leaveType?.name} · {a.fromDate.slice(0, 10)} → {a.toDate.slice(0, 10)}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{a.status}</span>
              </li>
            ))}
            {!appsQ.data?.length ? (
              <li className="py-4 text-muted-foreground">No leave requests yet.</li>
            ) : null}
          </ul>
        </GlassCard>
      </ErpWorkspace>
    </DashboardShell>
  );
}
