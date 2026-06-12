'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { PortalUsersTable } from '@/components/administration-module/portal-users-table';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  activatePortalUser,
  bulkActivateUsers,
  bulkResetPasswords,
  fetchActivationUsers,
  fetchRoles,
  resetPortalUserPassword,
  sendUserCredentials,
  suspendPortalUser,
} from '@/services/administration';
import type { PortalUserFilters, PortalUserRow } from '@/types/administration';

export function UserActivationPage() {
  useRequireAuth();
  const { canManageUsers, canImpersonate } = useAdminPermissions();
  const [filters, setFilters] = useState<PortalUserFilters>({ page: 1, limit: 25 });
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusTab, setStatusTab] = useState<string>('pending');

  const usersQ = useQuery({
    queryKey: ['admin', 'activation', statusTab, filters, search],
    queryFn: () =>
      fetchActivationUsers({ ...filters, status: statusTab, search: search || undefined }),
  });
  const rolesQ = useQuery({ queryKey: ['admin', 'roles'], queryFn: fetchRoles });

  const rows = usersQ.data?.items ?? [];
  const roles = (rolesQ.data ?? []).map((r) => ({ slug: r.slug, name: r.name }));
  const refresh = () => usersQ.refetch();

  const noop = (_: PortalUserRow) => {};

  return (
    <DashboardShell role="admin" title="User Activation">
      <AdminShell>
        <AdminPageHeader
          title="User Activation Center"
          subtitle="Pending, suspended, and blocked portal accounts"
          actions={
            canManageUsers && selectedIds.size > 0 ? (
              <>
                <Button
                  size="sm"
                  onClick={async () => {
                    await bulkActivateUsers([...selectedIds]);
                    setSelectedIds(new Set());
                    refresh();
                  }}
                >
                  Activate selected
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await bulkResetPasswords([...selectedIds]);
                    refresh();
                  }}
                >
                  Reset passwords
                </Button>
              </>
            ) : null
          }
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {['pending', 'suspended', 'blocked'].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusTab === s ? 'default' : 'outline'}
              onClick={() => {
                setStatusTab(s);
                setFilters((f) => ({ ...f, page: 1 }));
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>

        <Input
          className="mb-4 max-w-md"
          placeholder="Search email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <PortalUsersTable
          rows={rows}
          selectedIds={selectedIds}
          onToggle={(id) => {
            const next = new Set(selectedIds);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setSelectedIds(next);
          }}
          onToggleAll={() =>
            setSelectedIds(
              rows.every((r) => selectedIds.has(r.id)) ? new Set() : new Set(rows.map((r) => r.id)),
            )
          }
          onView={noop}
          onEdit={noop}
          onActivate={async (u) => {
            await activatePortalUser(u.id);
            refresh();
          }}
          onSuspend={async (u) => {
            await suspendPortalUser(u.id);
            refresh();
          }}
          onResetPassword={async (u) => {
            await resetPortalUserPassword(u.id);
            refresh();
          }}
          onSendCredentials={async (u) => {
            await sendUserCredentials(u.id);
          }}
          onImpersonate={noop}
          canManage={canManageUsers}
          canImpersonate={canImpersonate}
        />
      </AdminShell>
    </DashboardShell>
  );
}
