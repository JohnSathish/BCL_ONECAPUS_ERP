'use client';

import Link from 'next/link';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StaffBulkImportPanel } from '@/components/staff-module/import/staff-bulk-import-panel';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';

export default function StaffBulkImportPage() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Bulk Staff Import Studio">
      <div className="mx-auto max-w-7xl space-y-4">
        <StaffBulkImportPanel canImport={perms.canImport} />
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/staff"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            ← Back to Staff Directory
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}
