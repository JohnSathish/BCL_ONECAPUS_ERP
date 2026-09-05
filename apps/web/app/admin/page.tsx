'use client';

import { OperationsCommandCenter } from '@/components/dashboard/operations-command-center';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { SchoolErpDashboard } from '@/components/school-erp/school-erp-dashboard';
import { useRequireAuth } from '@/hooks/use-auth';
import { isSchoolErpSession } from '@/lib/school-admissions-branding';

export default function AdminDashboardPage() {
  const session = useRequireAuth();
  if (!session) return null;

  if (
    isSchoolErpSession({
      tenantSlug: session.user.tenantSlug,
      hostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
    })
  ) {
    return <SchoolErpDashboard />;
  }

  const userName = session.user.email.split('@')[0] ?? 'Admin';

  return (
    <DashboardShell role="admin">
      <OperationsCommandCenter userName={userName} />
    </DashboardShell>
  );
}
