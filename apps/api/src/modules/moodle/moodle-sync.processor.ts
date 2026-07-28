import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job } from 'bullmq';
import { MoodleDeadLetterService } from './moodle-dead-letter.service';
import { MoodleSyncJobHandler } from './moodle-sync-job.handler';
import type { MoodleSyncJobName } from './moodle-sync.jobs';

@Injectable()
@Processor('moodle-sync', {
  lockDuration: 300_000,
  stalledInterval: 60_000,
  maxStalledCount: 2,
  concurrency: 2,
})
export class MoodleSyncProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(MoodleSyncProcessor.name);

  constructor(
    private readonly handler: MoodleSyncJobHandler,
    private readonly deadLetter: MoodleDeadLetterService,
  ) {
    super();
  }

  onModuleInit() {
    this.logger.log('Registered Moodle sync queue worker');
  }

  async process(job: Job<Record<string, unknown>>): Promise<unknown> {
    this.logger.debug(`Processing Moodle job ${job.name} #${job.id}`);
    return this.handler.handle(job.name as MoodleSyncJobName, job.data);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      this.logger.warn(
        `Moodle job retry ${job.name} #${job.id} attempt ${job.attemptsMade}/${maxAttempts}: ${error.message}`,
      );
      return;
    }
    await this.deadLetter.record(job, error);
  }
}
