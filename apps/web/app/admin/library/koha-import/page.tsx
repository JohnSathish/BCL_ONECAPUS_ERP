import { DashboardShell } from '@/components/layout/dashboard-shell';
import { KohaImportWizard } from '@/components/library/koha-import-wizard';

export default function KohaImportPage() {
  return (
    <DashboardShell role="admin" title="Import Koha Library Catalogue">
      <KohaImportWizard />
    </DashboardShell>
  );
}
