import { DashboardShell } from '@/components/layout/dashboard-shell';
import { IdCardTemplateGallery } from '@/components/id-cards-module/id-card-template-gallery';

export default function IdCardTemplatesPage() {
  return (
    <DashboardShell role="admin" title="ID Card Template Gallery">
      <IdCardTemplateGallery />
    </DashboardShell>
  );
}
