import { DelayedError, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { disconnectPrisma, generateFeeReceiptPdf } from './jobs/fee-receipt-pdf';
import { runBackupJob, runRestoreJob } from './jobs/backup/backup-run';
import { backupDb } from './jobs/backup/shared';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

/** Default `api` so local dev Nest processors handle export jobs (student import, photo bulk, etc.). */
const processJobs = process.env.PROCESS_BACKGROUND_JOBS ?? 'api';

function isNestApiExportJob(name: string) {
  if (name.startsWith('course-import-')) return true;
  return [
    'student-import-commit',
    'student-photo-bulk-apply',
    'student-bulk-update-apply',
    'staff-bulk-update-apply',
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
  ].includes(name);
}

async function yieldToNestApi(job: Job) {
  await job.moveToDelayed(Date.now() + 2000, job.token);
  throw new DelayedError('Handled by Nest API exports processor');
}

/** Only subscribe when this process owns fee-receipt jobs; Nest API handles the rest. */
const exportsWorker =
  processJobs === 'worker'
    ? new Worker(
        'exports',
        async (job) => {
          if (job.name === 'fee-receipt-pdf') {
            const { tenantId, receiptId } = job.data as {
              tenantId: string;
              receiptId: string;
            };
            console.log('[worker] fee-receipt-pdf', job.id, receiptId);
            return generateFeeReceiptPdf(tenantId, receiptId);
          }
          if (isNestApiExportJob(job.name)) {
            await yieldToNestApi(job);
          }
          console.warn('[worker] unknown exports job', job.id, job.name);
          await yieldToNestApi(job);
        },
        { connection },
      )
    : null;

const backupsWorker = new Worker(
  'backups',
  async (job) => {
    if (processJobs !== 'worker') {
      return { skipped: true, reason: 'API process handles backup jobs' };
    }
    if (job.name === 'backup-run') {
      const { runId } = job.data as { runId: string };
      console.log('[worker] backup-run', job.id, runId);
      return runBackupJob(runId);
    }
    if (job.name === 'backup-restore') {
      const data = job.data as {
        runId: string;
        mode: string;
        safetyRunId: string;
        waitForSafety?: boolean;
      };
      if (data.waitForSafety) {
        const safety = await backupDb().backupRun.findUnique({
          where: { id: data.safetyRunId },
        });
        if (!safety || safety.status !== 'SUCCESS') {
          throw new Error('Waiting for safety backup to complete');
        }
      }
      console.log('[worker] backup-restore', job.id, data.runId);
      return runRestoreJob(data);
    }
    if (job.name === 'backup-cloud-sync') {
      console.log('[worker] backup-cloud-sync', job.id, job.data);
      return { ok: true, note: 'cloud sync handled via API service in hybrid mode' };
    }
  },
  { connection, concurrency: 1 },
);

if (exportsWorker) {
  exportsWorker.on('failed', (job, err) => {
    if (err instanceof DelayedError) return;
    console.error('exports job failed', job?.id, err);
  });
} else {
  console.log('[worker] exports queue handled by Nest API (PROCESS_BACKGROUND_JOBS!=worker)');
}

backupsWorker.on('failed', (job, err) => {
  console.error('backups job failed', job?.id, err);
});

console.log(`NEP ERP worker started (PROCESS_BACKGROUND_JOBS=${processJobs})`);

process.on('SIGTERM', async () => {
  await exportsWorker?.close();
  await backupsWorker.close();
  await disconnectPrisma();
  await backupDb()
    .$disconnect()
    .catch(() => undefined);
  process.exit(0);
});
