import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InventoryVendorsSection } from '@/components/inventory/inventory-workspace-phase2';

export default function InventoryVendorsPage() {
  return (
    <DashboardShell role="admin" title="Inventory — Vendors">
      <InventoryVendorsSection />
    </DashboardShell>
  );
}
