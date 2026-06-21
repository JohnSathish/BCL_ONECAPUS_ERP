'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ExaminationManagementWorkspace } from '@/components/examinations/examination-management-workspace';
import { IaExaminationShell } from '@/components/examinations/ia/ia-examination-shell';
import { fetchIaSettings } from '@/services/examinations-ia';
import { useRequireAuth } from '@/hooks/use-auth';
import Link from 'next/link';

export default function LegacyExaminationsPage() {
  const session = useRequireAuth();
  const settings = useQuery({ queryKey: ['ia', 'settings'], queryFn: fetchIaSettings });
  if (!session) return null;

  if (settings.isLoading) return null;

  if (!settings.data?.legacyUniversityExamMode) {
    return (
      <DashboardShell role="admin" pageHeader={false} title="Legacy Examinations">
        <IaExaminationShell>
          <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm">
            <p className="font-medium">Legacy university exam mode is disabled.</p>
            <p className="mt-2 text-muted-foreground">
              Enable &quot;Legacy University Exam Mode&quot; in{' '}
              <Link
                href="/admin/academics/examinations/settings"
                className="text-primary hover:underline"
              >
                Settings
              </Link>{' '}
              to access end-semester room allocation, invigilators, and result publish.
            </p>
          </div>
        </IaExaminationShell>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell role="admin" pageHeader={false} title="Legacy Examinations">
      <IaExaminationShell>
        <ExaminationManagementWorkspace />
      </IaExaminationShell>
    </DashboardShell>
  );
}
