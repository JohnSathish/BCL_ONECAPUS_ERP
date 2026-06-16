import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { disconnectPrisma, generateFeeReceiptPdf } from './jobs/fee-receipt-pdf';
import { runBackupJob, runRestoreJob } from './jobs/backup/backup-run';
import { backupDb } from './jobs/backup/shared';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

const processJobs = process.env.PROCESS_BACKGROUND_JOBS ?? 'worker';

const exportsWorker = new Worker(
  'exports',
  async (job) => {
    if (job.name === 'fee-receipt-pdf') {
      if (processJobs !== 'worker') {
        return { skipped: true, reason: 'API process handles fee-receipt-pdf' };
      }
      const { tenantId, receiptId } = job.data as { tenantId: string; receiptId: string };
      console.log('[worker] fee-receipt-pdf', job.id, receiptId);
      return generateFeeReceiptPdf(tenantId, receiptId);
    }
    if (job.name.startsWith('course-import-')) {
      return;
    }
    console.log('[exports]', job.id, job.name, job.data);
  },
  { connection },
);

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

exportsWorker.on('failed', (job, err) => {
  console.error('exports job failed', job?.id, err);
});

backupsWorker.on('failed', (job, err) => {
  console.error('backups job failed', job?.id, err);
});

console.log(`NEP ERP worker started (PROCESS_BACKGROUND_JOBS=${processJobs})`);

process.on('SIGTERM', async () => {
  await exportsWorker.close();
  await backupsWorker.close();
  await disconnectPrisma();
  await backupDb()
    .$disconnect()
    .catch(() => undefined);
  process.exit(0);
});
