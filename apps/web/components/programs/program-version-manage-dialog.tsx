'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  archiveProgramVersion,
  createProgramVersion,
  deleteProgramVersion,
  duplicateProgramVersion,
  fetchProgramVersions,
  publishProgramVersion,
  purgeProgramVersion,
  relabelProgramVersion,
} from '@/services/programs';
import type { Program, ProgramVersionDetail, ProgramVersionStatus } from '@/types/programs';
import { apiErrorMessage } from '@/utils/api-error';
import { formatDisplayDate } from '@/utils/format-date';
import { cn } from '@/utils/cn';
import {
  getDraftVersion,
  getPublishedVersion,
  versionCurriculumUsageTotal,
  versionHardUsageTotal,
  versionStatusLabel,
  versionUsageTotal,
} from '@/utils/program-version';

type Props = {
  program: Program | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
  onVersionsChanged?: () => void;
};

function StatusPill({ status }: { status: ProgramVersionStatus }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        status === 'PUBLISHED' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        status === 'DRAFT' && 'bg-amber-500/15 text-amber-800 dark:text-amber-200',
        status === 'ARCHIVED' && 'bg-muted text-muted-foreground',
      )}
    >
      {status === 'PUBLISHED' ? 'Active' : versionStatusLabel(status)}
    </span>
  );
}

function formatUsageSummary(v: ProgramVersionDetail): string {
  const u = v.usage;
  if (!u || versionUsageTotal(u) === 0) return 'None';
  const parts: string[] = [];
  if (u.offerings) parts.push(`${u.offerings} map`);
  if (u.deliverySections) parts.push(`${u.deliverySections} sect`);
  if (u.poolAssignments) parts.push(`${u.poolAssignments} pool`);
  if (u.students) parts.push(`${u.students} stud`);
  if (u.registrations) parts.push(`${u.registrations} reg`);
  return parts.join(' · ');
}

export function ProgramVersionManageDialog({
  program,
  open,
  onOpenChange,
  canManage,
  onVersionsChanged,
}: Props) {
  const qc = useQueryClient();
  const [actionError, setActionError] = useState('');

  const versionsQuery = useQuery({
    queryKey: ['program-versions', program?.id],
    queryFn: () => fetchProgramVersions(program!.id),
    enabled: open && Boolean(program?.id),
  });

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['programs'] });
    await qc.invalidateQueries({ queryKey: ['catalog'] });
    if (program?.id) {
      await qc.invalidateQueries({ queryKey: ['program-versions', program.id] });
    }
    onVersionsChanged?.();
  };

  const createDraftMut = useMutation({
    mutationFn: (payload: { programId: string; sourceVersionId?: string }) =>
      createProgramVersion(payload),
    onSuccess: async () => {
      setActionError('');
      await invalidate();
    },
    onError: (e) => setActionError(apiErrorMessage(e, 'Action failed')),
  });

  const publishMut = useMutation({
    mutationFn: publishProgramVersion,
    onSuccess: async () => {
      setActionError('');
      await invalidate();
    },
    onError: (e) => setActionError(apiErrorMessage(e, 'Publish failed')),
  });

  const archiveMut = useMutation({
    mutationFn: archiveProgramVersion,
    onSuccess: async () => {
      setActionError('');
      await invalidate();
    },
    onError: (e) => setActionError(apiErrorMessage(e, 'Archive failed')),
  });

  const duplicateMut = useMutation({
    mutationFn: duplicateProgramVersion,
    onSuccess: async () => {
      setActionError('');
      await invalidate();
    },
    onError: (e) => setActionError(apiErrorMessage(e, 'Duplicate failed')),
  });

  const deleteMut = useMutation({
    mutationFn: deleteProgramVersion,
    onSuccess: async () => {
      setActionError('');
      await invalidate();
    },
    onError: (e) => setActionError(apiErrorMessage(e, 'Delete failed')),
  });

  const purgeMut = useMutation({
    mutationFn: purgeProgramVersion,
    onSuccess: async () => {
      setActionError('');
      await invalidate();
    },
    onError: (e) => setActionError(apiErrorMessage(e, 'Purge delete failed')),
  });

  const relabelMut = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      relabelProgramVersion(id, version),
    onSuccess: async () => {
      setActionError('');
      await invalidate();
    },
    onError: (e) => setActionError(apiErrorMessage(e, 'Rename failed')),
  });

  const versions = versionsQuery.data ?? program?.versions ?? [];
  const draft = getDraftVersion(versions);
  const published = getPublishedVersion(versions);
  const busy =
    createDraftMut.isPending ||
    publishMut.isPending ||
    archiveMut.isPending ||
    duplicateMut.isPending ||
    deleteMut.isPending ||
    purgeMut.isPending ||
    relabelMut.isPending;

  const handleCreateDraft = () => {
    if (draft || !program) return;

    const cloneCandidates = versions.filter((v) => v.status !== 'ARCHIVED');
    const defaultClone = published ?? cloneCandidates[0];
    const versionList = cloneCandidates.map((v) => `v${v.version} (${v.status})`).join(', ');

    const createBlank = window.confirm(
      `Existing versions: ${versionList || 'none'}\n\n` +
        'Create a blank draft version?\n\n' +
        'OK = blank draft\n' +
        'Cancel = clone from the active/published version',
    );

    createDraftMut.mutate({
      programId: program.id,
      sourceVersionId: createBlank ? undefined : defaultClone?.id,
    });
  };

  const handleRename = (v: ProgramVersionDetail) => {
    const raw = window.prompt(
      `Rename v${v.version} to version number (same database ID, labels only):`,
      String(v.version),
    );
    if (!raw) return;
    const next = Number(raw);
    if (!Number.isInteger(next) || next < 1) {
      window.alert('Enter a whole number ≥ 1');
      return;
    }
    if (
      !window.confirm(
        `Relabel v${v.version} → v${next}? Curriculum mappings and delivery sections stay linked to the same version ID.`,
      )
    ) {
      return;
    }
    relabelMut.mutate({ id: v.id, version: next });
  };

  if (!program) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Version management — {program.code}</DialogTitle>
          <DialogDescription>
            Only one version can be active (published) at a time. Deleting a version can affect
            curriculum mappings and delivery sections.
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            This programme already has an unpublished draft (v{draft.version}). Publish or remove it
            before creating another.
          </p>
        ) : null}

        {actionError ? (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {actionError}
          </p>
        ) : null}

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || Boolean(draft)}
              onClick={handleCreateDraft}
            >
              {createDraftMut.isPending ? 'Creating…' : 'Create version'}
            </Button>
            {published ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || Boolean(draft)}
                onClick={() => {
                  if (
                    window.confirm(
                      `Clone v${published.version} into a new draft? Curriculum mappings will be copied.`,
                    )
                  ) {
                    duplicateMut.mutate(published.id);
                  }
                }}
              >
                Clone version
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Published</th>
                <th className="px-3 py-2 font-medium">Usage</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {versionsQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Loading versions…
                  </td>
                </tr>
              ) : versions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No curriculum versions yet.
                  </td>
                </tr>
              ) : (
                versions.map((v) => {
                  const hardUsage = versionHardUsageTotal(v.usage);
                  const curriculumUsage = versionCurriculumUsageTotal(v.usage);
                  const canDelete =
                    v.status !== 'PUBLISHED' && hardUsage === 0 && curriculumUsage === 0;
                  const canPurge =
                    v.status !== 'PUBLISHED' && hardUsage === 0 && curriculumUsage > 0;
                  return (
                    <tr key={v.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2.5 font-medium">v{v.version}</td>
                      <td className="px-3 py-2.5">
                        <StatusPill status={v.status} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        <div>{formatDisplayDate(v.createdAt)}</div>
                        {v.createdBy?.email ? (
                          <div className="truncate">{v.createdBy.email}</div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {formatDisplayDate(v.publishedAt)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {formatUsageSummary(v)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Link
                            href={`/admin/programs?tab=curriculum&programVersionId=${v.id}`}
                            onClick={() => onOpenChange(false)}
                            className="inline-flex h-8 items-center rounded-md px-3 text-xs font-medium hover:bg-muted"
                          >
                            View
                          </Link>
                          {canManage ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => handleRename(v)}
                            >
                              Rename
                            </Button>
                          ) : null}
                          {canManage && v.status === 'DRAFT' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Set v${v.version} as the active version? The current active version will be archived.`,
                                  )
                                ) {
                                  publishMut.mutate(v.id);
                                }
                              }}
                            >
                              Set active
                            </Button>
                          ) : null}
                          {canManage && v.status !== 'ARCHIVED' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                const msg =
                                  v.status === 'PUBLISHED'
                                    ? `Archive the active v${v.version}? Admissions will require a new active version.`
                                    : `Archive v${v.version}? It will be read-only.`;
                                if (confirm(msg)) archiveMut.mutate(v.id);
                              }}
                            >
                              Archive
                            </Button>
                          ) : null}
                          {canManage ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy || Boolean(draft)}
                              onClick={() => duplicateMut.mutate(v.id)}
                            >
                              Clone
                            </Button>
                          ) : null}
                          {canManage && canPurge ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete v${v.version} and remove its ${curriculumUsage} curriculum artifact(s)?\n\nThis cannot be undone.`,
                                  )
                                ) {
                                  purgeMut.mutate(v.id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          ) : null}
                          {canManage && canDelete ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete empty v${v.version}? This cannot be undone.`,
                                  )
                                ) {
                                  deleteMut.mutate(v.id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
