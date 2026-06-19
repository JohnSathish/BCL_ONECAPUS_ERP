'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, ShieldOff } from 'lucide-react';
import { AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { Button } from '@/components/ui/button';
import { useAdminPermissions } from '@/hooks/use-admin-permissions';
import { SUPER_ADMIN_ROLES } from '@/lib/permissions/permission-registry';
import { fetchPortalUsers, updatePortalUser } from '@/services/administration';

export function SuperAdminManagementPanel() {
  const { canManageRbac } = useAdminPermissions();
  const qc = useQueryClient();

  const superAdminsQ = useQuery({
    queryKey: ['admin', 'users', 'super-admins'],
    queryFn: async () => {
      const pages = await Promise.all([
        fetchPortalUsers({ role: 'super-admin', limit: 100, page: 1 }),
        fetchPortalUsers({ role: 'college-admin', limit: 100, page: 1 }),
        fetchPortalUsers({ role: 'university-admin', limit: 100, page: 1 }),
      ]);

      const seen = new Set<string>();
      const items = pages
        .flatMap((p) => p.items)
        .filter((u) => {
          if (seen.has(u.id)) return false;
          seen.add(u.id);
          return u.roles.some((r) => (SUPER_ADMIN_ROLES as readonly string[]).includes(r.slug));
        });

      return items;
    },
    enabled: canManageRbac,
  });

  const revokeMut = useMutation({
    mutationFn: (userId: string) => updatePortalUser(userId, { roleSlugs: ['staff'] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users', 'super-admins'] });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  if (!canManageRbac) {
    return (
      <AdminGlassCard className="p-6 text-sm text-muted-foreground">
        You need RBAC manage permission to view super admin accounts.
      </AdminGlassCard>
    );
  }

  const rows = superAdminsQ.data ?? [];

  return (
    <AdminGlassCard className="space-y-4 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Super Admin management</h3>
          <p className="text-sm text-muted-foreground">
            Accounts with unrestricted ERP access. Revoking removes super admin roles and assigns
            basic staff access.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">User</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="hidden px-3 py-2 font-medium md:table-cell">Last login</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((user) => {
              const superRoles = user.roles.filter((r) =>
                (SUPER_ADMIN_ROLES as readonly string[]).includes(r.slug),
              );
              return (
                <tr key={user.id} className="hover:bg-muted/20">
                  <td className="px-3 py-2.5">
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="px-3 py-2.5">{superRoles.map((r) => r.name).join(', ')}</td>
                  <td className="hidden px-3 py-2.5 text-muted-foreground md:table-cell">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-destructive hover:text-destructive"
                      disabled={revokeMut.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Revoke super admin access for ${user.name}? They will be assigned the Staff role.`,
                          )
                        ) {
                          revokeMut.mutate(user.id);
                        }
                      }}
                    >
                      <ShieldOff className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!rows.length && !superAdminsQ.isLoading ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No super admin accounts found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AdminGlassCard>
  );
}
