/**
 * Canonical registry for jobs on the shared BullMQ `exports` queue.
 * Only ExportsQueueProcessor (@Processor('exports')) may consume these — never add
 * another @Processor('exports') class (see scripts/ci/check-exports-queue-worker.mjs).
 */
export const EXPORTS_QUEUE_JOB_NAMES = [
  'student-import-commit',
  'student-bulk-update-apply',
  'student-photo-bulk-apply',
  'staff-bulk-update-apply',
  'course-import-validate',
  'course-import-commit',
  'fee-receipt-pdf',
  'generate',
  'staff-biometric-sync-device',
  'staff-biometric-push-users',
  'staff-attendance-process-batch',
  'staff-attendance-recompute-range',
  'staff-attendance-reprocess-run',
  'staff-attendance-daily-summary',
  'staff-attendance-monthly-summary',
  'staff-biometric-retry-failed-sync',
  'staff-biometric-health-check-device',
  'staff-biometric-health-check-all',
] as const;

export type ExportsQueueJobName = (typeof EXPORTS_QUEUE_JOB_NAMES)[number];

/** Jobs executed by the Nest API container (not the standalone worker process). */
export const NEST_API_EXPORT_JOB_NAMES = new Set<string>([
  'student-import-commit',
  'student-bulk-update-apply',
  'student-photo-bulk-apply',
  'staff-bulk-update-apply',
  'course-import-validate',
  'course-import-commit',
  'generate',
  'staff-biometric-sync-device',
  'staff-biometric-push-users',
  'staff-attendance-process-batch',
  'staff-attendance-recompute-range',
  'staff-attendance-reprocess-run',
  'staff-attendance-daily-summary',
  'staff-attendance-monthly-summary',
  'staff-biometric-retry-failed-sync',
  'staff-biometric-health-check-device',
  'staff-biometric-health-check-all',
]);

/** Jobs executed by the standalone worker container (heavy PDF generation). */
export const WORKER_OWNED_EXPORT_JOB_NAMES = new Set<string>([
  'fee-receipt-pdf',
]);

export function isNestApiExportJob(name: string) {
  return (
    NEST_API_EXPORT_JOB_NAMES.has(name) || name.startsWith('course-import-')
  );
}

export function isWorkerOwnedExportJob(name: string) {
  return WORKER_OWNED_EXPORT_JOB_NAMES.has(name);
}
