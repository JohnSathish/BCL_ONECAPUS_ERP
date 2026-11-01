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
  formatStaffLeaveStatus,
  portalApplyLeave,
  previewPortalLeave,
  type LeaveApplication,
} from '@/services/hr';
import { apiErrorMessage } from '@/utils/api-error';

function HistoryList({ title, rows }: { title: string; rows: LeaveApplication[] }) {
  return (
    <GlassCard className="p-6">
      <h3 className="font-semibold">{title}</h3>
      <ul className="mt-3 divide-y text-sm">
        {rows.map((application) => (
          <li key={application.id} className="flex justify-between gap-3 py-2">
            <span>
              {application.leaveType?.name} · {application.fromDate.slice(0, 10)} →{' '}
              {application.toDate.slice(0, 10)}
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {Number(application.totalDays)} working day(s)
                {application.status === 'APPROVED' &&
                (application.approvedByRole || application.reviewedByRole)
                  ? ` · Approved by ${application.approvedByRole || application.reviewedByRole}`
                  : ''}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">
              {formatStaffLeaveStatus(application)}
            </span>
          </li>
        ))}
        {!rows.length ? <li className="py-4 text-muted-foreground">None yet.</li> : null}
      </ul>
    </GlassCard>
  );
}

export function StaffPortalLeavePage() {
  useRequireStaffPortal();
  const qc = useQueryClient();
  const [form, setForm] = useState({ leaveTypeId: '', fromDate: '', toDate: '', reason: '' });
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  const summaryQ = useQuery({
    queryKey: ['staff', 'leave', 'summary'],
    queryFn: fetchPortalLeaveSummary,
  });

  const appsQ = useQuery({
    queryKey: ['staff', 'leave', 'applications'],
    queryFn: fetchPortalLeaveApplications,
  });

  const leaveTypes = summaryQ.data?.leaveTypes ?? [];
  const leaveTypeId = form.leaveTypeId || leaveTypes[0]?.id || '';
  const casual = summaryQ.data?.casualLeave;

  const previewQ = useQuery({
    queryKey: ['staff', 'leave', 'preview', leaveTypeId, form.fromDate, form.toDate],
    queryFn: () =>
      previewPortalLeave({
        leaveTypeId,
        fromDate: form.fromDate,
        toDate: form.toDate,
      }),
    enabled: Boolean(leaveTypeId && form.fromDate && form.toDate),
  });

  const applyMut = useMutation({
    mutationFn: () =>
      portalApplyLeave({
        leaveTypeId,
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: form.reason,
      }),
    onSuccess: () => {
      setFailed(false);
      setMessage('Leave request submitted for approval.');
      setForm({ leaveTypeId: '', fromDate: '', toDate: '', reason: '' });
      void qc.invalidateQueries({ queryKey: ['staff', 'leave'] });
    },
    onError: (error) => {
      setFailed(true);
      setMessage(apiErrorMessage(error, 'Could not submit leave request'));
    },
  });

  const applications = appsQ.data ?? [];
  const approved = applications.filter((row) => row.status === 'APPROVED');
  const rejected = applications.filter((row) => row.status === 'REJECTED');
  const pending = applications.filter(
    (row) => row.status !== 'APPROVED' && row.status !== 'REJECTED' && row.status !== 'CANCELLED',
  );
  const previewBlocks = previewQ.data?.ok === false;

  return (
    <DashboardShell role="staff" title="Leave Management">
      <ErpWorkspace className="grid gap-4">
        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Casual Leave</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            15 days in a calendar year, and not more than 3 working days at a time. Sundays and
            holidays are not counted, and they do not start a new spell.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ['Annual allocation', casual?.allocated ?? 15],
              ['Availed', casual?.availed ?? 0],
              ['Pending', casual?.pending ?? 0],
              ['Balance', casual?.balance ?? summaryQ.data?.casual ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-muted/40 p-4 text-center">
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-6">
          <h2 className="text-lg font-semibold">Apply for casual leave</h2>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (previewBlocks) return;
              applyMut.mutate();
            }}
          >
            <div>
              <Label htmlFor="leave-type">Leave type</Label>
              <select
                id="leave-type"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={leaveTypeId}
                onChange={(event) => setForm({ ...form, leaveTypeId: event.target.value })}
                required
              >
                {leaveTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
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
                  onChange={(event) => setForm({ ...form, fromDate: event.target.value })}
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
                  onChange={(event) => setForm({ ...form, toDate: event.target.value })}
                />
              </div>
            </div>
            {previewQ.data ? (
              <p
                className={`text-sm ${previewQ.data.ok ? 'text-muted-foreground' : 'text-destructive'}`}
              >
                {previewQ.data.ok
                  ? `${previewQ.data.totalDays} working day(s) will be requested.`
                  : previewQ.data.message}
              </p>
            ) : null}
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                className="mt-1"
                required
                value={form.reason}
                onChange={(event) => setForm({ ...form, reason: event.target.value })}
              />
            </div>
            <Button type="submit" disabled={!leaveTypeId || previewBlocks || applyMut.isPending}>
              Submit Request
            </Button>
            {message ? (
              <p className={`text-xs ${failed ? 'text-destructive' : 'text-emerald-600'}`}>
                {message}
              </p>
            ) : null}
          </form>
        </GlassCard>

        <HistoryList title="Pending leave" rows={pending} />
        <div className="grid gap-4 lg:grid-cols-2">
          <HistoryList title="Approved leave" rows={approved} />
          <HistoryList title="Rejected leave" rows={rejected} />
        </div>
      </ErpWorkspace>
    </DashboardShell>
  );
}
