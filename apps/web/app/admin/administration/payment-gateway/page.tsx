'use client';

import { PaymentGatewayWorkspace } from '@/components/payment-gateway/payment-gateway-workspace';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function PaymentGatewayManagementPage() {
  const session = useRequireAuth();
  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Payment Gateway Management" pageHeader={false}>
      <PaymentGatewayWorkspace />
    </DashboardShell>
  );
}
