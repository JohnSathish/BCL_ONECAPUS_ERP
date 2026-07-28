'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import {
  fetchMoodleFailedJobs,
  requeueAllMoodleFailedJobs,
  requeueMoodleFailedJob,
  type MoodleFailedJob,
} from '@/services/moodle';

function formatJobSummary(job: MoodleFailedJob) {
  const d = job.data;
  if (d.studentId) return `student ${String(d.studentId).slice(0, 8)}…`;
  if (d.staffProfileId) return `staff ${String(d.staffProfileId).slice(0, 8)}…`;
  if (d.workspaceId) return `workspace ${String(d.workspaceId).slice(0, 8)}…`;
  if (d.syncType) return `sync ${String(d.syncType)}`;
  return '—';
}

export function MoodleFailedJobsPanel() {
  const qc = useQueryClient();
  const failed = useQuery({
    queryKey: ['moodle', 'failed-jobs'],
    queryFn: fetchMoodleFailedJobs,
    refetchInterval: 15_000,
  });

  const requeueOne = useMutation({
    mutationFn: requeueMoodleFailedJob,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['moodle'] }),
  });

  const requeueAll = useMutation({
    mutationFn: requeueAllMoodleFailedJobs,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['moodle'] }),
  });

  const jobs = failed.data ?? [];

  return (
    <CompactCard>
      <CompactCardHeader
        title="Failed queue jobs"
        description="Jobs that exhausted retries in Redis. Requeue to retry immediately."
      />
      <CompactCardBody className="space-y-3 max-h-[50vh] overflow-y-auto">
        {jobs.length ? (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={requeueAll.isPending}
              onClick={() => requeueAll.mutate()}
            >
              Requeue all ({jobs.length})
            </Button>
          </div>
        ) : null}
        {jobs.map((job) => (
          <div key={job.id} className="rounded border px-3 py-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{job.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatJobSummary(job)} · attempts {job.attemptsMade}/{job.maxAttempts}
                  {job.finishedOn ? ` · ${new Date(job.finishedOn).toLocaleString()}` : ''}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={requeueOne.isPending}
                onClick={() => requeueOne.mutate(String(job.id))}
              >
                Requeue
              </Button>
            </div>
            {job.failedReason ? (
              <p className="mt-1 text-xs text-destructive">{job.failedReason}</p>
            ) : null}
          </div>
        ))}
        {!jobs.length ? (
          <p className="text-sm text-muted-foreground">No failed jobs in Redis for this tenant.</p>
        ) : null}
      </CompactCardBody>
    </CompactCard>
  );
}
