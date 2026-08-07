import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('notifications') private readonly notifications: Queue,
    @InjectQueue('exports') private readonly exports: Queue,
    @InjectQueue('backups') private readonly backups: Queue,
  ) {}

  async enqueueNotification(payload: Record<string, unknown>) {
    const jobType = String(payload.jobType ?? '');
    const isCampaignJob = jobType.startsWith('campaign-');
    const campaignId = payload.campaignId ? String(payload.campaignId) : '';
    // Collapse duplicate prepare/deliver enqueues (stall retries) for the same campaign.
    let jobId: string | undefined;
    if (isCampaignJob && campaignId) {
      if (
        jobType === 'campaign-prepare-and-deliver' ||
        jobType === 'campaign-deliver'
      ) {
        jobId = `${jobType}:${campaignId}`;
      } else if (jobType === 'campaign-deliver-batch') {
        jobId = `${jobType}:${campaignId}:${payload.offset ?? 0}:${payload.limit ?? 40}`;
      }
      // campaign-deliver-retry stays unique per call so operators can requeue failures.
    }
    try {
      return await this.notifications.add('send', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        ...(jobId ? { jobId } : {}),
        ...(isCampaignJob
          ? {
              // College-wide prepares can take minutes; avoid stalled/lock loss.
              removeOnComplete: 100,
              removeOnFail: 200,
            }
          : {}),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Same campaign already queued/active — treat as success (at-least-once enqueue).
      if (jobId && /already exists|duplicat/i.test(message)) {
        return null;
      }
      throw error;
    }
  }

  async getNotificationQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.notifications.getWaitingCount(),
      this.notifications.getActiveCount(),
      this.notifications.getCompletedCount(),
      this.notifications.getFailedCount(),
      this.notifications.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  async getExportsQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.exports.getWaitingCount(),
      this.exports.getActiveCount(),
      this.exports.getCompletedCount(),
      this.exports.getFailedCount(),
      this.exports.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  enqueueExport(payload: Record<string, unknown>) {
    return this.exports.add('generate', payload);
  }

  enqueueCourseImportValidate(payload: { tenantId: string; batchId: string }) {
    return this.exports.add('course-import-validate', payload, {
      attempts: 2,
    });
  }

  enqueueCourseImportCommit(payload: {
    tenantId: string;
    userId: string;
    batchId: string;
    mode: string;
  }) {
    return this.exports.add('course-import-commit', payload, {
      attempts: 2,
    });
  }

  enqueueStudentImportCommit(payload: {
    tenantId: string;
    userId: string;
    batchId: string;
    mode: string;
    importMode?: string;
  }) {
    return this.exports.add('student-import-commit', payload, {
      attempts: 2,
      // BullMQ: lower number = higher priority (jump ahead of routine biometric jobs).
      priority: -100,
    });
  }

  enqueueStudentBulkUpdateApply(payload: {
    tenantId: string;
    batchId: string;
    userId: string;
    ipAddress?: string;
    forceApply?: boolean;
  }) {
    return this.exports.add('student-bulk-update-apply', payload, {
      attempts: 2,
    });
  }

  enqueueStaffBulkUpdateApply(payload: {
    tenantId: string;
    batchId: string;
    userId: string;
    ipAddress?: string;
    forceApply?: boolean;
  }) {
    return this.exports.add('staff-bulk-update-apply', payload, {
      attempts: 2,
    });
  }

  enqueueStaffBiometricSyncDevice(payload: {
    tenantId: string;
    deviceId: string;
    batchId: string;
    userId: string;
    mode?: string;
    from?: string;
    to?: string;
  }) {
    return this.exports.add('staff-biometric-sync-device', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  enqueueStaffBiometricPushUsers(payload: {
    tenantId: string;
    deviceId: string;
    userId: string;
    staffProfileIds?: string[];
    departmentId?: string;
  }) {
    return this.exports.add('staff-biometric-push-users', payload, {
      attempts: 2,
    });
  }

  enqueueStaffAttendanceProcessBatch(payload: {
    tenantId: string;
    batchId?: string;
  }) {
    return this.exports.add('staff-attendance-process-batch', payload, {
      attempts: 2,
    });
  }

  enqueueStaffAttendanceRecomputeRange(payload: {
    tenantId: string;
    from: string;
    to: string;
    staffProfileId?: string;
  }) {
    return this.exports.add('staff-attendance-recompute-range', payload, {
      attempts: 2,
    });
  }

  enqueueStaffAttendanceReprocessRun(payload: {
    tenantId: string;
    runId: string;
  }) {
    return this.exports.add('staff-attendance-reprocess-run', payload, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    });
  }

  enqueueStaffAttendanceDailySummary(payload: {
    tenantId: string;
    date?: string;
  }) {
    return this.exports.add('staff-attendance-daily-summary', payload, {
      attempts: 2,
    });
  }

  enqueueStaffAttendanceMonthlySummary(payload: {
    tenantId: string;
    month?: string;
  }) {
    return this.exports.add('staff-attendance-monthly-summary', payload, {
      attempts: 2,
    });
  }

  enqueueStaffBiometricRetryFailedSync(payload: { tenantId: string }) {
    return this.exports.add('staff-biometric-retry-failed-sync', payload, {
      attempts: 1,
    });
  }

  enqueueStaffBiometricHealthCheckDevice(payload: {
    tenantId: string;
    deviceId: string;
  }) {
    return this.exports.add('staff-biometric-health-check-device', payload, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    });
  }

  enqueueStaffBiometricHealthCheckAll(payload: { tenantId: string }) {
    return this.exports.add('staff-biometric-health-check-all', payload, {
      attempts: 1,
    });
  }

  enqueueStudentPhotoBulkApply(payload: {
    tenantId: string;
    batchId: string;
    userId: string;
    conflictStrategy?: string;
  }) {
    return this.exports.add('student-photo-bulk-apply', payload, {
      attempts: 2,
    });
  }

  enqueueFeeReceiptPdf(payload: { tenantId: string; receiptId: string }) {
    return this.exports.add('fee-receipt-pdf', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  enqueueBackupRun(payload: {
    runId: string;
    type: string;
    scope?: string;
    tenantId?: string;
  }) {
    return this.backups.add('backup-run', payload, {
      attempts: 2,
      removeOnComplete: 50,
      removeOnFail: 100,
    });
  }

  enqueueBackupRestore(payload: {
    runId: string;
    mode: string;
    safetyRunId: string;
    userId?: string;
    delayMs?: number;
    waitForSafety?: boolean;
  }) {
    return this.backups.add('backup-restore', payload, {
      attempts: 10,
      backoff: { type: 'fixed', delay: 30_000 },
      delay: payload.delayMs ?? 30_000,
    });
  }

  enqueueBackupCloudSync(payload: { runId: string }) {
    return this.backups.add('backup-cloud-sync', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 10_000 },
    });
  }
}
