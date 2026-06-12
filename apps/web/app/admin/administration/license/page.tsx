'use client';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { LicenseDetailsPage } from '@/components/licensing/license-details-page';
import { useRequireAuth } from '@/hooks/use-auth';

export default function AdministrationLicensePage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="admin" title="License">
      <LicenseDetailsPage />
    </DashboardShell>
  );
}
