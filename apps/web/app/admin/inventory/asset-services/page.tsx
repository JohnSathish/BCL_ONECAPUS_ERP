import { DashboardShell } from '@/components/layout/dashboard-shell';
import { AssetServicesWorkspace } from '@/components/enterprise/enterprise-module-workspaces';

export default function AdminInventoryAssetServicesPage() {
  return (
    <DashboardShell role="admin" title="Inventory — Asset Services">
      <AssetServicesWorkspace />
    </DashboardShell>
  );
}
