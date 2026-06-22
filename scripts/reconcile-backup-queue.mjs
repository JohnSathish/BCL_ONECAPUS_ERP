#!/usr/bin/env node
/**
 * Re-enqueue backup runs stuck in QUEUED (no JWT required).
 * Run on VPS inside the API container:
 *   docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile local-db \
 *     exec api node scripts/reconcile-backup-queue.mjs
 */
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const staleBefore = new Date(Date.now() - 30_000);
const prisma = new PrismaClient();
const connection = new IORedis(process.env.REDIS_URL ?? 'redis://redis:6379', {
  maxRetriesPerRequest: null,
});
const backups = new Queue('backups', { connection });

try {
  const stuck = await prisma.backupRun.findMany({
    where: { status: 'QUEUED', createdAt: { lt: staleBefore } },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });

  if (stuck.length === 0) {
    console.log('No stuck QUEUED backup runs (older than 30s).');
    process.exit(0);
  }

  for (const run of stuck) {
    const job = await backups.add(
      'backup-run',
      {
        runId: run.id,
        type: run.type,
        scope: run.scope,
        tenantId: run.tenantId ?? undefined,
      },
      { attempts: 2, removeOnComplete: 50, removeOnFail: 100 },
    );
    await prisma.backupRun.update({
      where: { id: run.id },
      data: { jobId: String(job.id), errorMessage: null },
    });
    console.log(`Requeued run ${run.id} → job ${job.id}`);
  }

  console.log(`Done. Requeued ${stuck.length} run(s).`);
} finally {
  await backups.close();
  await connection.quit();
  await prisma.$disconnect();
}
