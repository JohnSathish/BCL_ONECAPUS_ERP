'use client';

import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { RollNumberGenerationPanel } from '@/components/administration-module/roll-number-generation-panel';
import { AdminShell } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export function RollNumberGenerationPage() {
  useRequireAuth();

  return (
    <DashboardShell role="admin" title="Roll Number Generation">
      <AdminShell>
        <AdminPageHeader
          title="Roll Number Generation Center"
          subtitle="Validate student data, preview roll numbers, and bulk-generate official college roll numbers for admitted students."
        />
        <RollNumberGenerationPanel />
      </AdminShell>
    </DashboardShell>
  );
}
