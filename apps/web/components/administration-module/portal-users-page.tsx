'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Upload } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AdminKpiStrip } from '@/components/administration-module/admin-kpi-strip';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { PortalUserDrawer } from '@/components/administration-module/portal-user-drawer';
import { PortalUsersBulkBar } from '@/components/administration-module/portal-users-bulk-bar';
import { PortalUsersFilterRail } from '@/components/administration-module/portal-users-filter-rail';
import { PortalUsersTable } from '@/components/administration-module/portal-users-table';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  activatePortalUser,
  bulkActivateUsers,
  bulkResetPasswords,
  createPortalUser,
  fetchPortalUsers,
  fetchRoles,
  fetchUserSummary,
  impersonateUser,
  resetPortalUserPassword,
  sendUserCredentials,
  suspendPortalUser,
  updatePortalUser,
} from '@/services/administration';
import { storeAdminSessionBackup } from '@/components/administration-module/impersonation-banner';
import { useAuthStore } from '@/store/auth-store';
import type { PortalUserFilters, PortalUserRow } from '@/types/administration';
import { apiErrorMessage } from '@/utils/api-error';

export function PortalUsersPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const { canManageUsers, canImpersonate } = useAdminPermissions();
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);

  const [filters, setFilters] = useState<PortalUserFilters>({ page: 1, limit: 25 });
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<{
    open: boolean;
    mode: 'create' | 'edit' | 'view';
    user: PortalUserRow | null;
  }>({ open: false, mode: 'view', user: null });

  const queryFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch || undefined }),
    [filters, debouncedSearch],
  );

  const summaryQ = useQuery({
    queryKey: ['admin', 'users', 'summary'],
    queryFn: fetchUserSummary,
  });
  const usersQ = useQuery({
    queryKey: ['admin', 'users', queryFilters],
    queryFn: () => fetchPortalUsers(queryFilters),
  });
  const rolesQ = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: fetchRoles,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'users'] });
  };

  const createMut = useMutation({
    mutationFn: createPortalUser,
    onSuccess: () => {
      invalidate();
      setDrawer({ open: false, mode: 'create', user: null });
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updatePortalUser(id, payload),
    onSuccess: () => {
      invalidate();
      setDrawer({ open: false, mode: 'view', user: null });
    },
  });

  const rows = usersQ.data?.items ?? [];
  const roles = (rolesQ.data ?? []).map((r) => ({ slug: r.slug, name: r.name }));

  const toggleAll = () => {
    if (rows.every((r) => selectedIds.has(r.id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((r) => r.id)));
    }
  };

  const impersonateMut = useMutation({
    mutationFn: impersonateUser,
    onSuccess: (data) => {
      if (session) storeAdminSessionBackup(session);
      setSession(data);
      window.location.href = '/admin';
    },
  });

  return (
    <DashboardShell role="admin" title="Portal Users">
      <AdminShell>
        <AdminPageHeader
          title="Portal Users"
          subtitle="Centralized ERP login account management"
          actions={
            canManageUsers ? (
              <>
                <Link
                  href="/admin/administration/import-export"
                  className="inline-flex h-8 items-center rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-muted"
                >
                  <Upload className="mr-1 h-4 w-4" /> Bulk import
                </Link>
                <Button
                  size="sm"
                  onClick={() => setDrawer({ open: true, mode: 'create', user: null })}
                >
                  <Plus className="mr-1 h-4 w-4" /> Add user
                </Button>
              </>
            ) : null
          }
        />

        {summaryQ.data ? (
          <AdminKpiStrip
            items={[
              { label: 'Total', value: summaryQ.data.total },
              { label: 'Active', value: summaryQ.data.active, tone: 'text-emerald-600' },
              { label: 'Inactive', value: summaryQ.data.inactive },
              {
                label: 'Pending',
                value: summaryQ.data.pending,
                tone: 'text-amber-600',
                onClick: () => setFilters((f) => ({ ...f, status: 'pending', page: 1 })),
              },
              { label: 'Suspended', value: summaryQ.data.suspended, tone: 'text-orange-600' },
            ]}
          />
        ) : null}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name, email, username…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-3">
          <PortalUsersFilterRail
            filters={filters}
            roles={roles}
            onChange={(next) => {
              setFilters(next);
              setSelectedIds(new Set());
            }}
          />
        </div>

        <div className="mt-4">
          {usersQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading users…</p>
          ) : (
            <PortalUsersTable
              rows={rows}
              selectedIds={selectedIds}
              onToggle={(id) => {
                const next = new Set(selectedIds);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                setSelectedIds(next);
              }}
              onToggleAll={toggleAll}
              onView={(u) => setDrawer({ open: true, mode: 'view', user: u })}
              onEdit={(u) => setDrawer({ open: true, mode: 'edit', user: u })}
              onActivate={async (u) => {
                await activatePortalUser(u.id);
                invalidate();
              }}
              onSuspend={async (u) => {
                await suspendPortalUser(u.id);
                invalidate();
              }}
              onResetPassword={async (u) => {
                const res = await resetPortalUserPassword(u.id);
                alert(`New password: ${res.generatedPassword ?? '(see audit log)'}`);
              }}
              onSendCredentials={async (u) => {
                const res = await sendUserCredentials(u.id);
                alert(`Credentials sent stub — password: ${res.generatedPassword ?? 'n/a'}`);
              }}
              onImpersonate={(u) => impersonateMut.mutate(u.id)}
              canManage={canManageUsers}
              canImpersonate={canImpersonate}
            />
          )}
        </div>

        {usersQ.data && usersQ.data.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {usersQ.data.page} of {usersQ.data.totalPages} · {usersQ.data.total} users
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={(filters.page ?? 1) <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(filters.page ?? 1) >= usersQ.data.totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}

        <PortalUsersBulkBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onActivate={async () => {
            await bulkActivateUsers([...selectedIds]);
            setSelectedIds(new Set());
            invalidate();
          }}
          onResetPasswords={async () => {
            await bulkResetPasswords([...selectedIds]);
            invalidate();
          }}
          onSendCredentials={async () => {
            for (const id of selectedIds) await sendUserCredentials(id);
          }}
        />

        <PortalUserDrawer
          open={drawer.open}
          mode={drawer.mode}
          user={drawer.user}
          roles={roles}
          onClose={() => setDrawer({ open: false, mode: 'view', user: null })}
          loading={createMut.isPending || updateMut.isPending}
          onSubmit={(payload) => {
            if (drawer.mode === 'create') createMut.mutate(payload);
            else if (drawer.user) updateMut.mutate({ id: drawer.user.id, payload });
          }}
        />

        {(createMut.error || updateMut.error || impersonateMut.error) && (
          <p className="mt-4 text-sm text-destructive">
            {apiErrorMessage(
              createMut.error ?? updateMut.error ?? impersonateMut.error,
              'Action failed',
            )}
          </p>
        )}
      </AdminShell>
    </DashboardShell>
  );
}
