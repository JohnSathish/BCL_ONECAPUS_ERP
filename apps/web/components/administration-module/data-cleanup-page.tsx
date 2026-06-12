'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { AdminStatusPill } from '@/components/administration-module/ui/admin-status-pill';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchProgramDataCleanupReport,
  purgeCleanupVersion,
  purgeOrphanProgramVersions,
  removeUnusedProgram,
} from '@/services/program-data-cleanup';
import type { CleanupProgramRow, CleanupVersionRow } from '@/types/program-data-cleanup';
import { apiErrorMessage } from '@/utils/api-error';

function UsageSummary({ usage }: { usage: CleanupVersionRow['usage'] }) {
  const parts = [
    usage.offerings ? `${usage.offerings} mapping(s)` : null,
    usage.students ? `${usage.students} student(s)` : null,
    usage.registrations ? `${usage.registrations} registration(s)` : null,
    usage.deliverySections ? `${usage.deliverySections} section(s)` : null,
    usage.poolAssignments ? `${usage.poolAssignments} pool(s)` : null,
  ].filter(Boolean);
  return (
    <span className="text-xs text-muted-foreground">
      {parts.length ? parts.join(' · ') : 'No curriculum usage'}
    </span>
  );
}

function VersionTable({
  rows,
  onPurge,
  pendingId,
  actionLabel = 'Purge',
}: {
  rows: CleanupVersionRow[];
  onPurge: (row: CleanupVersionRow) => void;
  pendingId: string | null;
  actionLabel?: string;
}) {
  if (!rows.length) {
    return <p className="p-4 text-sm text-muted-foreground">Nothing to clean up.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <th className="px-4 py-3">Programme</th>
          <th className="px-4 py-3">Version</th>
          <th className="px-4 py-3">Usage</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-border/50">
            <td className="px-4 py-3">
              <div className="font-medium">{row.programCode}</div>
              <div className="text-xs text-muted-foreground">{row.programName}</div>
            </td>
            <td className="px-4 py-3">v{row.version}</td>
            <td className="px-4 py-3">
              <UsageSummary usage={row.usage} />
            </td>
            <td className="px-4 py-3">
              {row.safeToPurge ? (
                <AdminStatusPill status="active" />
              ) : (
                <span className="text-xs text-amber-700">{row.blockers.join('; ')}</span>
              )}
            </td>
            <td className="px-4 py-3 text-right">
              <Button
                size="sm"
                variant="outline"
                disabled={!row.safeToPurge || pendingId === row.id}
                onClick={() => onPurge(row)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {pendingId === row.id ? 'Removing…' : actionLabel}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UnusedProgrammesTable({
  rows,
  onRemove,
  pendingId,
}: {
  rows: CleanupProgramRow[];
  onRemove: (row: CleanupProgramRow) => void;
  pendingId: string | null;
}) {
  if (!rows.length) {
    return <p className="p-4 text-sm text-muted-foreground">No unused programmes found.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <th className="px-4 py-3">Code</th>
          <th className="px-4 py-3">Name</th>
          <th className="px-4 py-3">Versions</th>
          <th className="px-4 py-3">Status</th>
          <th className="px-4 py-3" />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-border/50">
            <td className="px-4 py-3 font-medium">
              {row.code}
              {row.looksLikeCourseCode ? (
                <span className="ml-2 text-xs text-amber-600">(course-like code)</span>
              ) : null}
            </td>
            <td className="px-4 py-3">{row.name}</td>
            <td className="px-4 py-3">{row.versions.length}</td>
            <td className="px-4 py-3">
              {row.safeToRemove ? (
                <AdminStatusPill status="active" />
              ) : (
                <span className="text-xs text-amber-700">{row.blockers.join('; ')}</span>
              )}
            </td>
            <td className="px-4 py-3 text-right">
              <Button
                size="sm"
                variant="outline"
                disabled={!row.safeToRemove || pendingId === row.id}
                onClick={() => onRemove(row)}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                {pendingId === row.id ? 'Removing…' : 'Remove programme'}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DataCleanupPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const reportQ = useQuery({
    queryKey: ['admin', 'program-data-cleanup'],
    queryFn: fetchProgramDataCleanupReport,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin', 'program-data-cleanup'] });

  const purgeMut = useMutation({
    mutationFn: (row: CleanupVersionRow) =>
      row.programDeleted
        ? purgeOrphanProgramVersions(row.programCode)
        : purgeCleanupVersion(row.id),
    onSuccess: invalidate,
  });

  const removeProgramMut = useMutation({
    mutationFn: (row: CleanupProgramRow) => removeUnusedProgram(row.id),
    onSuccess: invalidate,
  });

  const pendingId = purgeMut.isPending
    ? ((purgeMut.variables as CleanupVersionRow | undefined)?.id ?? null)
    : removeProgramMut.isPending
      ? ((removeProgramMut.variables as CleanupProgramRow | undefined)?.id ?? null)
      : null;

  const error = purgeMut.error ?? removeProgramMut.error;

  return (
    <DashboardShell role="admin" title="Data Cleanup">
      <AdminShell>
        <AdminPageHeader
          title="Data Cleanup"
          subtitle="Review and safely remove accidental programmes, orphan versions, and empty curriculum drafts"
        />

        {error ? (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {apiErrorMessage(error, 'Cleanup action failed')}
          </p>
        ) : null}

        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Unused Programmes
            </h2>
            <AdminGlassCard className="overflow-x-auto p-0">
              {reportQ.isLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading…</p>
              ) : (
                <UnusedProgrammesTable
                  rows={reportQ.data?.unusedProgrammes ?? []}
                  onRemove={(row) => removeProgramMut.mutate(row)}
                  pendingId={removeProgramMut.isPending ? pendingId : null}
                />
              )}
            </AdminGlassCard>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Orphan Versions
            </h2>
            <p className="mb-3 text-sm text-muted-foreground">
              Active curriculum versions whose parent programme was already removed.
            </p>
            <AdminGlassCard className="overflow-x-auto p-0">
              {reportQ.isLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading…</p>
              ) : (
                <VersionTable
                  rows={reportQ.data?.orphanVersions ?? []}
                  onPurge={(row) => purgeMut.mutate(row)}
                  pendingId={purgeMut.isPending ? pendingId : null}
                />
              )}
            </AdminGlassCard>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Empty Curriculum Versions
            </h2>
            <AdminGlassCard className="overflow-x-auto p-0">
              {reportQ.isLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Loading…</p>
              ) : (
                <VersionTable
                  rows={reportQ.data?.emptyCurriculumVersions ?? []}
                  onPurge={(row) => purgeMut.mutate(row)}
                  pendingId={purgeMut.isPending ? pendingId : null}
                />
              )}
            </AdminGlassCard>
          </section>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
