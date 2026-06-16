'use client';

import { useQuery } from '@tanstack/react-query';
import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { BackupRepositoryTable } from '@/components/backup-module/backup-repository-table';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { usePermissions } from '@/hooks/use-permissions';
import { fetchBackupRuns } from '@/services/backup';

export function BackupRepositoryPage() {
  useRequireAuth();
  const { canAny } = usePermissions();
  const { branding } = useInstitutionBranding();
  const canDownload = canAny('backup:download', 'backup:manage');
  const canManage = canAny('backup:manage');
  const institutionSlug =
    branding?.displayName?.split(',')[0]?.trim() ?? branding?.displayName ?? 'Institution';

  const runsQ = useQuery({
    queryKey: ['backups', 'runs'],
    queryFn: () => fetchBackupRuns({ limit: 50, status: 'SUCCESS' }),
  });

  return (
    <DashboardShell role="admin" title="Backup Repository">
      <AdminShell>
        <AdminPageHeader
          title="Backup Repository"
          subtitle="All instance backups — download, verify, restore, or delete from local and cloud-synced archives"
        />
        <AdminGlassCard className="overflow-hidden p-0">
          <BackupRepositoryTable
            runs={runsQ.data?.items ?? []}
            institutionSlug={institutionSlug}
            canDownload={canDownload}
            canManage={canManage}
          />
        </AdminGlassCard>
      </AdminShell>
    </DashboardShell>
  );
}
