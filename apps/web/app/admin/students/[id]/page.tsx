'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentProfileDashboard } from '@/components/students-module/profile/student-profile-dashboard';
import { buttonVariants } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchStudentProfile } from '@/services/students';
import { hasAnyPermission } from '@/lib/permissions/portal-access';
import { cn } from '@/utils/cn';

export default function StudentProfilePage() {
  const session = useRequireAuth();
  const params = useParams<{ id: string }>();
  const studentId = params.id;
  const qc = useQueryClient();

  const canEdit = useMemo(() => {
    const permissions = session?.user.permissions ?? [];
    return hasAnyPermission(permissions, [
      'students:manage',
      'students:photos:upload',
      'students:photos:replace',
    ]);
  }, [session?.user.permissions]);

  const profile = useQuery({
    queryKey: ['students', studentId, 'profile'],
    queryFn: () => fetchStudentProfile(studentId),
    enabled: Boolean(session) && Boolean(studentId),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['students', studentId, 'profile'] });
  };

  if (!session) return null;

  const data = profile.data;

  return (
    <DashboardShell role="admin" title={data?.fullName ?? 'Student profile'}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/students"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 text-xs')}
        >
          ← Students
        </Link>
        {data ? (
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={`/admin/students/${studentId}/academic`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-xs')}
            >
              Academic engine
            </Link>
            <Link
              href={`/admin/students/subject-registration?student=${studentId}`}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'h-7 text-xs')}
            >
              Subject registration
            </Link>
          </div>
        ) : null}
      </div>

      {profile.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading profile…</p>
      ) : profile.isError || !data ? (
        <p className="text-xs text-destructive">Could not load student profile.</p>
      ) : (
        <Suspense fallback={null}>
          <StudentProfileDashboard profile={data} canEdit={canEdit} onRefresh={invalidate} />
        </Suspense>
      )}
    </DashboardShell>
  );
}
