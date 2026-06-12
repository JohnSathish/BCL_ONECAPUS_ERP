import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InventoryWorkspace } from '@/components/inventory/inventory-workspace';

export default function InventoryItemsPage() {
  return (
    <DashboardShell role="admin" title="Inventory — Items">
      <InventoryWorkspace page="items" />
    </DashboardShell>
  );
}
