import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardDesignerStudio } from '@/components/id-cards-module/id-card-designer-studio';

export default function IdCardDesignerPage() {
  return (
    <DashboardShell role="admin" title="Card Designer Studio">
      <IdCardDesignerStudio />
    </DashboardShell>
  );
}
