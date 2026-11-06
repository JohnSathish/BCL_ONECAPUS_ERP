'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useStepUpAction } from '@/hooks/use-step-up-action';
import {
  deleteBackupRun,
  downloadBackupBundle,
  formatBytes,
  verifyBackupRun,
  type BackupRunRow,
} from '@/services/backup';
import { backupRunTypeLabel, buildBackupDownloadName, formatShortBackupDate } from './backup-utils';

type Props = {
  runs: BackupRunRow[];
  institutionSlug: string;
  canDownload: boolean;
  canManage: boolean;
  compact?: boolean;
};

export function archiveChecksum(run: BackupRunRow) {
  return (
    run.artifacts?.find((a) => a.kind === 'ARCHIVE')?.checksumSha256 ??
    run.artifacts?.find((a) => a.checksumSha256)?.checksumSha256 ??
    null
  );
}

function shortChecksum(value: string | null) {
  if (!value) return '—';
  return `${value.slice(0, 12)}…`;
}

export function BackupRepositoryTable({
  runs,
  institutionSlug,
  canDownload,
  canManage,
  compact = false,
}: Props) {
  const qc = useQueryClient();
  const { withStepUp, stepUpDialog } = useStepUpAction({
    description: 'Re-enter your password to download this backup file.',
  });
  const verifyM = useMutation({
    mutationFn: verifyBackupRun,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });
  const deleteM = useMutation({
    mutationFn: deleteBackupRun,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backups'] }),
  });

  const downloadRun = (run: BackupRunRow) => {
    const filename = buildBackupDownloadName(institutionSlug, run.completedAt, 'zip');
    withStepUp((token) => downloadBackupBundle(run.id, filename, token));
  };

  if (!runs.length) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted-foreground">
        No backups in the repository yet. Run a manual or scheduled backup to get started.
      </p>
    );
  }

  return (
    <>
      {stepUpDialog}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Checksum</th>
              <th className="px-4 py-3">Integrity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className="border-b align-middle hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">
                  {formatShortBackupDate(run.completedAt ?? run.startedAt)}
                </td>
                <td className="px-4 py-3">{backupRunTypeLabel(run.type)}</td>
                <td className="px-4 py-3 tabular-nums">{formatBytes(run.sizeBytes)}</td>
                <td className="px-4 py-3 font-mono text-xs" title={archiveChecksum(run) ?? ''}>
                  {shortChecksum(archiveChecksum(run))}
                </td>
                <td className="px-4 py-3">
                  {run.artifacts?.some((a) => a.kind === 'ARCHIVE' && a.verifiedAt)
                    ? 'ZIP verified'
                    : run.artifacts?.some((a) => a.kind === 'ARCHIVE')
                      ? 'ZIP packed'
                      : 'Not a ZIP yet'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      run.status === 'SUCCESS'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : run.status === 'FAILED'
                          ? 'text-destructive'
                          : 'text-muted-foreground'
                    }
                    title={run.errorMessage ?? ''}
                  >
                    {run.status === 'SUCCESS'
                      ? 'Successful'
                      : run.status === 'FAILED'
                        ? 'Failed'
                        : run.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {canDownload && run.status === 'SUCCESS' ? (
                      <Button size="sm" variant="outline" onClick={() => downloadRun(run)}>
                        Download
                      </Button>
                    ) : null}
                    {canManage && !compact ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={verifyM.isPending}
                          onClick={() => verifyM.mutate(run.id)}
                        >
                          Verify
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/admin/administration/backups/restore?runId=${run.id}`}>
                            Restore
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => deleteM.mutate(run.id)}
                        >
                          Delete
                        </Button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
