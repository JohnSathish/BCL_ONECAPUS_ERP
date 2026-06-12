import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
  maxRetriesPerRequest: null,
});

// Notification jobs are processed by CommunicationNotificationProcessor in the API process.
// Do NOT register a notifications worker here — it would steal jobs without delivering them.

const exportsWorker = new Worker(
  'exports',
  async (job) => {
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

console.log('NEP ERP worker started (queue: exports only; notifications handled by API)');
