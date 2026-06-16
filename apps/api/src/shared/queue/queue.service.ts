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

  enqueueNotification(payload: Record<string, unknown>) {
    return this.notifications.add('send', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 3000 },
    });
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
