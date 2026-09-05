'use client';

import { AdminPortalGuard } from '@/components/auth/admin-portal-guard';
import { WorkspaceGuard } from '@/components/auth/workspace-guard';
import { AdminPermissionGuard } from '@/components/layout/admin-permission-guard';
import { AdminPortalShell } from '@/components/layout/admin-portal-shell';
import { SchoolErpShell } from '@/components/school-erp/school-erp-shell';
import { useAuth } from '@/hooks/use-auth';
import { isSchoolErpSession } from '@/lib/school-admissions-branding';
import { WorkspaceProvider } from '@/providers/workspace-provider';

export function SchoolAwareAdminLayout({ children }: { children: React.ReactNode }) {
  const { session, isReady } = useAuth();
  const school = isSchoolErpSession({
    tenantSlug: session?.user.tenantSlug,
    hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
  });

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6f4] text-sm text-slate-600">
        Loading School ERP…
      </div>
    );
  }

  if (school) {
    return (
      <AdminPortalGuard>
        <SchoolErpShell>{children}</SchoolErpShell>
      </AdminPortalGuard>
    );
  }

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
