'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  fetchBackupDashboard,
  fetchBackupRuns,
  restoreBackup,
  verifyBackupRun,
} from '@/services/backup';
import { formatDisplayDateTime } from '@/utils/format-date';

export function BackupDisasterRecoveryPage() {
  useRequireAuth();
  const dashQ = useQuery({ queryKey: ['backups', 'dashboard'], queryFn: fetchBackupDashboard });
  const runsQ = useQuery({
    queryKey: ['backups', 'runs', 'dr'],
    queryFn: () => fetchBackupRuns({ status: 'SUCCESS', limit: 5 }),
  });

  const latest = runsQ.data?.items?.[0];
  const verifyM = useMutation({ mutationFn: () => verifyBackupRun(latest!.id) });
  const restoreM = useMutation({
    mutationFn: () => restoreBackup({ runId: latest!.id, mode: 'FULL', confirmText: 'RESTORE' }),
  });

  return (
    <DashboardShell role="admin" title="Disaster Recovery">
      <AdminShell>
        <AdminPageHeader
          title="Disaster Recovery"
          subtitle="Guided recovery using the latest successful backup"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <AdminGlassCard className="p-6">
            <h3 className="mb-2 font-medium">Health checks</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>Database: {dashQ.data?.dbHealth?.status ?? '…'}</li>
              <li>Maintenance: {dashQ.data?.maintenance?.active ? 'ACTIVE' : 'Normal'}</li>
              <li>Restore points: {dashQ.data?.restorePoints ?? '—'}</li>
            </ul>
          </AdminGlassCard>
          <AdminGlassCard className="p-6">
            <h3 className="mb-2 font-medium">Latest restore point</h3>
            {latest ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {latest.type.replace(/_/g, ' ')} ·{' '}
                  {formatDisplayDateTime(latest.completedAt ?? '')}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!latest || verifyM.isPending}
                    onClick={() => verifyM.mutate()}
                  >
                    Verify checksum
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!latest || restoreM.isPending}
                    onClick={() => restoreM.mutate()}
                  >
                    Restore latest (FULL)
                  </Button>
                </div>
                {restoreM.data ? (
                  <p className="mt-2 text-xs text-muted-foreground">{restoreM.data.message}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No successful backups yet.</p>
            )}
          </AdminGlassCard>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
