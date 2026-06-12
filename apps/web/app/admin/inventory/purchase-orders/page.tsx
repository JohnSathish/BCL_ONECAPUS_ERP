import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InventoryPurchaseOrdersSection } from '@/components/inventory/inventory-workspace-phase2';

export default function InventoryPurchaseOrdersPage() {
  return (
    <DashboardShell role="admin" title="Inventory — Purchase Orders">
      <InventoryPurchaseOrdersSection />
    </DashboardShell>
  );
}
