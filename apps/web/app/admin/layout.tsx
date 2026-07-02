import { AdminPortalGuard } from '@/components/auth/admin-portal-guard';
import { WorkspaceGuard } from '@/components/auth/workspace-guard';
import { AdminPermissionGuard } from '@/components/layout/admin-permission-guard';
import { AdminPortalShell } from '@/components/layout/admin-portal-shell';
import { WorkspaceProvider } from '@/providers/workspace-provider';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminPortalGuard>
      <WorkspaceProvider>
        <WorkspaceGuard>
          <AdminPermissionGuard>
            <AdminPortalShell>{children}</AdminPortalShell>
          </AdminPermissionGuard>
        </WorkspaceGuard>
      </WorkspaceProvider>
    </AdminPortalGuard>
  );
}
