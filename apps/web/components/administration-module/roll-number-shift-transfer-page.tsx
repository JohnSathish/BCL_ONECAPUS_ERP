'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ShiftTransferConfirmDialog } from '@/components/students-module/profile/shift-transfer-confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  bulkShiftTransfer,
  previewBulkShiftTransfer,
  type ShiftTransferPreview,
} from '@/services/roll-number';
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastResults, setLastResults] = useState<
    Array<{
      studentId: string;
      status: 'success' | 'failed';
      oldRollNumber?: string | null;
      newRollNumber?: string | null;
      error?: string;
    }>
  >([]);

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

  const previewQ = useQuery({
    queryKey: ['shift-transfer', 'preview-bulk', selectedIds, toShiftId],
    queryFn: () =>
      previewBulkShiftTransfer({
        studentIds: selectedIds,
        toShiftId,
      }),
    enabled: selectedIds.length > 0 && Boolean(toShiftId),
  });

  const previewByStudent = useMemo(() => {
    const map = new Map<string, ShiftTransferPreview>();
    for (const item of previewQ.data?.previews ?? []) {
      map.set(item.studentId, item);
    }
    return map;
  }, [previewQ.data?.previews]);

  const transferMut = useMutation({
    mutationFn: () =>
      bulkShiftTransfer({
        studentIds: selectedIds,
        toShiftId,
        reason: reason.trim() || undefined,
      }),
    onSuccess: (result) => {
      setLastResults(result.results);
      setMessage(
        `Transferred ${result.succeeded} of ${result.total} student(s). New roll numbers assigned in the destination shift.`,
      );
      setSelectedIds([]);
      setConfirmOpen(false);
      void qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Bulk shift transfer failed')),
  });

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const firstPreview = previewQ.data?.previews[0] ?? null;

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

              {selectedStudents.length > 0 && toShiftId ? (
                <div className="rounded-md border border-border/60 bg-muted/20 p-2 text-xs">
                  <p className="font-medium">Roll number preview</p>
                  {previewQ.isLoading ? (
                    <p className="mt-1 text-muted-foreground">Loading previews…</p>
                  ) : (
                    <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                      {selectedStudents.map((s) => {
                        const preview = previewByStudent.get(s.id);
                        const previewError = previewQ.data?.errors.find(
                          (e) => e.studentId === s.id,
                        );
                        return (
                          <li key={s.id} className="font-mono">
                            {s.rollNumber ?? '—'} →{' '}
                            {preview?.previewRollNumber ??
                              (previewError ? (
                                <span className="text-destructive">{previewError.error}</span>
                              ) : (
                                '—'
                              ))}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}

              <Button
                disabled={!selectedIds.length || !toShiftId || transferMut.isPending}
                onClick={() => setConfirmOpen(true)}
              >
                {transferMut.isPending
                  ? 'Transferring…'
                  : `Transfer ${selectedIds.length} student(s)`}
              </Button>
            </div>
          </AdminGlassCard>
        </div>

        {lastResults.length > 0 ? (
          <AdminGlassCard className="mt-4 p-4">
            <h2 className="text-sm font-semibold">Last transfer results</h2>
            <ul className="mt-2 divide-y divide-border text-sm">
              {lastResults.map((row) => (
                <li key={row.studentId} className="py-2">
                  {row.status === 'success' ? (
                    <span className="font-mono">
                      {row.oldRollNumber ?? '—'} → {row.newRollNumber ?? '—'}
                    </span>
                  ) : (
                    <span className="text-destructive">{row.error ?? 'Failed'}</span>
                  )}
                </li>
              ))}
            </ul>
          </AdminGlassCard>
        ) : null}

        <ShiftTransferConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          preview={firstPreview}
          bulkCount={selectedIds.length}
          pending={transferMut.isPending}
          onConfirm={() => transferMut.mutate()}
        />
      </AdminShell>
    </DashboardShell>
  );
}
