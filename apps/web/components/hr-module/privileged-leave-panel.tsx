'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchLeaveApplications, recordPrivilegedLeave, searchLeaveStaff } from '@/services/hr';
import { apiErrorMessage } from '@/utils/api-error';

export function PrivilegedLeavePanel() {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [staffProfileId, setStaffProfileId] = useState('');
  const [staffLabel, setStaffLabel] = useState('');
  const [leaveTypeCode, setLeaveTypeCode] = useState<'MAT' | 'PAT'>('MAT');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [approvalDate, setApprovalDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);

  const staffQ = useQuery({
    queryKey: ['hr', 'leave', 'staff', query],
    queryFn: () => searchLeaveStaff(query),
    enabled: query.trim().length >= 2 && !staffProfileId,
  });

  const historyQ = useQuery({
    queryKey: ['hr', 'leave', 'privileged'],
    queryFn: () => fetchLeaveApplications({ privileged: true }),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      recordPrivilegedLeave({
        staffProfileId,
        leaveTypeCode,
        fromDate,
        toDate,
        approvalDate,
        remarks,
        file,
      }),
    onSuccess: (row) => {
      const prior = row.priorRecords ?? 0;
      setFailed(false);
      setMessage(
        prior >= 2
          ? 'Leave recorded. This staff member already has two or more approved records of this leave.'
          : 'Leave recorded.',
      );
      setStaffProfileId('');
      setStaffLabel('');
      setQuery('');
      setFromDate('');
      setToDate('');
      setApprovalDate('');
      setRemarks('');
      setFile(null);
      void qc.invalidateQueries({ queryKey: ['hr', 'leave'] });
    },
    onError: (error) => {
      setFailed(true);
      setMessage(apiErrorMessage(error, 'Could not record leave'));
    },
  });

  return (
    <GlassCard className="p-4">
      <h3 className="font-semibold">Maternity and paternity leave</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Staff apply to the Principal in person. Record the leave here after it is granted. This does
        not reduce casual leave. Full-pay maternity leave is twice in a career, and full-pay
        paternity leave is for up to two children. Enter the dates the Principal has granted.
      </p>
      <form
        className="mt-4 grid gap-3 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          saveMut.mutate();
        }}
      >
        <div className="md:col-span-2">
          <Label htmlFor="leave-staff">Staff member</Label>
          <Input
            id="leave-staff"
            className="mt-1"
            value={staffProfileId ? staffLabel : query}
            placeholder="Search by name or employee code"
            onChange={(event) => {
              setStaffProfileId('');
              setStaffLabel('');
              setQuery(event.target.value);
            }}
          />
          {!staffProfileId && staffQ.data?.length ? (
            <ul className="mt-1 overflow-hidden rounded-lg border border-border bg-background text-sm">
              {staffQ.data.map((staff) => (
                <li key={staff.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      setStaffProfileId(staff.id);
                      setStaffLabel(`${staff.fullName} · ${staff.employeeCode}`);
                      setQuery('');
                    }}
                  >
                    {staff.fullName} · {staff.employeeCode}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <Label htmlFor="privileged-type">Leave type</Label>
          <select
            id="privileged-type"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={leaveTypeCode}
            onChange={(event) => setLeaveTypeCode(event.target.value as 'MAT' | 'PAT')}
          >
            <option value="MAT">Maternity Leave</option>
            <option value="PAT">Paternity Leave</option>
          </select>
        </div>
        <div>
          <Label htmlFor="approval-date">Approval date</Label>
          <Input
            id="approval-date"
            type="date"
            className="mt-1"
            required
            value={approvalDate}
            onChange={(event) => setApprovalDate(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="privileged-from">Start date</Label>
          <Input
            id="privileged-from"
            type="date"
            className="mt-1"
            required
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="privileged-to">End date</Label>
          <Input
            id="privileged-to"
            type="date"
            className="mt-1"
            required
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="privileged-remarks">Remarks</Label>
          <Input
            id="privileged-remarks"
            className="mt-1"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="privileged-file">Supporting document</Label>
          <Input
            id="privileged-file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="mt-1"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={!staffProfileId || saveMut.isPending}>
            Record leave
          </Button>
          {message ? (
            <p className={`mt-2 text-sm ${failed ? 'text-destructive' : 'text-muted-foreground'}`}>
              {message}
            </p>
          ) : null}
        </div>
      </form>

      <div className="mt-6 overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2 pr-2">Staff</th>
              <th className="py-2 pr-2">Type</th>
              <th className="py-2 pr-2">Dates</th>
              <th className="py-2 pr-2">Approved by</th>
              <th className="py-2">Document</th>
            </tr>
          </thead>
          <tbody>
            {(historyQ.data ?? []).map((row) => (
              <tr key={row.id} className="border-b border-border/60">
                <td className="py-2 pr-2">{row.staffProfile?.fullName}</td>
                <td className="py-2 pr-2">{row.leaveType?.name}</td>
                <td className="py-2 pr-2 text-xs">
                  {row.fromDate.slice(0, 10)} → {row.toDate.slice(0, 10)}
                </td>
                <td className="py-2 pr-2 text-xs">
                  {row.approvedByName || row.reviewedByName || '—'}
                  {row.approvedAt || row.reviewedAt
                    ? ` · ${String(row.approvedAt || row.reviewedAt).slice(0, 10)}`
                    : ''}
                </td>
                <td className="py-2 text-xs">
                  {row.attachmentUrl ? (
                    <a className="text-primary underline" href={row.attachmentUrl}>
                      Open
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {!historyQ.isLoading && !historyQ.data?.length ? (
              <tr>
                <td colSpan={5} className="py-4 text-muted-foreground">
                  No maternity or paternity leave has been recorded.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
