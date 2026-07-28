'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { fetchMoodleSyncDashboard, runMoodleSync } from '@/services/moodle';
import { MoodleFailedJobsPanel } from '@/components/lms-module/moodle-failed-jobs-panel';

export function MoodleSyncDashboardPanel() {
  const qc = useQueryClient();
  const dashboard = useQuery({
    queryKey: ['moodle', 'sync-dashboard'],
    queryFn: fetchMoodleSyncDashboard,
  });

  const syncMut = useMutation({
    mutationFn: (syncType?: string) => runMoodleSync(syncType),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['moodle'] }),
  });

  const d = dashboard.data;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <CompactCard>
          <CompactCardBody className="p-4">
            <p className="text-xs text-muted-foreground">Courses</p>
            <p className="text-2xl font-semibold">{d?.counts.courses ?? 0}</p>
          </CompactCardBody>
        </CompactCard>
        <CompactCard>
          <CompactCardBody className="p-4">
            <p className="text-xs text-muted-foreground">Users</p>
            <p className="text-2xl font-semibold">{d?.counts.users ?? 0}</p>
          </CompactCardBody>
        </CompactCard>
        <CompactCard>
          <CompactCardBody className="p-4">
            <p className="text-xs text-muted-foreground">Enrollments</p>
            <p className="text-2xl font-semibold">{d?.counts.enrollments ?? 0}</p>
          </CompactCardBody>
        </CompactCard>
        <CompactCard>
          <CompactCardBody className="p-4">
            <p className="text-xs text-muted-foreground">Pending events</p>
            <p className="text-2xl font-semibold">{d?.pendingEvents ?? 0}</p>
          </CompactCardBody>
        </CompactCard>
        <CompactCard>
          <CompactCardBody className="p-4">
            <p className="text-xs text-muted-foreground">Dead letters</p>
            <p className="text-2xl font-semibold">{d?.deadLetterCount ?? 0}</p>
          </CompactCardBody>
        </CompactCard>
      </div>

      {d?.queueStats ? (
        <CompactCard>
          <CompactCardHeader title="Queue status" description="BullMQ moodle-sync worker" />
          <CompactCardBody className="flex flex-wrap gap-4 text-sm">
            <span>Waiting: {d.queueStats.waiting}</span>
            <span>Active: {d.queueStats.active}</span>
            <span>Delayed: {d.queueStats.delayed}</span>
            <span>Failed (Redis): {d.queueStats.failed}</span>
          </CompactCardBody>
        </CompactCard>
      ) : null}

      <CompactCard>
        <CompactCardHeader
          title="Manual sync"
          description="Run full or partial sync jobs. Heavy jobs also run on a 5-minute cron."
        />
        <CompactCardBody className="flex flex-wrap gap-2">
          {['ALL', 'USERS', 'COURSES', 'ENROLLMENTS', 'ASSIGNMENTS', 'GRADES'].map((type) => (
            <Button
              key={type}
              type="button"
              size="sm"
              variant="outline"
              disabled={syncMut.isPending}
              onClick={() => syncMut.mutate(type)}
            >
              Sync {type}
            </Button>
          ))}
        </CompactCardBody>
      </CompactCard>

      <MoodleFailedJobsPanel />

      <CompactCard>
        <CompactCardHeader title="Recent sync logs" />
        <CompactCardBody className="space-y-2">
          {(d?.lastLogs ?? []).map((log) => (
            <div key={log.id} className="rounded border px-3 py-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{log.syncType}</span>
                <span className="text-muted-foreground">{log.status}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(log.startedAt).toLocaleString()}
                {log.failureCount ? ` · failures ${log.failureCount}` : ''}
              </p>
              {log.errorMessage ? (
                <p className="mt-1 text-xs text-destructive">{log.errorMessage}</p>
              ) : null}
            </div>
          ))}
          {!d?.lastLogs?.length ? (
            <p className="text-sm text-muted-foreground">No sync runs yet.</p>
          ) : null}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}
