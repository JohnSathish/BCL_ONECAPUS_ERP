import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InventoryWorkspace } from '@/components/inventory/inventory-workspace';

export default function InventoryTransactionsPage() {
  return (
    <DashboardShell role="admin" title="Inventory — Issue & Return">
      <InventoryWorkspace page="transactions" />
    </DashboardShell>
  );
}
