import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InventoryWorkspace } from '@/components/inventory/inventory-workspace';

export default function InventoryDashboardPage() {
  return (
    <DashboardShell role="admin" title="Inventory">
      <InventoryWorkspace page="dashboard" />
    </DashboardShell>
  );
}
