'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import {
  fetchBulkUpdateBatch,
  fetchBulkUpdateBatches,
  formatFieldValue,
  rollbackBulkUpdate,
} from '@/services/student-bulk-update';
import { apiErrorMessage } from '@/utils/api-error';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';

export function BulkUpdateHistoryPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const focusBatchId = searchParams.get('batch');

  const batches = useQuery({
    queryKey: ['bulk-update', 'batches'],
    queryFn: fetchBulkUpdateBatches,
    enabled: Boolean(session) && perms.canBulkUpdate,
  });

  const detail = useQuery({
    queryKey: ['bulk-update', 'batch', focusBatchId],
    queryFn: () => fetchBulkUpdateBatch(focusBatchId!),
    enabled: Boolean(session) && Boolean(focusBatchId) && perms.canBulkUpdate,
  });

  const rollbackMut = useMutation({
    mutationFn: (batchId: string) => rollbackBulkUpdate(batchId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['bulk-update', 'batches'] });
      if (focusBatchId)
        void qc.invalidateQueries({ queryKey: ['bulk-update', 'batch', focusBatchId] });
    },
  });

  if (!session) return null;

  if (!perms.canBulkUpdate) {
    return (
      <DashboardShell role="admin" title="Bulk Update History">
        <p className="text-sm text-muted-foreground">
          You do not have permission to view bulk update history.
        </p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="admin" title="Bulk Update History">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/admin/students/bulk-update" className={cn(buttonVariants({ size: 'sm' }))}>
          New bulk update
        </Link>
        <Link
          href="/admin/students"
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          Student directory
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border">
          <div className="border-b border-border px-3 py-2 text-sm font-semibold">
            Recent batches
          </div>
          <div className="divide-y divide-border">
            {batches.isLoading ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">Loading…</p>
            ) : (batches.data ?? []).length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground">No batches yet.</p>
            ) : (
              (batches.data ?? []).map((batch) => (
                <Link
                  key={batch.id}
                  href={`/admin/students/bulk-update/history?batch=${batch.id}`}
                  className={cn(
                    'block px-3 py-2 text-xs hover:bg-muted/30',
                    focusBatchId === batch.id && 'bg-primary/5',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{batch.status}</span>
                    <span className="text-muted-foreground">
                      {new Date(batch.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {batch.studentCount} students · {batch.appliedCount} applied · mode{' '}
                    {batch.updateMode}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">Batch detail</span>
            {focusBatchId && detail.data?.status === 'APPLIED' && perms.canBulkUpdateRollback ? (
              <button
                type="button"
                className="text-xs text-destructive underline disabled:opacity-50"
                disabled={rollbackMut.isPending}
                onClick={() => rollbackMut.mutate(focusBatchId)}
              >
                {rollbackMut.isPending ? 'Rolling back…' : 'Rollback'}
              </button>
            ) : null}
          </div>
          {!focusBatchId ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">
              Select a batch to view changes.
            </p>
          ) : detail.isLoading ? (
            <p className="px-3 py-4 text-xs text-muted-foreground">Loading batch…</p>
          ) : detail.isError ? (
            <p className="px-3 py-4 text-xs text-destructive">
              {apiErrorMessage(detail.error, 'Failed to load batch')}
            </p>
          ) : detail.data ? (
            <div className="max-h-[520px] overflow-auto">
              <div className="space-y-1 border-b border-border px-3 py-2 text-xs text-muted-foreground">
                <p>Status: {detail.data.status}</p>
                <p>Students: {detail.data.studentCount}</p>
                <p>
                  Applied {detail.data.appliedCount} · Errors {detail.data.errorCount}
                </p>
                {rollbackMut.isError ? (
                  <p className="text-destructive">
                    {apiErrorMessage(rollbackMut.error, 'Rollback failed')}
                  </p>
                ) : null}
              </div>
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-2 py-2">Student</th>
                    <th className="px-2 py-2">Field</th>
                    <th className="px-2 py-2">Change</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data.changes.map((c) => (
                    <tr key={c.id} className="border-t border-border/60 align-top">
                      <td className="px-2 py-2">
                        {c.student.masterProfile?.fullName ?? '—'}
                        <div className="text-muted-foreground">
                          {c.student.rollNumber ?? c.student.enrollmentNumber}
                        </div>
                      </td>
                      <td className="px-2 py-2">{c.fieldKey}</td>
                      <td className="px-2 py-2">
                        {formatFieldValue(c.oldValue)} → {formatFieldValue(c.newValue)}
                      </td>
                      <td className="px-2 py-2">{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}
