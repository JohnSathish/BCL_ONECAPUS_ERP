'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import {
  addPayslipAdjustment,
  excludeStaffFromRun,
  fetchPayAssignments,
  fetchRunAdjustments,
  fetchRunExclusions,
  includeStaffInRun,
  removePayslipAdjustment,
} from '@/services/payroll';
import { apiErrorMessage } from '@/utils/api-error';

type RunInfo = {
  id: string;
  status: string;
  locked: boolean;
  payScaleType?: string | null;
  payslips?: Array<{
    staffProfileId: string;
    staffProfile?: { fullName: string; employeeCode: string };
  }>;
};

export function PayrollRunAdjustmentsPanel({
  run,
  onMessage,
  onError,
}: {
  run: RunInfo;
  onMessage: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const qc = useQueryClient();
  const editable = !run.locked && run.status !== 'PUBLISHED';

  const exclusionsQ = useQuery({
    queryKey: ['payroll', 'run-exclusions', run.id],
    queryFn: () => fetchRunExclusions(run.id),
  });
  const adjustmentsQ = useQuery({
    queryKey: ['payroll', 'run-adjustments', run.id],
    queryFn: () => fetchRunAdjustments(run.id),
  });
  const assignmentsQ = useQuery({
    queryKey: ['payroll', 'assignments', run.payScaleType],
    queryFn: () =>
      fetchPayAssignments({ status: 'ACTIVE', payScaleType: run.payScaleType ?? undefined }),
    enabled: editable && !!run.payScaleType,
  });

  const [excludeStaffId, setExcludeStaffId] = useState('');
  const [excludeReason, setExcludeReason] = useState('');
  const [adjForm, setAdjForm] = useState({
    staffProfileId: '',
    label: 'One-time bonus',
    adjustmentType: 'EARNING' as 'EARNING' | 'DEDUCTION',
    amount: 0,
    notes: '',
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['payroll'] });
  };

  const excludeMut = useMutation({
    mutationFn: () => excludeStaffFromRun(run.id, excludeStaffId, excludeReason || undefined),
    onSuccess: () => {
      onMessage('Staff excluded from run');
      setExcludeStaffId('');
      setExcludeReason('');
      invalidate();
    },
    onError: (e) => onError(apiErrorMessage(e, 'Failed to exclude staff')),
  });

  const includeMut = useMutation({
    mutationFn: (staffProfileId: string) => includeStaffInRun(run.id, staffProfileId),
    onSuccess: () => {
      onMessage('Staff included in run');
      invalidate();
    },
    onError: (e) => onError(apiErrorMessage(e, 'Failed to include staff')),
  });

  const addAdjMut = useMutation({
    mutationFn: () => addPayslipAdjustment(run.id, adjForm),
    onSuccess: () => {
      onMessage('Adjustment saved — recalculate run to apply');
      setAdjForm({ ...adjForm, amount: 0, notes: '' });
      invalidate();
    },
    onError: (e) => onError(apiErrorMessage(e, 'Failed to add adjustment')),
  });

  const removeAdjMut = useMutation({
    mutationFn: removePayslipAdjustment,
    onSuccess: () => {
      onMessage('Adjustment removed');
      invalidate();
    },
    onError: (e) => onError(apiErrorMessage(e, 'Failed to remove adjustment')),
  });

  const payslipStaff =
    run.payslips?.map((p) => ({
      id: p.staffProfileId,
      name: p.staffProfile?.fullName ?? p.staffProfileId,
      code: p.staffProfile?.employeeCode ?? '',
    })) ?? [];

  const assignmentStaff = (assignmentsQ.data ?? []).map((a) => ({
    id: a.staffProfileId,
    name: a.staffProfile?.fullName ?? '',
    code: a.staffProfile?.employeeCode ?? '',
  }));

  const staffOptions = payslipStaff.length ? payslipStaff : assignmentStaff;

  const exclusions = (exclusionsQ.data ?? []) as Array<{
    id: string;
    staffProfileId: string;
    reason?: string | null;
    staffProfile?: { fullName: string; employeeCode: string } | null;
  }>;

  const adjustments = (adjustmentsQ.data ?? []) as Array<{
    id: string;
    label: string;
    adjustmentType: string;
    amount: number;
    staffProfile?: { fullName: string; employeeCode: string } | null;
  }>;

  if (!editable) {
    return (
      <GlassCard className="p-4 text-sm text-muted-foreground">
        Exclusions and manual adjustments can only be edited while the run is in DRAFT / VERIFIED /
        APPROVED state.
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GlassCard className="p-4 space-y-3">
        <h3 className="font-semibold">Exclude Staff from Run</h3>
        <p className="text-xs text-muted-foreground">
          Excluded staff are skipped during calculation. Use for staff on leave without pay or new
          joiners mid-month.
        </p>
        <select
          className="w-full rounded border px-2 py-1 text-sm"
          value={excludeStaffId}
          onChange={(e) => setExcludeStaffId(e.target.value)}
        >
          <option value="">Select staff to exclude</option>
          {assignmentStaff
            .filter((s) => !exclusions.some((e) => e.staffProfileId === s.id))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
        </select>
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="Reason (optional)"
          value={excludeReason}
          onChange={(e) => setExcludeReason(e.target.value)}
        />
        <Button
          size="sm"
          disabled={!excludeStaffId || excludeMut.isPending}
          onClick={() => excludeMut.mutate()}
        >
          Exclude from Run
        </Button>
        {exclusions.length > 0 && (
          <ul className="space-y-1 border-t pt-2 text-sm">
            {exclusions.map((ex) => (
              <li
                key={ex.id}
                className="flex items-center justify-between rounded border px-2 py-1"
              >
                <span>
                  {ex.staffProfile?.fullName ?? ex.staffProfileId}
                  {ex.reason && (
                    <span className="ml-1 text-xs text-muted-foreground">— {ex.reason}</span>
                  )}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => includeMut.mutate(ex.staffProfileId)}
                >
                  Include
                </Button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <GlassCard className="p-4 space-y-3">
        <h3 className="font-semibold">Manual Payslip Adjustments</h3>
        <p className="text-xs text-muted-foreground">
          Add one-off earnings or deductions before final calculation. Recalculate the run after
          saving.
        </p>
        <select
          className="w-full rounded border px-2 py-1 text-sm"
          value={adjForm.staffProfileId}
          onChange={(e) => setAdjForm({ ...adjForm, staffProfileId: e.target.value })}
        >
          <option value="">Select staff</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="Label"
          value={adjForm.label}
          onChange={(e) => setAdjForm({ ...adjForm, label: e.target.value })}
        />
        <div className="flex gap-2">
          <select
            className="w-full rounded border px-2 py-1 text-sm"
            value={adjForm.adjustmentType}
            onChange={(e) =>
              setAdjForm({ ...adjForm, adjustmentType: e.target.value as 'EARNING' | 'DEDUCTION' })
            }
          >
            <option value="EARNING">Earning (+)</option>
            <option value="DEDUCTION">Deduction (−)</option>
          </select>
          <input
            type="number"
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Amount ₹"
            value={adjForm.amount || ''}
            onChange={(e) => setAdjForm({ ...adjForm, amount: Number(e.target.value) })}
          />
        </div>
        <Button
          size="sm"
          disabled={!adjForm.staffProfileId || !adjForm.amount || addAdjMut.isPending}
          onClick={() => addAdjMut.mutate()}
        >
          Add Adjustment
        </Button>
        {adjustments.length > 0 && (
          <ul className="space-y-1 border-t pt-2 text-sm">
            {adjustments.map((adj) => (
              <li
                key={adj.id}
                className="flex items-center justify-between rounded border px-2 py-1"
              >
                <span>
                  {adj.staffProfile?.fullName} — {adj.label}{' '}
                  <span
                    className={
                      adj.adjustmentType === 'EARNING' ? 'text-emerald-700' : 'text-red-700'
                    }
                  >
                    {adj.adjustmentType === 'EARNING' ? '+' : '−'}₹
                    {Number(adj.amount).toLocaleString('en-IN')}
                  </span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => removeAdjMut.mutate(adj.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}
