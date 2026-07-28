'use client';

import { useQuery } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import { fetchMoodleSyncDashboard } from '@/services/moodle';

async function downloadReport() {
  const { data } = await api.get('/v1/moodle/reports/export', { responseType: 'blob' });
  const blob = new Blob([data as BlobPart], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'moodle-sync-report.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function MoodleReportsPanel() {
  const dashboard = useQuery({
    queryKey: ['moodle', 'sync-dashboard'],
    queryFn: fetchMoodleSyncDashboard,
  });
  const d = dashboard.data;

  return (
    <div className="space-y-4">
      <CompactCard>
        <CompactCardHeader
          title="Moodle integration report"
          description="Export sync counts and connection health for audits."
        />
        <CompactCardBody className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Last sync:{' '}
            {d?.settings.lastSyncAt ? new Date(d.settings.lastSyncAt).toLocaleString() : '—'}
          </p>
          <Button type="button" size="sm" onClick={() => downloadReport()}>
            Download CSV report
          </Button>
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}
