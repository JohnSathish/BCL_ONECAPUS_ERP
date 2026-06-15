'use client';

import { ExternalPaymentEntryPanel } from '@/components/fees-module/external-payment-entry-panel';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function ExternalPaymentsPage() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="Finance / External Payment Entry">
      <ExternalPaymentEntryPanel />
    </DashboardShell>
  );
}
