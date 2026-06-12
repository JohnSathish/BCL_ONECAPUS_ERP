'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StaffProfileDashboard } from '@/components/staff-module/profile/staff-profile-dashboard';
import { buttonVariants } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStaffPermissions } from '@/hooks/use-staff-permissions';
import { fetchStaffProfile } from '@/services/staff';
import { cn } from '@/utils/cn';

export default function StaffProfilePage() {
  const session = useRequireAuth();
  const perms = useStaffPermissions();
  const params = useParams<{ id: string }>();
  const staffId = params.id;
  const qc = useQueryClient();

  const profile = useQuery({
    queryKey: ['staff', staffId, 'profile'],
    queryFn: () => fetchStaffProfile(staffId),
    enabled: Boolean(session) && Boolean(staffId) && perms.canRead,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['staff', staffId, 'profile'] });
  };

  if (!session) return null;

  const data = profile.data;

  return (
    <DashboardShell role="admin" title={data?.fullName ?? 'Staff profile'}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/staff"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 text-xs')}
        >
          ← Staff
        </Link>
        {data ? (
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={`/admin/staff/assignments?staff=${staffId}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-xs')}
            >
              Teaching assignments
            </Link>
            <Link
              href={`/admin/staff/portal-users?staff=${staffId}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-xs')}
            >
              Portal access
            </Link>
          </div>
        ) : null}
      </div>

      {profile.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading profile…</p>
      ) : profile.isError || !data ? (
        <p className="text-xs text-destructive">Could not load staff profile.</p>
      ) : (
        <Suspense fallback={null}>
          <StaffProfileDashboard
            profile={data}
            canEdit={perms.canManage}
            canAssign={perms.canAssignSubjects}
            onRefresh={invalidate}
          />
        </Suspense>
      )}
    </DashboardShell>
  );
}
