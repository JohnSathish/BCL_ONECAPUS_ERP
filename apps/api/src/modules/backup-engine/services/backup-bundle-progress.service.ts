import { Injectable } from '@nestjs/common';

export type BundlePackPhase =
  | 'preparing'
  | 'compressing'
  | 'finalising'
  | 'ready'
  | 'failed'
  | 'cancelled';

export type BundlePackSnapshot = {
  phase: BundlePackPhase | 'idle';
  bytesProcessed: number;
  bytesTotal: number | null;
  error: string | null;
};

type BundleJob = {
  phase: BundlePackPhase;
  bytesProcessed: number;
  bytesTotal: number | null;
  error: string | null;
  cancelled: boolean;
};

/**
 * In-memory progress for the API process that is packing a ZIP.
 * Byte counts are written by the packer. Nothing here estimates a percentage.
 */
@Injectable()
export class BackupBundleProgressService {
  private readonly jobs = new Map<string, BundleJob>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  /** Cancels a pack that has not created its job yet. Consumed by the next begin. */
  private readonly pendingCancel = new Set<string>();

  begin(runId: string): BundleJob {
    const existing = this.jobs.get(runId);
    if (
      existing &&
      (existing.phase === 'preparing' ||
        existing.phase === 'compressing' ||
        existing.phase === 'finalising')
    ) {
      return existing;
    }
    const job: BundleJob = {
      phase: 'preparing',
      bytesProcessed: 0,
      bytesTotal: null,
      error: null,
      cancelled: false,
    };
    if (this.pendingCancel.delete(runId)) {
      job.cancelled = true;
      job.phase = 'cancelled';
    }
    this.jobs.set(runId, job);
    return job;
  }

  apply(
    job: BundleJob,
    event: {
      phase: 'preparing' | 'compressing' | 'finalising';
      bytesProcessed: number;
      bytesTotal: number | null;
    },
  ) {
    if (job.cancelled) return;
    job.phase = event.phase;
    job.bytesProcessed = event.bytesProcessed;
    job.bytesTotal = event.bytesTotal;
  }

  mark(
    job: BundleJob,
    event: {
      phase: BundlePackPhase;
      bytesProcessed: number;
      bytesTotal: number | null;
      error?: string | null;
    },
  ) {
    job.phase = event.phase;
    job.bytesProcessed = event.bytesProcessed;
    job.bytesTotal = event.bytesTotal;
    if (event.error !== undefined) job.error = event.error;
  }

  noteReady(runId: string, size: number) {
    const current = this.jobs.get(runId);
    if (
      current &&
      (current.phase === 'preparing' ||
        current.phase === 'compressing' ||
        current.phase === 'finalising')
    ) {
      return;
    }
    this.jobs.set(runId, {
      phase: 'ready',
      bytesProcessed: size,
      bytesTotal: size,
      error: null,
      cancelled: false,
    });
  }

  snapshot(runId: string): BundlePackSnapshot {
    const job = this.jobs.get(runId);
    if (!job) {
      return {
        phase: 'idle',
        bytesProcessed: 0,
        bytesTotal: null,
        error: null,
      };
    }
    return {
      phase: job.phase,
      bytesProcessed: job.bytesProcessed,
      bytesTotal: job.bytesTotal,
      error: job.error,
    };
  }

  /** Stop an in-progress pack. A finished ZIP is left on disk. */
  cancel(runId: string) {
    const job = this.jobs.get(runId);
    if (job?.phase === 'ready' || job?.phase === 'failed') {
      return { cancelled: false, phase: job.phase };
    }
    this.pendingCancel.add(runId);
    if (!job) return { cancelled: true };
    job.cancelled = true;
    job.phase = 'cancelled';
    return { cancelled: true };
  }

  once<T>(runId: string, start: () => Promise<T>): Promise<T> {
    const current = this.inflight.get(runId) as Promise<T> | undefined;
    if (current) return current;
    const task = start().finally(() => {
      this.inflight.delete(runId);
    });
    this.inflight.set(runId, task);
    return task;
  }
}
