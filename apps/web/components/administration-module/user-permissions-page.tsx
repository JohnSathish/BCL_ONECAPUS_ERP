'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ShieldCheck, UserCog, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { BulkRoleAssignmentPanel } from '@/components/administration-module/user-permissions/bulk-role-assignment-panel';
import { PromoteSuperAdminDialog } from '@/components/administration-module/user-permissions/promote-super-admin-dialog';
import { SuperAdminManagementPanel } from '@/components/administration-module/user-permissions/super-admin-management-panel';
import { UserPermissionModuleTree } from '@/components/administration-module/user-permissions/user-permission-module-tree';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useRequireAuth } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  buildModuleAccessSummary,
  groupPermissionsByModule,
  isSuperAdminRole,
  moduleAccessLabel,
  moduleAccessTone,
  primaryRoleLabel,
  QUICK_ASSIGN_ROLES,
} from '@/lib/permissions/user-permission-ui';
import {
  fetchPermissions,
  fetchPortalUsers,
  fetchUserEffectivePermissions,
  refreshAuthPermissions,
  updatePortalUser,
  updateUserPermissionOverrides,
} from '@/services/administration';
import { useAuthStore } from '@/store/auth-store';
import type { PortalUserRow } from '@/types/administration';
import { cn } from '@/utils/cn';

type UserFilter = 'all' | 'staff' | 'admin';

export function UserPermissionsPage() {
  useRequireAuth();
  const { canManageRbac } = useAdminPermissions();
  const qc = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [userFilter, setUserFilter] = useState<UserFilter>('staff');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [grantIds, setGrantIds] = useState<Set<string>>(new Set());
  const [denyIds, setDenyIds] = useState<Set<string>>(new Set());
  const [selectedRoleSlug, setSelectedRoleSlug] = useState('faculty');
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const roleFilterParam =
    userFilter === 'staff' ? 'faculty' : userFilter === 'admin' ? 'super-admin' : undefined;

  const usersQ = useQuery({
    queryKey: ['admin', 'users', 'permissions-picker', debouncedSearch, userFilter],
    queryFn: () =>
      fetchPortalUsers({
        search: debouncedSearch || undefined,
        role: roleFilterParam,
        page: 1,
        limit: 40,
      }),
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

  const visibleUsers = useMemo(() => {
    const items = usersQ.data?.items ?? [];
    if (userFilter !== 'all') return items;
    return items.filter((u) => !u.roles.every((r) => r.slug === 'applicant'));
  }, [usersQ.data?.items, userFilter]);

  const selectedUser = visibleUsers.find((u) => u.id === selectedUserId) ?? null;

  useEffect(() => {
    if (!effectiveQ.data?.overrides) return;
    const grants = new Set<string>();
    const denies = new Set<string>();
    for (const o of effectiveQ.data.overrides as {
      permissionId: string;
      effect: 'grant' | 'deny';
    }[]) {
      if (o.effect === 'grant') grants.add(o.permissionId);
      else denies.add(o.permissionId);
    }
    setGrantIds(grants);
    setDenyIds(denies);
  }, [effectiveQ.data?.overrides, selectedUserId]);

  useEffect(() => {
    if (!selectedUser) return;
    const primary = selectedUser.roles[0]?.slug;
    if (primary) setSelectedRoleSlug(primary);
  }, [selectedUser?.id]);

  const roleSlugs = useMemo(
    () => (effectiveQ.data?.roles ?? []).map((r: { slug: string }) => r.slug),
    [effectiveQ.data?.roles],
  );
  const roleNames = useMemo(
    () => (effectiveQ.data?.roles ?? []).map((r: { name: string }) => r.name),
    [effectiveQ.data?.roles],
  );
  const effectiveSet = useMemo(
    () => new Set<string>(effectiveQ.data?.effectivePermissions ?? []),
    [effectiveQ.data?.effectivePermissions],
  );

  const moduleSummary = useMemo(
    () => buildModuleAccessSummary(effectiveQ.data?.effectivePermissions ?? [], roleSlugs),
    [effectiveQ.data?.effectivePermissions, roleSlugs],
  );

  const moduleGroups = useMemo(() => groupPermissionsByModule(permsQ.data ?? []), [permsQ.data]);

  const isSuperAdmin = isSuperAdminRole(roleSlugs);

  const roleChangeMut = useMutation({
    mutationFn: (roleSlug: string) => updatePortalUser(selectedUserId!, { roleSlugs: [roleSlug] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'user-permissions', selectedUserId] });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const saveOverridesMut = useMutation({
    mutationFn: () => updateUserPermissionOverrides(selectedUserId!, [...grantIds], [...denyIds]),
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ['admin', 'user-permissions', selectedUserId] });
      const refreshed = await refreshAuthPermissions();
      setSession(refreshed);
    },
  });

  const handleGrantChange = (permissionId: string, checked: boolean) => {
    setGrantIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permissionId);
      else next.delete(permissionId);
      return next;
    });
    if (checked) {
      setDenyIds((prev) => {
        const next = new Set(prev);
        next.delete(permissionId);
        return next;
      });
    }
  };

  const handleDenyChange = (permissionId: string, checked: boolean) => {
    setDenyIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permissionId);
      else next.delete(permissionId);
      return next;
    });
    if (checked) {
      setGrantIds((prev) => {
        const next = new Set(prev);
        next.delete(permissionId);
        return next;
      });
    }
  };

  return (
    <DashboardShell role="admin" title="User Permissions">
      <AdminShell>
        <AdminPageHeader
          title="User Permission Management"
          subtitle="Assign roles quickly, review effective access, and manage overrides when needed"
        />

        <Tabs defaultValue="assign">
          <TabsList>
            <TabsTrigger value="assign" className="gap-1.5">
              <UserCog className="h-4 w-4" />
              Role assignment
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-1.5">
              <Users className="h-4 w-4" />
              Bulk assign
            </TabsTrigger>
            <TabsTrigger value="super-admins" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Super admins
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assign">
            <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
              <UserSearchPanel
                search={search}
                onSearchChange={setSearch}
                userFilter={userFilter}
                onUserFilterChange={setUserFilter}
                users={visibleUsers}
                loading={usersQ.isLoading}
                selectedUserId={selectedUserId}
                onSelectUser={(id) => setSelectedUserId(id)}
              />

              <AdminGlassCard className="p-4">
                {!selectedUser ? (
                  <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                    <UserCog className="mb-3 h-10 w-10 text-muted-foreground/50" />
                    <p className="font-medium">Select a user</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Search by name, email, or mobile number. Assign a role instead of toggling
                      individual permissions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <UserProfileCard
                      user={selectedUser}
                      primaryRole={primaryRoleLabel(roleSlugs, roleNames)}
                      effectiveCount={effectiveQ.data?.effectivePermissions?.length ?? 0}
                      isSuperAdmin={isSuperAdmin}
                    />

                    {canManageRbac ? (
                      <RoleAssignmentBar
                        selectedRoleSlug={selectedRoleSlug}
                        onRoleChange={setSelectedRoleSlug}
                        onApplyRole={() => roleChangeMut.mutate(selectedRoleSlug)}
                        applying={roleChangeMut.isPending}
                        isSuperAdmin={isSuperAdmin}
                        onPromote={() => setPromoteOpen(true)}
                      />
                    ) : null}

                    <PermissionProfilesRow
                      disabled={!canManageRbac || roleChangeMut.isPending}
                      onApply={(slug) => roleChangeMut.mutate(slug)}
                    />

                    <section>
                      <h4 className="mb-2 text-sm font-semibold">Effective permissions</h4>
                      <p className="mb-3 text-xs text-muted-foreground">
                        Readable summary by ERP module — no need to scan hundreds of checkboxes.
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {moduleSummary.map(({ module, level }) => (
                          <div
                            key={module.id}
                            className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
                          >
                            <span className="font-medium">{module.label}</span>
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                                moduleAccessTone(level),
                              )}
                            >
                              {moduleAccessLabel(level)}
                            </span>
                          </div>
                        ))}
                        {!moduleSummary.length ? (
                          <p className="text-sm text-muted-foreground">No module access granted.</p>
                        ) : null}
                      </div>
                    </section>

                    {effectiveQ.data?.dataScope ? (
                      <DataScopeSummary
                        scope={
                          effectiveQ.data.dataScope as {
                            allDepartments?: boolean;
                            departmentIds?: string[];
                          }
                        }
                      />
                    ) : null}

                    {canManageRbac ? (
                      <div className="rounded-lg border border-dashed border-border/70">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium"
                          onClick={() => setAdvancedOpen((v) => !v)}
                        >
                          {advancedOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          Advanced: direct permission overrides
                        </button>
                        {advancedOpen ? (
                          <div className="border-t px-3 py-3">
                            <p className="text-xs text-muted-foreground">
                              Grant or deny individual permissions on top of the assigned role.
                              Checkboxes appear in the module tree below.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <section>
                      <h4 className="mb-2 text-sm font-semibold">Module permissions</h4>
                      <UserPermissionModuleTree
                        groups={moduleGroups}
                        effectiveSlugs={effectiveSet}
                        grantIds={grantIds}
                        denyIds={denyIds}
                        canEdit={canManageRbac && advancedOpen}
                        onGrantChange={handleGrantChange}
                        onDenyChange={handleDenyChange}
                      />
                      {canManageRbac && advancedOpen ? (
                        <div className="mt-3 flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => saveOverridesMut.mutate()}
                            disabled={saveOverridesMut.isPending}
                          >
                            {saveOverridesMut.isPending ? 'Saving…' : 'Save overrides'}
                          </Button>
                        </div>
                      ) : null}
                    </section>
                  </div>
                )}
              </AdminGlassCard>
            </div>
          </TabsContent>

          <TabsContent value="bulk">
            <BulkRoleAssignmentPanel />
          </TabsContent>

          <TabsContent value="super-admins">
            <SuperAdminManagementPanel />
          </TabsContent>
        </Tabs>

        {selectedUser ? (
          <PromoteSuperAdminDialog
            open={promoteOpen}
            userName={selectedUser.name}
            userEmail={selectedUser.email}
            loading={roleChangeMut.isPending}
            onClose={() => setPromoteOpen(false)}
            onConfirm={() => {
              roleChangeMut.mutate('super-admin', {
                onSuccess: () => setPromoteOpen(false),
              });
            }}
          />
        ) : null}
      </AdminShell>
    </DashboardShell>
  );
}

function UserSearchPanel({
  search,
  onSearchChange,
  userFilter,
  onUserFilterChange,
  users,
  loading,
  selectedUserId,
  onSelectUser,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  userFilter: UserFilter;
  onUserFilterChange: (v: UserFilter) => void;
  users: PortalUserRow[];
  loading: boolean;
  selectedUserId: string | null;
  onSelectUser: (id: string) => void;
}) {
  return (
    <AdminGlassCard className="flex flex-col p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Search user
      </p>
      <Input
        placeholder="Name, email, or mobile…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="mb-2"
      />
      <div className="mb-3 flex flex-wrap gap-1">
        {(
          [
            ['staff', 'Staff'],
            ['admin', 'Admins'],
            ['all', 'All'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium transition',
              userFilter === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
            onClick={() => onUserFilterChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="min-h-[200px] flex-1 space-y-1 overflow-y-auto sidebar-scroll-auto">
        {loading ? (
          <li className="px-2 py-4 text-center text-sm text-muted-foreground">Loading…</li>
        ) : null}
        {users.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              className={cn(
                'w-full rounded-lg px-3 py-2.5 text-left text-sm transition',
                selectedUserId === user.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted',
              )}
              onClick={() => onSelectUser(user.id)}
            >
              <span className="block font-medium">{user.name}</span>
              <span
                className={cn(
                  'block truncate text-xs',
                  selectedUserId === user.id ? 'opacity-90' : 'text-muted-foreground',
                )}
              >
                {user.roles.map((r) => r.name).join(', ') || 'No role'}
              </span>
              <span
                className={cn(
                  'block truncate text-[11px]',
                  selectedUserId === user.id ? 'opacity-75' : 'text-muted-foreground/80',
                )}
              >
                {user.email}
              </span>
            </button>
          </li>
        ))}
        {!loading && !users.length ? (
          <li className="px-2 py-4 text-center text-sm text-muted-foreground">No users found</li>
        ) : null}
      </ul>
    </AdminGlassCard>
  );
}

function UserProfileCard({
  user,
  primaryRole,
  effectiveCount,
  isSuperAdmin,
}: {
  user: PortalUserRow;
  primaryRole: string;
  effectiveCount: number;
  isSuperAdmin: boolean;
}) {
  const initials = user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex flex-wrap items-start gap-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-lg font-semibold text-primary">
        {initials || '?'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{user.name}</h3>
          {isSuperAdmin ? (
            <Badge className="bg-primary/15 text-primary hover:bg-primary/15">Super Admin</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {user.department ? <span>Dept: {user.department.name}</span> : null}
          {user.mobile ? <span>Mobile: {user.mobile}</span> : null}
          {user.username ? <span>ID: {user.username}</span> : null}
        </div>
      </div>
      <div className="text-right text-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Current role</p>
        <p className="font-semibold">{primaryRole}</p>
        <p className="mt-1 text-xs text-muted-foreground">{effectiveCount} permissions effective</p>
      </div>
    </div>
  );
}

function RoleAssignmentBar({
  selectedRoleSlug,
  onRoleChange,
  onApplyRole,
  applying,
  isSuperAdmin,
  onPromote,
}: {
  selectedRoleSlug: string;
  onRoleChange: (slug: string) => void;
  onApplyRole: () => void;
  applying: boolean;
  isSuperAdmin: boolean;
  onPromote: () => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/50 p-3">
      <div className="min-w-[180px] flex-1">
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Change role</label>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={selectedRoleSlug}
          onChange={(e) => onRoleChange(e.target.value)}
        >
          {QUICK_ASSIGN_ROLES.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <Button onClick={onApplyRole} disabled={applying}>
        {applying ? 'Saving…' : 'Apply role'}
      </Button>
      {!isSuperAdmin ? (
        <Button variant="secondary" className="gap-1.5" onClick={onPromote} disabled={applying}>
          <ShieldCheck className="h-4 w-4" />
          Promote to Super Admin
        </Button>
      ) : null}
    </div>
  );
}

function PermissionProfilesRow({
  onApply,
  disabled,
}: {
  onApply: (slug: string) => void;
  disabled: boolean;
}) {
  const profiles = QUICK_ASSIGN_ROLES.filter((r) => r.templateSlug && r.slug !== 'super-admin');

  return (
    <section>
      <h4 className="mb-1 text-sm font-semibold">Permission profiles</h4>
      <p className="mb-2 text-xs text-muted-foreground">
        One-click role templates — Faculty, HOD, Principal, Finance, Library, and more.
      </p>
      <div className="flex flex-wrap gap-2">
        {profiles.map((profile) => (
          <Button
            key={profile.slug}
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => onApply(profile.slug)}
          >
            {profile.label}
          </Button>
        ))}
      </div>
    </section>
  );
}

function DataScopeSummary({
  scope,
}: {
  scope: { allDepartments?: boolean; departmentIds?: string[] };
}) {
  if (scope.allDepartments) {
    return (
      <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Department scope: all departments
      </p>
    );
  }
  if (scope.departmentIds?.length) {
    return (
      <p className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Department scope: {scope.departmentIds.length} department
        {scope.departmentIds.length === 1 ? '' : 's'} (scoped access)
      </p>
    );
  }
  return null;
}
