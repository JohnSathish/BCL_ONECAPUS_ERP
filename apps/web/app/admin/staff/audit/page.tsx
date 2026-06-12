'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Input } from '@/components/ui/input';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { fetchAuditLogs } from '@/services/administration';
import { fetchStaff } from '@/services/staff';
import { formatShortDate } from '@/utils/format-date';

export default function StaffAuditPage() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const staffSearch = useQuery({
    queryKey: ['staff', 'audit-search', search],
    queryFn: () => fetchStaff({ limit: 20, search: search || undefined }),
    enabled: Boolean(session) && search.length >= 2,
  });

  const auditLogs = useQuery({
    queryKey: ['admin', 'audit-logs', 'staff-module', selectedId],
    queryFn: () =>
      fetchAuditLogs({
        module: 'staff',
        ...(selectedId ? { entityId: selectedId } : {}),
        limit: '50',
      }),
    enabled: Boolean(session) && perms.canRead,
  });

  if (!session) return null;

  const rows = auditLogs.data?.items ?? [];

  return (
    <DashboardShell role="admin" title="Staff Audit Log">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Audit entries for staff module actions. Filter by staff member or view recent module
          activity.
        </p>

        <CompactCard>
          <CompactCardHeader
            title="Filter by staff"
            description="Optional — leave unselected to show all staff module entries"
          />
          <CompactCardBody className="space-y-3">
            <Input
              placeholder="Search staff (optional)…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (!e.target.value) setSelectedId('');
              }}
            />
            {search.length >= 2 ? (
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                <li className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-muted-foreground">All staff</span>
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => setSelectedId('')}
                  >
                    {!selectedId ? 'Selected' : 'Select'}
                  </button>
                </li>
                {(staffSearch.data?.data ?? []).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {row.employeeCode} — {row.fullName}
                    </span>
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => setSelectedId(row.id)}
                    >
                      {selectedId === row.id ? 'Selected' : 'Select'}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </CompactCardBody>
        </CompactCard>

        <CompactCard>
          <CompactCardHeader
            title="Audit entries"
            description={`${rows.length} record${rows.length === 1 ? '' : 's'}`}
          />
          <CompactCardBody className="overflow-x-auto">
            {auditLogs.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading audit logs…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit entries found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-2">When</th>
                    <th className="py-2 pr-2">Action</th>
                    <th className="py-2 pr-2">Entity</th>
                    <th className="py-2 pr-2">Actor</th>
                    <th className="py-2">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((log) => (
                    <tr key={log.id} className="border-b border-border/60">
                      <td className="py-2 pr-2 whitespace-nowrap">
                        {formatShortDate(log.createdAt)}
                      </td>
                      <td className="py-2 pr-2">{log.action}</td>
                      <td className="py-2 pr-2">{log.entityType}</td>
                      <td className="py-2 pr-2">{log.user?.email ?? '—'}</td>
                      <td className="max-w-[200px] truncate py-2">
                        {log.entityId ?? (log.metadata ? JSON.stringify(log.metadata) : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CompactCardBody>
        </CompactCard>

        <Link href="/admin/staff" className="text-sm text-primary hover:underline">
          ← Back to Staff Directory
        </Link>
      </div>
    </DashboardShell>
  );
}
