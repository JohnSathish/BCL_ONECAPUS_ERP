import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const batchId = process.argv[2] ?? 'd4fa87cf-10c0-47f0-b993-0f3157b36070';
const prisma = new PrismaClient();

const batch = await prisma.importBatch.findFirst({ where: { id: batchId } });
console.log('\n=== Import batch ===');
console.log(batch);

const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const queue = new Queue('exports', { connection });

const [waiting, active, completed, failed, delayed] = await Promise.all([
  queue.getWaiting(0, 20),
  queue.getActive(0, 20),
  queue.getCompleted(0, 20),
  queue.getFailed(0, 20),
  queue.getDelayed(0, 20),
]);

console.log('\n=== exports queue ===');
console.log(
  'waiting:',
  waiting.length,
  waiting.map((j) => ({ id: j.id, name: j.name, batchId: j.data?.batchId })),
);
console.log(
  'active:',
  active.length,
  active.map((j) => ({ id: j.id, name: j.name, batchId: j.data?.batchId })),
);
console.log(
  'delayed:',
  delayed.length,
  delayed.map((j) => ({ id: j.id, name: j.name })),
);
console.log(
  'failed:',
  failed.length,
  failed.slice(0, 5).map((j) => ({
    id: j.id,
    name: j.name,
    batchId: j.data?.batchId,
    reason: j.failedReason?.slice(0, 200),
  })),
);
console.log(
  'recent completed:',
  completed.slice(0, 5).map((j) => ({
    id: j.id,
    name: j.name,
    batchId: j.data?.batchId,
    finishedOn: j.finishedOn,
  })),
);

const studentImportJobs = [
  ...waiting,
  ...active,
  ...failed,
  ...completed,
].filter((j) => j.name === 'student-import-commit');
console.log('\n=== student-import-commit jobs for batch ===');
for (const j of studentImportJobs.filter((j) => j.data?.batchId === batchId)) {
  console.log({
    id: j.id,
    state: waiting.includes(j)
      ? 'waiting'
      : active.includes(j)
        ? 'active'
        : failed.includes(j)
          ? 'failed'
          : 'completed',
    attemptsMade: j.attemptsMade,
    failedReason: j.failedReason?.slice(0, 300),
    data: j.data,
  });
}

const imported = await prisma.student.count({
  where: { registrationNumber: { startsWith: 'REG2602' } },
});
console.log('\nB.Sc students (REG2602*):', imported);

await queue.close();
await connection.quit();
await prisma.$disconnect();
