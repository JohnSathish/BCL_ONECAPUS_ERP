'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  approveAttendanceCorrectionHr,
  approveAttendanceCorrectionHod,
  fetchAttendanceCorrections,
  rejectAttendanceCorrection,
  requestAttendanceCorrection,
  type AttendanceCorrection,
} from '@/services/staff-attendance';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const CORRECTION_TYPES = [
  ['MISSED_IN', 'Missed IN punch'],
  ['MISSED_OUT', 'Missed OUT punch'],
  ['WRONG_TIME', 'Wrong punch time'],
  ['WRONG_DEVICE', 'Wrong device'],
  ['MANUAL_ENTRY', 'Manual entry'],
];

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function statusTone(status: string) {
  if (status === 'APPROVED') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  if (status === 'REJECTED') return 'bg-destructive/10 text-destructive';
  if (status === 'HOD_APPROVED') return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
  return 'bg-amber-500/10 text-amber-800 dark:text-amber-200';
}

function workflowSteps(status: string) {
  const steps = [
    { key: 'REQUEST', label: 'Employee Request', done: true },
    { key: 'HOD', label: 'HOD Approve', done: ['HOD_APPROVED', 'APPROVED'].includes(status) },
    { key: 'HR', label: 'HR Verify', done: status === 'APPROVED' },
    { key: 'DONE', label: 'Updated', done: status === 'APPROVED' },
  ];
  if (status === 'REJECTED') {
    return steps.map((step) => ({ ...step, done: step.key === 'REQUEST' }));
  }
  return steps;
}

export function AttendanceCorrectionsWorkflow() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [staffProfileId, setStaffProfileId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [correctionType, setCorrectionType] = useState('MISSED_OUT');
  const [requestedInAt, setRequestedInAt] = useState('');
  const [requestedOutAt, setRequestedOutAt] = useState('');
  const [reason, setReason] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const corrections = useQuery({
    queryKey: ['staff-attendance', 'corrections'],
    queryFn: fetchAttendanceCorrections,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['staff-attendance', 'corrections'] });
    void qc.invalidateQueries({ queryKey: ['staff-attendance'] });
  };

  const requestMut = useMutation({
    mutationFn: () =>
      requestAttendanceCorrection({
        staffProfileId,
        attendanceDate,
        correctionType,
        requestedInAt: requestedInAt || undefined,
        requestedOutAt: requestedOutAt || undefined,
        reason,
      }),
    onSuccess: () => {
      setShowForm(false);
      setReason('');
      setRequestedInAt('');
      setRequestedOutAt('');
      invalidate();
    },
  });

  const hodMut = useMutation({
    mutationFn: (id: string) => approveAttendanceCorrectionHod(id),
    onSuccess: invalidate,
  });

  const hrMut = useMutation({
    mutationFn: (id: string) => approveAttendanceCorrectionHr(id),
    onSuccess: invalidate,
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason: note }: { id: string; reason: string }) =>
      rejectAttendanceCorrection(id, note),
    onSuccess: () => {
      setRejectId(null);
      setRejectReason('');
      invalidate();
    },
  });

  const pending = useMemo(
    () => (corrections.data ?? []).filter((row) => !['APPROVED', 'REJECTED'].includes(row.status)),
    [corrections.data],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Attendance Correction Workflow</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Employee request → HOD approve → HR verify → attendance updated with full audit trail.
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => setShowForm((value) => !value)}>
            {showForm ? 'Close Form' : 'New Correction Request'}
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          {workflowSteps('PENDING').map((step, index, items) => (
            <div key={step.key} className="flex items-center gap-2">
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 font-semibold',
                  step.done ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                )}
              >
                {step.label}
              </span>
              {index < items.length - 1 ? (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              ) : null}
            </div>
          ))}
        </div>

        {showForm ? (
          <form
            className="mt-5 grid gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              requestMut.mutate();
            }}
          >
            <label className="block text-xs font-medium">
              Staff Profile ID
              <input
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={staffProfileId}
                onChange={(event) => setStaffProfileId(event.target.value)}
                placeholder="UUID from staff profile"
                required
              />
            </label>
            <label className="block text-xs font-medium">
              Attendance Date
              <input
                type="date"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={attendanceDate}
                onChange={(event) => setAttendanceDate(event.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-medium">
              Correction Type
              <select
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={correctionType}
                onChange={(event) => setCorrectionType(event.target.value)}
              >
                {CORRECTION_TYPES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-medium">
              Reason
              <input
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Forgot punch / device error"
                required
              />
            </label>
            <label className="block text-xs font-medium">
              Requested IN
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={requestedInAt}
                onChange={(event) => setRequestedInAt(event.target.value)}
              />
            </label>
            <label className="block text-xs font-medium">
              Requested OUT
              <input
                type="datetime-local"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                value={requestedOutAt}
                onChange={(event) => setRequestedOutAt(event.target.value)}
              />
            </label>
            <div className="md:col-span-2">
              <Button type="submit" size="sm" disabled={requestMut.isPending}>
                {requestMut.isPending ? 'Submitting...' : 'Submit Correction Request'}
              </Button>
              {requestMut.isError ? (
                <p className="mt-2 text-xs text-destructive">
                  {apiErrorMessage(requestMut.error, 'Could not submit correction')}
                </p>
              ) : null}
            </div>
          </form>
        ) : null}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Pending Queue"
          value={pending.length}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <MetricCard
          label="Approved"
          value={(corrections.data ?? []).filter((row) => row.status === 'APPROVED').length}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Rejected"
          value={(corrections.data ?? []).filter((row) => row.status === 'REJECTED').length}
          icon={<XCircle className="h-4 w-4" />}
        />
      </section>

      {corrections.isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {(corrections.data ?? []).map((correction) => (
            <CorrectionCard
              key={correction.id}
              correction={correction}
              onHodApprove={() => hodMut.mutate(correction.id)}
              onHrApprove={() => hrMut.mutate(correction.id)}
              onReject={() => setRejectId(correction.id)}
              hodPending={hodMut.isPending}
              hrPending={hrMut.isPending}
            />
          ))}
          {!corrections.data?.length ? (
            <p className="rounded-3xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              No correction requests yet.
            </p>
          ) : null}
        </div>
      )}

      {rejectId ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-sm font-semibold">Reject Correction</h3>
            <textarea
              className="mt-3 min-h-[96px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Reason for rejection"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setRejectId(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                disabled={!rejectReason.trim() || rejectMut.isPending}
                onClick={() => rejectMut.mutate({ id: rejectId, reason: rejectReason.trim() })}
              >
                Reject
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function CorrectionCard({
  correction,
  onHodApprove,
  onHrApprove,
  onReject,
  hodPending,
  hrPending,
}: {
  correction: AttendanceCorrection;
  onHodApprove: () => void;
  onHrApprove: () => void;
  onReject: () => void;
  hodPending: boolean;
  hrPending: boolean;
}) {
  const audit = correction.auditPayload as
    | {
        workflow?: Array<{ stage: string; at?: string; note?: string }>;
        originalRecord?: {
          firstInAt?: string | null;
          lastOutAt?: string | null;
          status?: string;
        };
      }
    | undefined;

  return (
    <article className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <UserRound className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">
              {correction.staff?.fullName ?? 'Staff member'}{' '}
              <span className="text-muted-foreground">
                ({correction.staff?.employeeCode ?? correction.staffProfileId.slice(0, 8)})
              </span>
            </h3>
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase',
                statusTone(correction.status),
              )}
            >
              {correction.status.replaceAll('_', ' ')}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {correction.correctionType.replaceAll('_', ' ')} ·{' '}
            {formatDate(correction.attendanceDate)} · {correction.reason ?? 'No reason provided'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {correction.status === 'PENDING' ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={hodPending}
              onClick={onHodApprove}
            >
              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
              HOD Approve
            </Button>
          ) : null}
          {['PENDING', 'HOD_APPROVED'].includes(correction.status) ? (
            <Button type="button" size="sm" disabled={hrPending} onClick={onHrApprove}>
              HR Verify & Apply
            </Button>
          ) : null}
          {!['APPROVED', 'REJECTED'].includes(correction.status) ? (
            <Button type="button" size="sm" variant="destructive" onClick={onReject}>
              Reject
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <AuditBlock
          title="Original"
          inAt={audit?.originalRecord?.firstInAt}
          outAt={audit?.originalRecord?.lastOutAt}
          status={audit?.originalRecord?.status}
        />
        <AuditBlock
          title="Requested"
          inAt={correction.requestedInAt}
          outAt={correction.requestedOutAt}
          highlight
        />
        <AuditBlock
          title="Final"
          inAt={correction.status === 'APPROVED' ? correction.requestedInAt : undefined}
          outAt={correction.status === 'APPROVED' ? correction.requestedOutAt : undefined}
          status={correction.status === 'APPROVED' ? 'UPDATED' : correction.status}
        />
      </div>

      {audit?.workflow?.length ? (
        <div className="mt-4 rounded-2xl bg-muted/35 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Audit Trail
          </p>
          <div className="mt-2 space-y-2">
            {audit.workflow.map((step, index) => (
              <div
                key={`${step.stage}-${index}`}
                className="flex flex-wrap gap-2 text-xs text-muted-foreground"
              >
                <span className="font-semibold text-foreground">{step.stage}</span>
                <span>{step.at ? formatDateTime(step.at) : '—'}</span>
                {step.note ? <span>· {step.note}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function AuditBlock({
  title,
  inAt,
  outAt,
  status,
  highlight = false,
}: {
  title: string;
  inAt?: string | null;
  outAt?: string | null;
  status?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-3 text-xs',
        highlight ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-background/70',
      )}
    >
      <p className="font-semibold">{title}</p>
      <p className="mt-2 text-muted-foreground">IN: {formatDateTime(inAt)}</p>
      <p className="text-muted-foreground">OUT: {formatDateTime(outAt)}</p>
      {status ? <p className="mt-1 font-medium text-foreground">Status: {status}</p> : null}
    </div>
  );
}
