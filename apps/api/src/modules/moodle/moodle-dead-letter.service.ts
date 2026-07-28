import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Job } from 'bullmq';
import { PrismaService } from '../../database/prisma.service';
import { MoodleEventsService } from './moodle-events.service';
import type { MoodleSyncJobName } from './moodle-sync.jobs';

@Injectable()
export class MoodleDeadLetterService {
  private readonly logger = new Logger(MoodleDeadLetterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: MoodleEventsService,
  ) {}

  async record(job: Job, error: Error) {
    const tenantId = String(job.data?.tenantId ?? '');
    if (!tenantId) {
      this.logger.error(`Moodle DLQ job ${job.id} missing tenantId`);
      return;
    }

    const syncType = `DLQ:${job.name}`;
    const metadata: Prisma.InputJsonValue = {
      jobId: job.id,
      jobName: job.name,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? 1,
      payload: job.data as Prisma.InputJsonValue,
    };

    await this.prisma.moodleSyncLog.create({
      data: {
        tenantId,
        syncType,
        status: 'FAILED',
        finishedAt: new Date(),
        failureCount: 1,
        errorMessage: error.message.slice(0, 4000),
        metadata,
      },
    });

    const entityId =
      (job.data?.studentId as string | undefined) ??
      (job.data?.staffProfileId as string | undefined) ??
      (job.data?.workspaceId as string | undefined);

    await this.events.emit({
      tenantId,
      entityType: 'JOB',
      entityId,
      action: 'DLQ',
      metadata: {
        jobName: job.name as MoodleSyncJobName,
        jobId: job.id,
        error: error.message,
      },
    });

    this.logger.error(
      `Moodle job dead-lettered tenant=${tenantId} job=${job.name} id=${job.id}: ${error.message}`,
    );
  }
}
