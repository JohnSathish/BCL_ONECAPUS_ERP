'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchBackupRuns, restoreBackup } from '@/services/backup';

const SELECT_CLASS = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm';

export function BackupRestorePage() {
  useRequireAuth();
  const params = useSearchParams();
  const [runId, setRunId] = useState(params.get('runId') ?? '');
  const [mode, setMode] = useState('FULL');
  const [confirm, setConfirm] = useState('');

  const runsQ = useQuery({
    queryKey: ['backups', 'runs', 'success'],
    queryFn: () => fetchBackupRuns({ status: 'SUCCESS' }),
  });

  const restoreM = useMutation({
    mutationFn: () => restoreBackup({ runId, mode, confirmText: confirm }),
  });

  return (
    <DashboardShell role="admin" title="Restore Center">
      <AdminShell>
        <AdminPageHeader
          title="Restore Center"
          subtitle="Super-admin only · A safety backup is created automatically before restore"
        />
        <AdminGlassCard className="max-w-xl space-y-4 p-6">
          <div className="space-y-2">
            <Label>Restore point</Label>
            <select
              className={SELECT_CLASS}
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
            >
              <option value="">Select backup run</option>
              {(runsQ.data?.items ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.type} — {r.completedAt?.slice(0, 16) ?? r.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Restore mode</Label>
            <select className={SELECT_CLASS} value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="DATABASE">Database only</option>
              <option value="FILES">Files only</option>
              <option value="FULL">Full (database + files)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Type RESTORE to confirm</Label>
            <Input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="RESTORE"
            />
          </div>
          <Button
            variant="destructive"
            disabled={!runId || confirm !== 'RESTORE' || restoreM.isPending}
            onClick={() => restoreM.mutate()}
          >
            Restore from backup
          </Button>
          {restoreM.data ? (
            <p className="text-sm text-muted-foreground">{restoreM.data.message}</p>
          ) : null}
          {restoreM.error ? (
            <p className="text-sm text-destructive">{(restoreM.error as Error).message}</p>
          ) : null}
        </AdminGlassCard>
      </AdminShell>
    </DashboardShell>
  );
}
