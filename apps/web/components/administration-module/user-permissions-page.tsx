'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useRequireAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  fetchPermissions,
  fetchPortalUsers,
  fetchUserEffectivePermissions,
  refreshAuthPermissions,
  updateUserPermissionOverrides,
} from '@/services/administration';
import { useAuthStore } from '@/store/auth-store';

export function UserPermissionsPage() {
  useRequireAuth();
  const { canManageRbac } = useAdminPermissions();
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [grantIds, setGrantIds] = useState<Set<string>>(new Set());
  const [denyIds, setDenyIds] = useState<Set<string>>(new Set());

  const usersQ = useQuery({
    queryKey: ['admin', 'users', 'permissions-picker', debouncedSearch],
    queryFn: () => fetchPortalUsers({ search: debouncedSearch || undefined, page: 1, limit: 30 }),
  });

  const permsQ = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: fetchPermissions,
    enabled: canManageRbac,
  });

  const effectiveQ = useQuery({
    queryKey: ['admin', 'user-permissions', selectedUserId],
    queryFn: () => fetchUserEffectivePermissions(selectedUserId!),
    enabled: Boolean(selectedUserId),
  });

  const saveMut = useMutation({
    mutationFn: () => updateUserPermissionOverrides(selectedUserId!, [...grantIds], [...denyIds]),
    onSuccess: async (data) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user-permissions', selectedUserId] });
      const refreshed = await refreshAuthPermissions();
      setSession(refreshed);
    },
  });

  const groupedPerms = useMemo(() => {
    const map = new Map<string, NonNullable<typeof permsQ.data>>();
    for (const p of permsQ.data ?? []) {
      const list = map.get(p.resource) ?? [];
      list.push(p);
      map.set(p.resource, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permsQ.data]);

  const selectedUser = usersQ.data?.items.find((u) => u.id === selectedUserId);

  return (
    <DashboardShell role="admin" title="User Permissions">
      <AdminShell>
        <AdminPageHeader
          title="User Permission Assignment"
          subtitle="Assign roles, scopes, and direct permission overrides"
        />
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <AdminGlassCard className="p-3">
            <Input
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3"
            />
            <ul className="max-h-[520px] space-y-1 overflow-y-auto">
              {(usersQ.data?.items ?? []).map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      selectedUserId === user.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setGrantIds(new Set());
                      setDenyIds(new Set());
                    }}
                  >
                    <span className="font-medium">{user.email}</span>
                    <span className="block text-xs opacity-80">
                      {user.roles.map((r) => r.name).join(', ') || 'No roles'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </AdminGlassCard>

          <AdminGlassCard className="p-4">
            {!selectedUser ? (
              <p className="text-sm text-muted-foreground">Select a user to manage permissions</p>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{selectedUser.email}</h3>
                    <p className="text-xs text-muted-foreground">
                      {(effectiveQ.data?.effectivePermissions ?? []).length} effective permissions
                    </p>
                  </div>
                  {canManageRbac ? (
                    <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
                      Save overrides
                    </Button>
                  ) : null}
                </div>

                {effectiveQ.data?.roles?.length ? (
                  <div className="mb-4 rounded-lg border p-3 text-sm">
                    <p className="mb-2 font-medium">Assigned roles</p>
                    <ul className="space-y-1 text-muted-foreground">
                      {effectiveQ.data.roles.map(
                        (r: { name: string; slug: string; departmentId?: string }) => (
                          <li key={r.slug}>
                            {r.name} ({r.slug})
                            {r.departmentId ? ` · dept ${r.departmentId.slice(0, 8)}…` : ''}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                ) : null}

                <div className="max-h-[480px] space-y-4 overflow-y-auto pr-2">
                  {groupedPerms.map(([resource, perms]) => (
                    <div key={resource}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {resource}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {perms?.map((p) => {
                          const effective = effectiveQ.data?.effectivePermissions?.includes(p.slug);
                          return (
                            <div key={p.id} className="rounded-lg border p-2 text-sm">
                              <p className="font-medium">{p.slug}</p>
                              <p className="text-xs text-muted-foreground">
                                {effective ? 'Effective' : 'Not granted'}
                              </p>
                              {canManageRbac ? (
                                <div className="mt-2 flex gap-3 text-xs">
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={grantIds.has(p.id)}
                                      onChange={(e) => {
                                        const next = new Set(grantIds);
                                        const denyNext = new Set(denyIds);
                                        if (e.target.checked) {
                                          next.add(p.id);
                                          denyNext.delete(p.id);
                                        } else next.delete(p.id);
                                        setGrantIds(next);
                                        setDenyIds(denyNext);
                                      }}
                                    />
                                    Grant
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="checkbox"
                                      checked={denyIds.has(p.id)}
                                      onChange={(e) => {
                                        const next = new Set(denyIds);
                                        const grantNext = new Set(grantIds);
                                        if (e.target.checked) {
                                          next.add(p.id);
                                          grantNext.delete(p.id);
                                        } else next.delete(p.id);
                                        setDenyIds(next);
                                        setGrantIds(grantNext);
                                      }}
                                    />
                                    Deny
                                  </label>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </AdminGlassCard>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
