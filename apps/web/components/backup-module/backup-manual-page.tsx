'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchBackupRun,
  triggerBackupRun,
  downloadBackupArtifact,
  formatBytes,
} from '@/services/backup';

const SELECT_CLASS = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm';

const TYPES = ['DATABASE_ONLY', 'DATABASE_DOCUMENTS', 'FULL_SNAPSHOT'];
const STEPS = [
  'PREPARING',
  'DUMPING_DB',
  'ARCHIVING_FILES',
  'EXPORTING_SETTINGS',
  'COMPRESSING',
  'UPLOADING_CLOUD',
  'COMPLETE',
];

export function BackupManualPage() {
  useRequireAuth();
  const [type, setType] = useState('DATABASE_DOCUMENTS');
  const [runId, setRunId] = useState<string | null>(null);

  const runM = useMutation({
    mutationFn: () => triggerBackupRun({ type }),
    onSuccess: (data) => setRunId(data.id),
    onError: (err: Error) => {
      if (err.message.includes('403') || err.message.includes('Forbidden')) {
        console.warn(
          'Backup permission denied — log out and sign in again after permissions update.',
        );
      }
    },
  });

  const statusQ = useQuery({
    queryKey: ['backups', 'run', runId],
    queryFn: () => fetchBackupRun(runId!),
    enabled: Boolean(runId),
    refetchInterval: (q) =>
      q.state.data?.status === 'RUNNING' || q.state.data?.status === 'QUEUED' ? 2000 : false,
  });

  const run = statusQ.data;
  const activeStep = run?.progressStep ?? 'PREPARING';

  return (
    <DashboardShell role="admin" title="Manual Backup">
      <AdminShell>
        <AdminPageHeader title="Manual Backup" subtitle="Run an on-demand instance backup" />
        <AdminGlassCard className="max-w-xl space-y-4 p-6">
          <div className="space-y-2">
            <Label>Backup type</Label>
            <select className={SELECT_CLASS} value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => runM.mutate()}
            disabled={runM.isPending || run?.status === 'RUNNING'}
          >
            Start backup
          </Button>
        </AdminGlassCard>

        {run ? (
          <AdminGlassCard className="mt-6 p-6">
            <div className="mb-4 text-sm">
              Status: <strong>{run.status}</strong>
              {run.errorMessage ? (
                <span className="ml-2 text-destructive">{run.errorMessage}</span>
              ) : null}
            </div>
            <ol className="space-y-2 text-sm">
              {STEPS.map((step) => {
                const idx = STEPS.indexOf(step);
                const activeIdx = STEPS.indexOf(activeStep);
                const done = run.status === 'SUCCESS' || idx < activeIdx;
                const current = step === activeStep && run.status === 'RUNNING';
                return (
                  <li
                    key={step}
                    className={
                      current ? 'font-medium text-primary' : done ? 'text-muted-foreground' : ''
                    }
                  >
                    {done ? '✓' : current ? '→' : '○'} {step.replace(/_/g, ' ')}
                  </li>
                );
              })}
            </ol>
            {run.status === 'SUCCESS' && run.artifacts?.length ? (
              <div className="mt-4 border-t pt-4">
                <p className="mb-2 text-sm font-medium">Download local backup files</p>
                <div className="flex flex-wrap gap-2">
                  {run.artifacts.map((a: { id: string; kind: string; sizeBytes: string }) => (
                    <Button
                      key={a.id}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        downloadBackupArtifact(
                          run.id,
                          a.id,
                          `${run.type.toLowerCase()}-${a.kind.toLowerCase()}.bin`,
                        )
                      }
                    >
                      {a.kind} ({formatBytes(a.sizeBytes)})
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
          </AdminGlassCard>
        ) : null}
      </AdminShell>
    </DashboardShell>
  );
}
