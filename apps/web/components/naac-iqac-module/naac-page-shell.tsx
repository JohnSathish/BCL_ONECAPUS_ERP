'use client';

import { NaacWorkspace } from '@/components/naac-iqac-module/naac-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';
import type { NaacPage } from '@/types/naac-iqac';

const TITLES: Record<NaacPage, string> = {
  dashboard: 'NAAC & IQAC Dashboard',
  criteria: 'Criteria & Metrics',
  evidence: 'Evidence Repository',
  vault: 'Document Vault',
  aqar: 'AQAR Management',
  department: 'Department Portal',
  faculty: 'Faculty Achievements',
  student: 'Student Achievements',
  mous: 'MoU Management',
  iqac: 'IQAC Activities',
  dvv: 'DVV Readiness',
  calendar: 'NAAC Calendar',
  reports: 'NAAC Reports',
  settings: 'NAAC Settings',
};

export function NaacPageShell({ page }: { page: NaacPage }) {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title={TITLES[page]}>
      <NaacWorkspace page={page} />
    </DashboardShell>
  );
}
