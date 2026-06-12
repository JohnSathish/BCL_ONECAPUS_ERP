import { AdminPortalGuard } from '@/components/auth/admin-portal-guard';
import { AdminPermissionGuard } from '@/components/layout/admin-permission-guard';
import { AdminPortalShell } from '@/components/layout/admin-portal-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminPortalGuard>
      <AdminPermissionGuard>
        <AdminPortalShell>{children}</AdminPortalShell>
      </AdminPermissionGuard>
    </AdminPortalGuard>
  );
}
