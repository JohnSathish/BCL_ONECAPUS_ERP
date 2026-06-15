'use client';

import { AdmissionFeeStructurePanel } from '@/components/fees-module/admission-fee-structure-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Admission Fee Structure">
      <AdmissionFeeStructurePanel />
    </DashboardShell>
  );
}
