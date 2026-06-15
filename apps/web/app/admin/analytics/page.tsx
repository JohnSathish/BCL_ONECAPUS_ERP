'use client';

import { EnterpriseAnalyticsDashboard } from '@/modules/dashboard/enterprise-analytics-dashboard';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AnalyticsPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Finance & Analytics">
      <EnterpriseAnalyticsDashboard />
    </DashboardShell>
  );
}
