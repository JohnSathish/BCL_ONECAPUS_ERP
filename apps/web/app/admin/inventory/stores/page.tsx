import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InventoryWorkspace } from '@/components/inventory/inventory-workspace';

export default function InventoryStoresPage() {
  return (
    <DashboardShell role="admin" title="Inventory — Stores">
      <InventoryWorkspace page="stores" />
    </DashboardShell>
  );
}
