'use client';

import { ScholarshipConcessionPanel } from '@/components/fees-module/scholarship-concession-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Scholarships & Concessions">
      <ScholarshipConcessionPanel />
    </DashboardShell>
  );
}
