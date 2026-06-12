import { DashboardShell } from '@/components/layout/dashboard-shell';
import { InventoryRequisitionsSection } from '@/components/inventory/inventory-workspace-phase3';

export default function InventoryRequisitionsPage() {
  return (
    <DashboardShell role="admin" title="Inventory — Requisitions">
      <InventoryRequisitionsSection />
    </DashboardShell>
  );
}
