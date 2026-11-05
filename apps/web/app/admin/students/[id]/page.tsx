'use client';

import { useParams } from 'next/navigation';
import { Suspense, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { StudentProfileDashboard } from '@/components/students-module/profile/student-profile-dashboard';
import { useRequireAuth } from '@/hooks/use-auth';
import { fetchStudentProfile } from '@/services/students';
import { hasAnyPermission } from '@/lib/permissions/portal-access';

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
    <DashboardShell role="admin" title={data?.fullName ?? 'Student profile'} pageHeader={false}>
      {profile.isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading student profile">
          <div className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,43fr)_minmax(0,30fr)_minmax(0,27fr)]">
            <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white" />
            <div className="h-96 animate-pulse rounded-xl border border-slate-200 bg-white" />
            <div className="h-96 animate-pulse rounded-xl bg-blue-100/70" />
          </div>
        </div>
      ) : profile.isError || !data ? (
        <QueryErrorPanel
          title="Unable to load student profile"
          error={profile.error}
          onRetry={() => void profile.refetch()}
          isRetrying={profile.isFetching}
        />
      ) : (
        <Suspense fallback={null}>
          <StudentProfileDashboard profile={data} canEdit={canEdit} onRefresh={invalidate} />
        </Suspense>
      )}
    </DashboardShell>
  );
}
