import { InjectQueue } from '@nestjs/bullmq';
import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import type { MoodleSyncType } from './moodle-sync.service';
import {
  MOODLE_SYNC_JOB,
  MOODLE_SYNC_QUEUE_OPTS,
  type MoodleSyncJobName,
} from './moodle-sync.jobs';

@Injectable()
export class MoodleSyncQueueService {
  private readonly logger = new Logger(MoodleSyncQueueService.name);

  constructor(@InjectQueue('moodle-sync') private readonly queue: Queue) {}

  private async addJob(
    name: MoodleSyncJobName,
    data: Record<string, unknown>,
    jobId?: string,
  ) {
    try {
      const job = await this.queue.add(name, data, {
        ...MOODLE_SYNC_QUEUE_OPTS,
        ...(jobId ? { jobId } : {}),
      });
      return { queued: true, jobId: job.id, name };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes('job') &&
        msg.toLowerCase().includes('exist')
      ) {
        this.logger.debug(`Moodle job deduped name=${name} id=${jobId}`);
        return { queued: false, deduped: true, name, jobId };
      }
      throw err;
    }
  }

  enqueueStudentEnrolled(
    tenantId: string,
    studentId: string,
    semesterSequence: number,
  ) {
    return this.addJob(
      MOODLE_SYNC_JOB.STUDENT_ENROLLED,
      { tenantId, studentId, semesterSequence },
      `moodle-student-${tenantId}-${studentId}-sem${semesterSequence}`,
    );
  }

  enqueueStaffCreated(tenantId: string, staffProfileId: string) {
    return this.addJob(
      MOODLE_SYNC_JOB.STAFF_CREATED,
      { tenantId, staffProfileId },
      `moodle-staff-${tenantId}-${staffProfileId}`,
    );
  }

  enqueueRegistrationApproved(
    tenantId: string,
    studentId: string,
    semesterSequence: number,
  ) {
    return this.addJob(
      MOODLE_SYNC_JOB.REGISTRATION_APPROVED,
      { tenantId, studentId, semesterSequence },
      `moodle-reg-${tenantId}-${studentId}-sem${semesterSequence}`,
    );
  }

  enqueuePromotionApplied(
    tenantId: string,
    studentId: string,
    toSemesterSequence: number,
  ) {
    return this.addJob(
      MOODLE_SYNC_JOB.PROMOTION_APPLIED,
      { tenantId, studentId, toSemesterSequence },
      `moodle-promo-${tenantId}-${studentId}-sem${toSemesterSequence}`,
    );
  }

  enqueueWorkspaceProvisioned(tenantId: string, workspaceId: string) {
    return this.addJob(
      MOODLE_SYNC_JOB.WORKSPACE_PROVISIONED,
      { tenantId, workspaceId },
      `moodle-ws-${tenantId}-${workspaceId}`,
    );
  }

  enqueueSyncRun(
    tenantId: string,
    syncType: MoodleSyncType = 'ALL',
    source: 'manual' | 'cron' | 'retry' = 'manual',
  ) {
    const stamp =
      source === 'cron' ? `-${Math.floor(Date.now() / 300_000)}` : '';
    return this.addJob(
      MOODLE_SYNC_JOB.SYNC_RUN,
      { tenantId, syncType, source },
      `moodle-sync-${tenantId}-${syncType}${stamp}`,
    );
  }

  enqueueNotificationPoll(tenantId: string) {
    return this.addJob(
      MOODLE_SYNC_JOB.NOTIFICATION_POLL,
      { tenantId },
      `moodle-notify-${tenantId}-${Math.floor(Date.now() / 60_000)}`,
    );
  }

  async getQueueStats() {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);
    return { waiting, active, completed, failed, delayed };
  }

  async listFailedJobs(tenantId: string, limit = 50) {
    const end = Math.max(0, limit - 1);
    const jobs = await this.queue.getFailed(0, end);
    return jobs
      .filter((job) => String(job.data?.tenantId ?? '') === tenantId)
      .map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason ?? null,
        attemptsMade: job.attemptsMade,
        maxAttempts: job.opts.attempts ?? MOODLE_SYNC_QUEUE_OPTS.attempts,
        finishedOn: job.finishedOn ?? null,
        timestamp: job.timestamp,
      }));
  }

  async requeueFailedJob(tenantId: string, jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) throw new NotFoundException('Failed job not found');
    if (String(job.data?.tenantId ?? '') !== tenantId) {
      throw new ForbiddenException('Job belongs to another tenant');
    }
    const state = await job.getState();
    if (state !== 'failed') {
      throw new NotFoundException(`Job is not failed (state=${state})`);
    }
    await job.retry();
    this.logger.log(`Requeued Moodle failed job ${jobId} tenant=${tenantId}`);
    return { requeued: true, jobId, name: job.name };
  }

  async requeueAllFailedJobs(tenantId: string, limit = 100) {
    const jobs = await this.queue.getFailed(0, limit - 1);
    let requeued = 0;
    for (const job of jobs) {
      if (String(job.data?.tenantId ?? '') !== tenantId) continue;
      await job.retry();
      requeued += 1;
    }
    this.logger.log(
      `Requeued ${requeued} Moodle failed jobs tenant=${tenantId}`,
    );
    return { requeued };
  }
}
