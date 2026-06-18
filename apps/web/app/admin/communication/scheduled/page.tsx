import { CampaignsManager } from '@/components/communication/campaigns/campaigns-manager';

export default function ScheduledPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Scheduled Messages</h1>
      <CampaignsManager statusFilter="SCHEDULED" />
    </div>
  );
}
