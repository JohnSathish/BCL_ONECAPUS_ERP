import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InventoryRestockSection } from '@/components/inventory/inventory-workspace-phase3';

export default function InventoryRestockPage() {
  return (
    <DashboardShell role="admin" title="Inventory — Restock Suggestions">
      <InventoryRestockSection />
    </DashboardShell>
  );
}
