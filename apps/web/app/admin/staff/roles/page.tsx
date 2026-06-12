'use client';

import Link from 'next/link';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { buttonVariants } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { cn } from '@/utils/cn';

export default function StaffRolesPage() {
  const session = useRequireAuth();

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Staff Roles">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Academic roles (HoD, IQAC, Exam Controller) are managed in Support Data. Portal login
          roles remain in Administration RBAC.
        </p>

        <CompactCard>
          <CompactCardHeader
            title="Additional Academic Roles"
            description="Head of Department, IQAC Coordinator, Dean, etc."
          />
          <CompactCardBody className="space-y-2">
            <p className="text-xs text-muted-foreground">
              HoD is an additional role — never a primary designation. Manage role definitions in
              Support Data.
            </p>
            <Link
              href="/admin/administration/support-data?category=additional-roles"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'h-8 text-xs')}
            >
              Open Support Data — Additional Roles
            </Link>
          </CompactCardBody>
        </CompactCard>

        <CompactCard>
          <CompactCardHeader
            title="Portal Roles & Permissions"
            description="Configure faculty, shift, and other staff-facing login roles"
          />
          <CompactCardBody className="space-y-2">
            <Link
              href="/admin/administration/roles"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-8 text-xs')}
            >
              Open Roles & Permissions
            </Link>
          </CompactCardBody>
        </CompactCard>

        <Link href="/admin/staff" className="text-sm text-primary hover:underline">
          ← Back to Staff Directory
        </Link>
      </div>
    </DashboardShell>
  );
}
