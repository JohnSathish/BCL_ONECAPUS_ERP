'use client';

import { use } from 'react';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InfrastructureWorkspace } from '@/components/infrastructure/infrastructure-workspace';
import { useRequireAuth } from '@/hooks/use-auth';

const sectionMap: Record<string, any> = {
  dashboard: 'dashboard',
  buildings: 'buildings',
  floors: 'floors',
  rooms: 'rooms',
  labs: 'labs',
  'shared-halls': 'shared-halls',
  calendar: 'calendar',
  availability: 'availability',
  import: 'import-export',
  reports: 'reports',
  settings: 'settings',
};

export default function InfrastructureSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const session = useRequireAuth();
  const { section } = use(params);
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Infrastructure">
      <InfrastructureWorkspace page={sectionMap[section] ?? 'dashboard'} />
    </DashboardShell>
  );
}
