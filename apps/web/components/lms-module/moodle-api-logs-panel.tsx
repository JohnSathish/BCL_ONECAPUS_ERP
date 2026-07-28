'use client';

import { useQuery } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { fetchMoodleApiLogs } from '@/services/moodle';

export function MoodleApiLogsPanel() {
  const logs = useQuery({ queryKey: ['moodle', 'api-logs'], queryFn: fetchMoodleApiLogs });

  return (
    <CompactCard>
      <CompactCardHeader
        title="Moodle API logs"
        description="Recent web service calls (tokens redacted)."
      />
      <CompactCardBody className="space-y-2 max-h-[70vh] overflow-y-auto">
        {(logs.data ?? []).map(
          (log: {
            id: string;
            wsFunction: string;
            status: string;
            durationMs?: number | null;
            errorMessage?: string | null;
            createdAt: string;
          }) => (
            <div key={log.id} className="rounded border px-3 py-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-mono text-xs">{log.wsFunction}</span>
                <span>{log.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(log.createdAt).toLocaleString()}
                {log.durationMs != null ? ` · ${log.durationMs}ms` : ''}
              </p>
              {log.errorMessage ? (
                <p className="text-xs text-destructive">{log.errorMessage}</p>
              ) : null}
            </div>
          ),
        )}
        {!logs.data?.length ? (
          <p className="text-sm text-muted-foreground">No API calls logged yet.</p>
        ) : null}
      </CompactCardBody>
    </CompactCard>
  );
}
