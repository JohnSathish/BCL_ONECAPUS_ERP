'use client';

import { useState } from 'react';

import { BackupDownloadDialog } from '@/components/backup-module/backup-download-dialog';

export function useBackupDownload() {
  const [target, setTarget] = useState<{ runId: string; filename: string } | null>(null);

  const startDownload = (runId: string, filename: string) => {
    setTarget({ runId, filename });
  };

  const downloadDialog = (
    <BackupDownloadDialog
      open={target != null}
      runId={target?.runId ?? null}
      filename={target?.filename ?? 'college-backup.zip'}
      onOpenChange={(open) => {
        if (!open) setTarget(null);
      }}
    />
  );

  return { startDownload, downloadDialog };
}
