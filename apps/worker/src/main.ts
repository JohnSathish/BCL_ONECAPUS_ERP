import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { disconnectPrisma, generateFeeReceiptPdf } from './jobs/fee-receipt-pdf';

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

exportsWorker.on('failed', (job, err) => {
  console.error('exports job failed', job?.id, err);
});

console.log(`NEP ERP worker started (PROCESS_BACKGROUND_JOBS=${processJobs})`);

process.on('SIGTERM', async () => {
  await exportsWorker.close();
  await disconnectPrisma();
  process.exit(0);
});
