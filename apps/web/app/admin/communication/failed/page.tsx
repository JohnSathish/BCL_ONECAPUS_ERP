import { DeliveryLogsTable } from '@/components/communication/logs/delivery-logs-table';

export default function FailedPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Failed Messages</h1>
      <DeliveryLogsTable defaultStatus="FAILED" showRetry />
    </div>
  );
}
