'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import { bulkShiftTransfer } from '@/services/roll-number';
import { fetchShifts } from '@/services/shifts';
import { fetchStudents } from '@/services/students';
import { apiErrorMessage } from '@/utils/api-error';

export function RollNumberShiftTransferPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toShiftId, setToShiftId] = useState('');
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');

  const shiftsQ = useQuery({
    queryKey: ['shifts', 'active'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
  });

  const studentsQ = useQuery({
    queryKey: ['students', 'shift-transfer', search],
    queryFn: () => fetchStudents({ limit: 30, search: search || undefined }),
    enabled: search.length >= 2,
  });

  const rows = studentsQ.data?.data ?? [];

  const selectedStudents = useMemo(
    () => rows.filter((s) => selectedIds.includes(s.id)),
    [rows, selectedIds],
  );

  const transferMut = useMutation({
    mutationFn: () =>
      bulkShiftTransfer({
        studentIds: selectedIds,
        toShiftId,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (result) => {
      setMessage(
        `Transferred ${result.succeeded} of ${result.total} student(s). New roll numbers assigned where shift ranges are configured.`,
      );
      setSelectedIds([]);
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Bulk shift transfer failed')),
  });

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <DashboardShell role="admin" title="Shift Transfer">
      <AdminShell>
        <AdminPageHeader
          title="Bulk Shift Transfer"
          subtitle="Transfer students between shifts with automatic roll number regeneration, vacancy marking, and audit history."
        />

        {message ? (
          <p className="mb-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            {message}
          </p>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          <AdminGlassCard className="p-4">
            <h2 className="text-sm font-semibold">Select students</h2>
            <Input
              className="mt-3"
              placeholder="Search by name or roll number (min 2 chars)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="mt-3 max-h-80 divide-y divide-border overflow-y-auto rounded-md border border-border text-sm">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-2 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.id)}
                    onChange={() => toggleStudent(row.id)}
                  />
                  <span className="flex-1">
                    {row.rollNumber ?? row.enrollmentNumber} — {row.fullName}
                    {row.shift ? (
                      <span className="ml-1 text-xs text-muted-foreground">({row.shift})</span>
                    ) : null}
                  </span>
                </li>
              ))}
              {!rows.length && search.length >= 2 ? (
                <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No students found
                </li>
              ) : null}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              {selectedIds.length} student(s) selected
            </p>
          </AdminGlassCard>

          <AdminGlassCard className="p-4">
            <h2 className="text-sm font-semibold">Transfer options</h2>
            <div className="mt-3 space-y-3">
              <div className="space-y-1.5">
                <Label>Target shift</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={toShiftId}
                  onChange={(e) => setToShiftId(e.target.value)}
                >
                  <option value="">Select shift…</option>
                  {(shiftsQ.data ?? []).map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name} ({shift.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Reason (audit)</Label>
                <Input
                  placeholder="Morning → Day transfer batch"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              {selectedStudents.length > 0 ? (
                <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs">
                  <p className="font-medium">Preview</p>
                  <ul className="mt-1 max-h-32 overflow-y-auto">
                    {selectedStudents.slice(0, 8).map((s) => (
                      <li key={s.id}>{s.rollNumber ?? '—'} → new roll in target shift</li>
                    ))}
                    {selectedStudents.length > 8 ? (
                      <li>…and {selectedStudents.length - 8} more</li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              <Button
                disabled={!selectedIds.length || !toShiftId || transferMut.isPending}
                onClick={() => transferMut.mutate()}
              >
                {transferMut.isPending
                  ? 'Transferring…'
                  : `Transfer ${selectedIds.length} student(s)`}
              </Button>
            </div>
          </AdminGlassCard>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
