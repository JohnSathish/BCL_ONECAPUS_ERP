'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { QUICK_ASSIGN_ROLES } from '@/lib/permissions/user-permission-ui';
import { fetchPortalUsers, updatePortalUser } from '@/services/administration';
import type { PortalUserRow } from '@/types/administration';

export function BulkRoleAssignmentPanel() {
  const { canManageRbac } = useAdminPermissions();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [roleFilter, setRoleFilter] = useState('faculty');
  const [assignRole, setAssignRole] = useState('faculty');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const usersQ = useQuery({
    queryKey: ['admin', 'users', 'bulk-role', debouncedSearch, roleFilter],
    queryFn: () =>
      fetchPortalUsers({
        search: debouncedSearch || undefined,
        role: roleFilter || undefined,
        page: 1,
        limit: 50,
      }),
    enabled: canManageRbac,
  });

  const assignMut = useMutation({
    mutationFn: async (userIds: string[]) => {
      await Promise.all(userIds.map((id) => updatePortalUser(id, { roleSlugs: [assignRole] })));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setSelected(new Set());
    },
  });

  const visibleUsers = useMemo(
    () => (usersQ.data?.items ?? []).filter((u) => !u.roles.some((r) => r.slug === 'applicant')),
    [usersQ.data?.items],
  );

  const toggleAll = () => {
    if (selected.size === visibleUsers.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(visibleUsers.map((u) => u.id)));
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!canManageRbac) {
    return (
      <AdminGlassCard className="p-6 text-sm text-muted-foreground">
        You need RBAC manage permission to assign roles in bulk.
      </AdminGlassCard>
    );
  }

  return (
    <AdminGlassCard className="space-y-4 p-4">
      <div>
        <h3 className="font-semibold">Bulk role assignment</h3>
        <p className="text-sm text-muted-foreground">
          Select users and assign a role in one step. Replaces each user&apos;s current roles.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search staff…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All users</option>
          {QUICK_ASSIGN_ROLES.map((r) => (
            <option key={r.slug} value={r.slug}>
              Current: {r.label}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={assignRole}
          onChange={(e) => setAssignRole(e.target.value)}
        >
          {QUICK_ASSIGN_ROLES.filter((r) => r.slug !== 'super-admin').map((r) => (
            <option key={r.slug} value={r.slug}>
              Assign: {r.label}
            </option>
          ))}
        </select>
        <Button
          disabled={!selected.size || assignMut.isPending}
          onClick={() => assignMut.mutate([...selected])}
        >
          {assignMut.isPending
            ? 'Saving…'
            : `Assign to ${selected.size} user${selected.size === 1 ? '' : 's'}`}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="flex items-center gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <input
            type="checkbox"
            checked={visibleUsers.length > 0 && selected.size === visibleUsers.length}
            onChange={toggleAll}
          />
          <span className="flex-1">User</span>
          <span className="w-40 hidden sm:block">Current role</span>
        </div>
        <ul className="max-h-[420px] divide-y overflow-y-auto">
          {visibleUsers.map((user) => (
            <BulkUserRow
              key={user.id}
              user={user}
              checked={selected.has(user.id)}
              onToggle={() => toggleOne(user.id)}
            />
          ))}
          {!visibleUsers.length ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              No users match this filter.
            </li>
          ) : null}
        </ul>
      </div>
    </AdminGlassCard>
  );
}

function BulkUserRow({
  user,
  checked,
  onToggle,
}: {
  user: PortalUserRow;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted/30">
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      </div>
      <p className="hidden w-40 truncate text-xs text-muted-foreground sm:block">
        {user.roles.map((r) => r.name).join(', ') || '—'}
      </p>
    </li>
  );
}
