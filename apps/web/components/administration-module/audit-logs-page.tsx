'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchAuditLogs } from '@/services/administration';
import { formatDisplayDateTime } from '@/utils/format-date';

export function AuditLogsPage() {
  useRequireAuth();
  const [module, setModule] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const logsQ = useQuery({
    queryKey: ['admin', 'audit', module, action, page],
    queryFn: () =>
      fetchAuditLogs({
        module: module || undefined,
        action: action || undefined,
        page: String(page),
        limit: '30',
      }),
  });

  return (
    <DashboardShell role="admin" title="Audit Logs">
      <AdminShell>
        <AdminPageHeader title="Audit Logs" subtitle="Platform-wide activity trail" />
        <div className="mb-4 flex flex-wrap gap-3">
          <Input
            className="max-w-xs"
            placeholder="Filter module…"
            value={module}
            onChange={(e) => {
              setModule(e.target.value);
              setPage(1);
            }}
          />
          <Input
            className="max-w-xs"
            placeholder="Filter action…"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <AdminGlassCard className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
              </tr>
            </thead>
            <tbody>
              {(logsQ.data?.items ?? []).map((log) => (
                <tr key={log.id} className="border-b border-border/50">
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                    {formatDisplayDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">{log.user?.email ?? '—'}</td>
                  <td className="px-4 py-3">{log.module ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-3 text-xs">
                    {log.entityType}
                    {log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminGlassCard>
      </AdminShell>
    </DashboardShell>
  );
}
