'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StaffSubjectsTab } from '@/components/staff-module/profile/staff-subjects-tab';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { fetchStaff, fetchStaffProfile } from '@/services/staff';

export default function StaffAssignmentsPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell role="admin" title="Teaching Assignments">
          <div />
        </DashboardShell>
      }
    >
      <StaffAssignmentsPageContent />
    </Suspense>
  );
}

function StaffAssignmentsPageContent() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();
  const searchParams = useSearchParams();
  const staffId = searchParams.get('staff') ?? '';

  const staffList = useQuery({
    queryKey: ['staff', 'assignments-picker'],
    queryFn: () => fetchStaff({ limit: 100, staffType: 'TEACHING' }),
    enabled: Boolean(session) && perms.canRead && !staffId,
  });

  const profile = useQuery({
    queryKey: ['staff', staffId, 'profile'],
    queryFn: () => fetchStaffProfile(staffId),
    enabled: Boolean(session) && Boolean(staffId) && perms.canRead,
  });

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Teaching Assignments">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Assign courses and semesters to teaching staff. Select a staff member to manage their
          subject load.
        </p>

        {!staffId ? (
          <CompactCard>
            <CompactCardHeader
              title="Select staff"
              description="Teaching staff with subject assignment workspace"
            />
            <CompactCardBody>
              <ul className="divide-y divide-border rounded-md border border-border text-sm">
                {(staffList.data?.data ?? []).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span>
                      {row.employeeCode} — {row.fullName}
                    </span>
                    <Link
                      href={`/admin/staff/assignments?staff=${row.id}`}
                      className="text-primary hover:underline"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            </CompactCardBody>
          </CompactCard>
        ) : profile.data ? (
          <StaffSubjectsTab
            profile={profile.data}
            canAssign={perms.canAssignSubjects}
            onRefresh={() => void profile.refetch()}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Loading staff profile…</p>
        )}

        <Link href="/admin/staff" className="text-sm text-primary hover:underline">
          ← Back to Staff Directory
        </Link>
      </div>
    </DashboardShell>
  );
}
