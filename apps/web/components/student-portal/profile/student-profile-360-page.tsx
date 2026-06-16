'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { ErpWorkspace } from '@/components/erp/erp-workspace-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import {
  ProfileAcademicInfoSection,
  ProfileContactSection,
  ProfileDocumentCenter,
  ProfileParentSection,
  ProfilePersonalSection,
} from '@/components/student-portal/profile/profile-sections';
import {
  ProfileAcademicProgress,
  ProfileAcademicSnapshot,
  ProfileAchievements,
} from '@/components/student-portal/profile/profile-academic-widgets';
import { ProfileHero } from '@/components/student-portal/profile/profile-hero';
import { ProfileIdentityCard } from '@/components/student-portal/profile/profile-identity-card';
import {
  ProfileActivityTimeline,
  ProfileAttendanceWidget,
  ProfileFeeWidget,
  ProfileStatistics,
} from '@/components/student-portal/profile/profile-status-widgets';
import { Button } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentDashboard } from '@/hooks/use-student-dashboard';
import { fetchStudentPortalProfile, uploadStudentPortalDocument } from '@/services/student-portal';
import type { StudentPortalProfile360 } from '@/types/student-portal-profile';

export function StudentProfile360Page() {
  useRequireAuth();
  const qc = useQueryClient();
  const dashboard = useStudentDashboard();
  const profileQ = useQuery({
    queryKey: ['student-portal', 'profile'],
    queryFn: fetchStudentPortalProfile,
  });
  const profile = profileQ.data as StudentPortalProfile360 | undefined;

  const uploadMutation = useMutation({
    mutationFn: ({ type, file }: { type: string; file: File }) =>
      uploadStudentPortalDocument(type, file),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['student-portal', 'profile'] }),
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ['student-portal', 'profile'] });

  if (profileQ.isLoading) {
    return (
      <DashboardShell role="student" title="My Profile">
        <div className="animate-pulse space-y-4">
          <div className="h-40 rounded-2xl bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-48 rounded-2xl bg-muted" />
            <div className="h-48 rounded-2xl bg-muted" />
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!profile) {
    return (
      <DashboardShell role="student" title="My Profile">
        <p className="text-sm text-muted-foreground">Unable to load your profile.</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="student" title="My Profile">
      <ErpWorkspace className="space-y-4">
        <ProfileHero profile={profile} />

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <ProfileAcademicSnapshot profile={profile} />
            <div className="grid gap-4 sm:grid-cols-2">
              <ProfileAcademicProgress profile={profile} />
              <ProfileAchievements profile={profile} />
            </div>
            <ProfileStatistics profile={profile} />
            <ProfileActivityTimeline profile={profile} />

            <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
              <ProfilePersonalSection profile={profile} onRefresh={refresh} />
              <ProfileAcademicInfoSection profile={profile} />
              <ProfileContactSection profile={profile} onRefresh={refresh} />
              <ProfileParentSection profile={profile} onRefresh={refresh} />
              <ProfileDocumentCenter
                profile={profile}
                onUpload={(type, file) => uploadMutation.mutate({ type, file })}
              />
            </div>
          </div>

          <div className="space-y-4">
            <ProfileIdentityCard profile={profile} qrPass={dashboard.qrPass} />
            <ProfileAttendanceWidget profile={profile} />
            <ProfileFeeWidget profile={profile} />
            <Link href="/student/settings" className="md:hidden">
              <Button variant="outline" className="w-full rounded-xl">
                Account Settings
              </Button>
            </Link>
          </div>
        </div>
      </ErpWorkspace>
    </DashboardShell>
  );
}
