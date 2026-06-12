'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { fetchStaff } from '@/services/staff';

export default function StaffDocumentsPage() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();

  const staffList = useQuery({
    queryKey: ['staff', 'documents-index'],
    queryFn: () => fetchStaff({ limit: 100 }),
    enabled: Boolean(session) && perms.canRead,
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Staff Documents">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Document compliance across staff records. Upload and verify documents from each staff
          profile.
        </p>

        <CompactCard>
          <CompactCardHeader
            title="Staff records"
            description="Open profile documents tab to manage files"
          />
          <CompactCardBody>
            <ul className="divide-y divide-border rounded-md border border-border text-sm">
              {(staffList.data?.data ?? []).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>
                    {row.employeeCode} — {row.fullName}
                  </span>
                  <Link
                    href={`/admin/staff/${row.id}?tab=documents`}
                    className="text-primary hover:underline"
                  >
                    Documents
                  </Link>
                </li>
              ))}
            </ul>
          </CompactCardBody>
        </CompactCard>

        <Link href="/admin/staff" className="text-sm text-primary hover:underline">
          ← Back to Staff Directory
        </Link>
      </div>
    </DashboardShell>
  );
}
