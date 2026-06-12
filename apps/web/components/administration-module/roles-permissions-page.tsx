'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  applyWorkspaceTemplate,
  createRole,
  fetchPermissions,
  fetchRoles,
  fetchWorkspaceTemplates,
  updateRolePermissions,
} from '@/services/administration';

export function RolesPermissionsPage() {
  useRequireAuth();
  const { canManageRbac } = useAdminPermissions();
  const qc = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [draftPermIds, setDraftPermIds] = useState<Set<string>>(new Set());

  const rolesQ = useQuery({ queryKey: ['admin', 'roles'], queryFn: fetchRoles });
  const permsQ = useQuery({
    queryKey: ['admin', 'permissions'],
    queryFn: fetchPermissions,
    enabled: canManageRbac,
  });
  const templatesQ = useQuery({
    queryKey: ['admin', 'workspace-templates'],
    queryFn: fetchWorkspaceTemplates,
    enabled: canManageRbac,
  });
  const [newRoleSlug, setNewRoleSlug] = useState('');
  const [newRoleName, setNewRoleName] = useState('');

  const selectedRole = rolesQ.data?.find((r) => r.id === selectedRoleId) ?? rolesQ.data?.[0];

  useEffect(() => {
    if (selectedRole && !selectedRoleId) setSelectedRoleId(selectedRole.id);
  }, [selectedRole, selectedRoleId]);

  useEffect(() => {
    if (selectedRole) {
      setDraftPermIds(new Set(selectedRole.permissions.map((p) => p.id)));
    }
  }, [selectedRole?.id]);

  const saveMut = useMutation({
    mutationFn: () => updateRolePermissions(selectedRole!.id, [...draftPermIds]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'roles'] }),
  });

  const templateMut = useMutation({
    mutationFn: (templateSlug: string) => applyWorkspaceTemplate(selectedRole!.id, templateSlug),
    onSuccess: (role) => {
      qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
      if (role?.permissions)
        setDraftPermIds(new Set(role.permissions.map((p: { id: string }) => p.id)));
    },
  });

  const createRoleMut = useMutation({
    mutationFn: () => createRole({ slug: newRoleSlug, name: newRoleName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setNewRoleSlug('');
      setNewRoleName('');
    },
  });

  const groupedPerms = useMemo(() => {
    const map = new Map<string, typeof permsQ.data>();
    for (const p of permsQ.data ?? []) {
      const list = map.get(p.resource) ?? [];
      list.push(p);
      map.set(p.resource, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permsQ.data]);

  return (
    <DashboardShell role="admin" title="Roles & Permissions">
      <AdminShell>
        <AdminPageHeader
          title="Roles & Permissions"
          subtitle="RBAC matrix — permissions loaded from database"
        />
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <AdminGlassCard className="p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Roles</p>
            <ul className="space-y-1">
              {(rolesQ.data ?? []).map((role) => (
                <li key={role.id}>
                  <button
                    type="button"
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      selectedRole?.id === role.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      setSelectedRoleId(role.id);
                      setDraftPermIds(new Set(role.permissions.map((p) => p.id)));
                    }}
                  >
                    <span className="font-medium">{role.name}</span>
                    <span className="block text-xs opacity-80">{role.userCount} users</span>
                  </button>
                </li>
              ))}
            </ul>
            {canManageRbac ? (
              <div className="mt-4 space-y-2 border-t pt-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Create role</p>
                <input
                  className="w-full rounded-md border px-2 py-1 text-sm"
                  placeholder="slug"
                  value={newRoleSlug}
                  onChange={(e) => setNewRoleSlug(e.target.value)}
                />
                <input
                  className="w-full rounded-md border px-2 py-1 text-sm"
                  placeholder="Display name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!newRoleSlug || !newRoleName || createRoleMut.isPending}
                  onClick={() => createRoleMut.mutate()}
                >
                  Create role
                </Button>
              </div>
            ) : null}
          </AdminGlassCard>

          <AdminGlassCard className="p-4">
            {selectedRole ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{selectedRole.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedRole.slug}</p>
                  </div>
                  {canManageRbac ? (
                    <div className="flex flex-wrap gap-2">
                      {(templatesQ.data ?? []).map((t) => (
                        <Button
                          key={t.slug}
                          size="sm"
                          variant="outline"
                          disabled={templateMut.isPending}
                          onClick={() => templateMut.mutate(t.slug)}
                        >
                          Apply {t.name}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        onClick={() => saveMut.mutate()}
                        disabled={saveMut.isPending}
                      >
                        Save permissions
                      </Button>
                    </div>
                  ) : null}
                </div>
                <div className="max-h-[560px] space-y-4 overflow-y-auto pr-2">
                  {groupedPerms.map(([resource, perms]) => (
                    <div key={resource}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {resource}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {perms?.map((p) => (
                          <label
                            key={p.id}
                            className="flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={draftPermIds.has(p.id)}
                              disabled={!canManageRbac || selectedRole.isSystem}
                              onChange={(e) => {
                                const next = new Set(draftPermIds);
                                if (e.target.checked) next.add(p.id);
                                else next.delete(p.id);
                                setDraftPermIds(next);
                              }}
                            />
                            <span>
                              <span className="font-medium">{p.slug}</span>
                              {p.description ? (
                                <span className="block text-xs text-muted-foreground">
                                  {p.description}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a role</p>
            )}
          </AdminGlassCard>
        </div>
      </AdminShell>
    </DashboardShell>
  );
}
