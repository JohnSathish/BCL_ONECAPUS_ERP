'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchBackupLogs } from '@/services/backup';
import { formatDisplayDateTime } from '@/utils/format-date';

export function BackupLogsPage() {
  useRequireAuth();
  const [action, setAction] = useState('');
  const logsQ = useQuery({
    queryKey: ['backups', 'logs', action],
    queryFn: () => fetchBackupLogs({ action: action || undefined }),
  });

  return (
    <DashboardShell role="admin" title="Backup Logs">
      <AdminShell>
        <AdminPageHeader title="Backup Logs" subtitle="Backup audit trail" />
        <Input
          className="mb-4 max-w-xs"
          placeholder="Filter action…"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <AdminGlassCard className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Run</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody>
              {(logsQ.data?.items ?? []).map((log: Record<string, unknown>) => (
                <tr key={String(log.id)} className="border-b">
                  <td className="px-4 py-3">{formatDisplayDateTime(String(log.createdAt))}</td>
                  <td className="px-4 py-3">{String(log.action)}</td>
                  <td className="px-4 py-3 font-mono text-xs">{String(log.runId ?? '—')}</td>
                  <td className="px-4 py-3">{String(log.ipAddress ?? '—')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminGlassCard>
      </AdminShell>
    </DashboardShell>
  );
}
