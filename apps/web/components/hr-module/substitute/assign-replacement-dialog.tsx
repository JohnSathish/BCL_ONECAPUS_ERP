'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateInput } from '@/components/ui/date-input';
import { fetchStaff } from '@/services/staff';
import { fetchDepartments } from '@/services/organization';
import {
  createReplacementAssignment,
  fetchSubstituteStaff,
  REPLACEMENT_REASON_OPTIONS,
  SALARY_ARRANGEMENT_OPTIONS,
} from '@/services/hr-substitute';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  originalStaffProfileId?: string;
  originalStaffName?: string;
};

export function AssignReplacementDialog({
  open,
  onOpenChange,
  onSuccess,
  originalStaffProfileId,
  originalStaffName,
}: Props) {
  const [originalId, setOriginalId] = useState(originalStaffProfileId ?? '');
  const [substituteMode, setSubstituteMode] = useState<'existing' | 'new'>('existing');
  const [substituteStaffId, setSubstituteStaffId] = useState('');
  const [newSubstituteName, setNewSubstituteName] = useState('');
  const [reason, setReason] = useState('PHD_LEAVE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [salaryArrangement, setSalaryArrangement] = useState('ORIGINAL_EMPLOYEE_PAYS_SUBSTITUTE');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [fullWorkload, setFullWorkload] = useState(true);
  const [subjectLabels, setSubjectLabels] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (originalStaffProfileId) setOriginalId(originalStaffProfileId);
  }, [originalStaffProfileId]);

  const staff = useQuery({
    queryKey: ['staff', 'picker'],
    queryFn: () => fetchStaff({ limit: 200, staffType: 'TEACHING' }),
    enabled: open,
  });
  const substitutes = useQuery({
    queryKey: ['hr', 'substitute', 'picker'],
    queryFn: () => fetchSubstituteStaff({ status: 'ACTIVE', limit: 100 }),
    enabled: open,
  });
  const departments = useQuery({
    queryKey: ['org', 'departments'],
    queryFn: () => fetchDepartments(),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: () =>
      createReplacementAssignment({
        originalStaffProfileId: originalId,
        substituteStaffId: substituteMode === 'existing' ? substituteStaffId : undefined,
        createSubstitute:
          substituteMode === 'new'
            ? { fullName: newSubstituteName, departmentId: departmentId || undefined }
            : undefined,
        reason,
        startDate,
        endDate,
        departmentId: departmentId || undefined,
        salaryArrangement,
        monthlyAgreedAmount: monthlyAmount ? Number(monthlyAmount) : undefined,
        fullWorkloadTransfer: fullWorkload,
        remarks: remarks || undefined,
        subjects: subjectLabels
          .split(',')
          .map((label) => label.trim())
          .filter(Boolean)
          .map((subjectLabel) => ({ subjectLabel })),
      }),
    onSuccess: () => {
      onSuccess?.();
      onOpenChange(false);
    },
  });

  const selectedOriginal =
    staff.data?.data.find((row) => row.id === originalId) ??
    (originalStaffName ? { fullName: originalStaffName } : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Replacement Faculty</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Original Employee</span>
            {originalStaffProfileId ? (
              <div className="rounded-md border px-3 py-2 font-medium">
                {selectedOriginal?.fullName}
              </div>
            ) : (
              <select
                className="w-full rounded-md border bg-background px-3 py-2"
                value={originalId}
                onChange={(e) => setOriginalId(e.target.value)}
              >
                <option value="">Select faculty</option>
                {(staff.data?.data ?? []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.employeeCode} — {row.fullName}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Reason</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {REPLACEMENT_REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Department</span>
            <select
              className="w-full rounded-md border bg-background px-3 py-2"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">Select department</option>
              {(departments.data ?? []).map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Leave From</span>
            <DateInput value={startDate} onChange={setStartDate} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Leave To</span>
            <DateInput value={endDate} onChange={setEndDate} />
          </label>

          <div className="space-y-2 sm:col-span-2">
            <span className="text-sm text-muted-foreground">Substitute Staff</span>
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={substituteMode === 'existing'}
                  onChange={() => setSubstituteMode('existing')}
                />
                Select Existing
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={substituteMode === 'new'}
                  onChange={() => setSubstituteMode('new')}
                />
                Create New
              </label>
            </div>
            {substituteMode === 'existing' ? (
              <select
                className="w-full rounded-md border bg-background px-3 py-2"
                value={substituteStaffId}
                onChange={(e) => setSubstituteStaffId(e.target.value)}
              >
                <option value="">Select substitute</option>
                {(substitutes.data?.data ?? []).map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.substituteCode} — {row.fullName}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="w-full rounded-md border bg-background px-3 py-2"
                placeholder="Full name of new substitute"
                value={newSubstituteName}
                onChange={(e) => setNewSubstituteName(e.target.value)}
              />
            )}
          </div>

          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">
              Subjects Covered (comma-separated, e.g. BOT-101, BOT-203)
            </span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              value={subjectLabels}
              onChange={(e) => setSubjectLabels(e.target.value)}
            />
          </label>

          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={fullWorkload}
              onChange={(e) => setFullWorkload(e.target.checked)}
            />
            Full workload transfer
          </label>

          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm text-muted-foreground">Salary Arrangement</legend>
            {SALARY_ARRANGEMENT_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="salaryArrangement"
                  checked={salaryArrangement === opt.value}
                  onChange={() => setSalaryArrangement(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </fieldset>

          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Monthly Agreed Amount (optional)</span>
            <input
              className="w-full rounded-md border bg-background px-3 py-2"
              type="number"
              min={0}
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Remarks</span>
            <textarea
              className="min-h-[72px] w-full rounded-md border bg-background px-3 py-2"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </label>
        </div>

        {mut.isError ? (
          <p className="text-sm text-destructive">
            {apiErrorMessage(mut.error, 'Could not create assignment')}
          </p>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!originalId || !startDate || !endDate || mut.isPending}
            onClick={() => mut.mutate()}
          >
            {mut.isPending ? 'Saving…' : 'Assign Replacement'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
