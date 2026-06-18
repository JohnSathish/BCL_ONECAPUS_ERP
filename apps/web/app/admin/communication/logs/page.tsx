import { DeliveryLogsTable } from '@/components/communication/logs/delivery-logs-table';

export default function LogsPage() {
  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Communication Logs</h1>
      <DeliveryLogsTable />
    </div>
  );
}
