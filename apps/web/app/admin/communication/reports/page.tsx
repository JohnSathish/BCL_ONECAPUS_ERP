'use client';

import { useState } from 'react';
import { DeliveryLogsTable } from '@/components/communication/logs/delivery-logs-table';
import { Button } from '@/components/ui/button';
import { exportCommunicationReport } from '@/services/communication';

export default function ReportsPage() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const csv = await exportCommunicationReport({});
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'communication-report.csv';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Delivery Reports</h1>
        <Button onClick={() => void handleExport()} disabled={exporting}>
          Export CSV
        </Button>
      </div>
      <DeliveryLogsTable />
    </div>
  );
}
