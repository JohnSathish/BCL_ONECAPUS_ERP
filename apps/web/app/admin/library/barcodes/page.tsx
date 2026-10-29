import { DashboardShell } from '@/components/layout/dashboard-shell';
import { BarcodeManagementWorkspace } from '@/components/library/barcode-management-workspace';

export default function LibraryBarcodesPage() {
  return (
    <DashboardShell role="admin" title="Barcode Management">
      <BarcodeManagementWorkspace />
    </DashboardShell>
  );
}
