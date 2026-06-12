'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { fetchPortalUsers } from '@/services/administration';
import { fetchStaff } from '@/services/staff';

export default function StaffPortalUsersPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell role="admin" title="Staff Portal Users">
          <div />
        </DashboardShell>
      }
    >
      <StaffPortalUsersPageContent />
    </Suspense>
  );
}

function StaffPortalUsersPageContent() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();
  const searchParams = useSearchParams();
  const staffFilter = searchParams.get('staff') ?? '';

  const staffWithPortal = useQuery({
    queryKey: ['staff', 'portal-filter'],
    queryFn: () => fetchStaff({ limit: 200 }),
    enabled: Boolean(session) && perms.canRead,
  });

  const portalUsers = useQuery({
    queryKey: ['admin', 'portal-users', 'staff-module'],
    queryFn: () => fetchPortalUsers({ limit: 100, role: 'faculty' }),
    enabled: Boolean(session) && perms.canPortal,
  });

  const rows = (staffWithPortal.data?.data ?? []).filter((s) => {
    if (staffFilter && s.id !== staffFilter) return false;
    return s.portalActive || s.portalPending || Boolean(s.email);
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Staff Portal Users">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Portal accounts linked to staff profiles. Full user management is available in
          Administration.
        </p>

        <CompactCard>
          <CompactCardHeader
            title="Staff portal status"
            description={`${rows.length} staff with portal records`}
          />
          <CompactCardBody className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-2">Staff</th>
                  <th className="py-2 pr-2">Email</th>
                  <th className="py-2 pr-2">Portal</th>
                  <th className="py-2">Profile</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/60">
                    <td className="py-2 pr-2">{row.fullName}</td>
                    <td className="py-2 pr-2">{row.email ?? '—'}</td>
                    <td className="py-2 pr-2">
                      {row.portalActive ? 'Active' : row.portalPending ? 'Pending' : 'None'}
                    </td>
                    <td className="py-2">
                      <Link
                        href={`/admin/staff/${row.id}?tab=settings`}
                        className="text-primary hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CompactCardBody>
        </CompactCard>

        {perms.canPortal ? (
          <CompactCard>
            <CompactCardHeader
              title="Faculty portal users"
              description="From administration module"
            />
            <CompactCardBody>
              <p className="text-xs text-muted-foreground">
                {portalUsers.data?.total ?? 0} faculty portal users registered.
              </p>
              <Link
                href="/admin/administration/portal-users"
                className="mt-2 inline-block text-xs text-primary hover:underline"
              >
                Open Portal Users admin →
              </Link>
            </CompactCardBody>
          </CompactCard>
        ) : null}

        <Link href="/admin/staff" className="text-sm text-primary hover:underline">
          ← Back to Staff Directory
        </Link>
      </div>
    </DashboardShell>
  );
}
