'use client';

import { AccountsVoucherForm } from '@/components/accounts-module/accounts-voucher-form';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useRequireAuth } from '@/hooks/use-auth';

export default function Page() {
  const session = useRequireAuth();
  if (!session) return null;
  return (
    <DashboardShell role="admin" title="New Voucher" pageHeader={false}>
      <AccountsVoucherForm />
    </DashboardShell>
  );
}
