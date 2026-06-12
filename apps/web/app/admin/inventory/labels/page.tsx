import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InventoryLabelsSection } from '@/components/inventory/inventory-workspace-phase2';

export default function InventoryLabelsPage() {
  return (
    <DashboardShell role="admin" title="Inventory — Barcode Labels">
      <InventoryLabelsSection />
    </DashboardShell>
  );
}
