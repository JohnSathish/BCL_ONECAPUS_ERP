import { Injectable } from '@nestjs/common';
import { MoodleSettingsService } from './moodle-settings.service';
import { MoodleSyncQueueService } from './moodle-sync-queue.service';
import type { MoodleSyncType } from './moodle-sync.service';

/** Enqueues Moodle lifecycle work onto BullMQ (non-blocking for HTTP handlers). */
@Injectable()
export class MoodleHookService {
  constructor(
    private readonly settings: MoodleSettingsService,
    private readonly queue: MoodleSyncQueueService,
  ) {}

  private async enabled(tenantId: string) {
    return this.settings.isSyncEnabled(tenantId);
  }

  async onStudentEnrolled(
    tenantId: string,
    studentId: string,
    semesterSequence = 1,
  ) {
    if (!(await this.enabled(tenantId))) return;
    return this.queue.enqueueStudentEnrolled(
      tenantId,
      studentId,
      semesterSequence,
    );
  }

  async onStaffCreated(tenantId: string, staffProfileId: string) {
    if (!(await this.enabled(tenantId))) return;
    return this.queue.enqueueStaffCreated(tenantId, staffProfileId);
  }

  async onRegistrationApproved(
    tenantId: string,
    studentId: string,
    semesterSequence: number,
  ) {
    if (!(await this.enabled(tenantId))) return;
    return this.queue.enqueueRegistrationApproved(
      tenantId,
      studentId,
      semesterSequence,
    );
  }

  async onPromotionApplied(
    tenantId: string,
    studentId: string,
    toSemesterSequence: number,
  ) {
    if (!(await this.enabled(tenantId))) return;
    return this.queue.enqueuePromotionApplied(
      tenantId,
      studentId,
      toSemesterSequence,
    );
  }

  async onWorkspaceProvisioned(tenantId: string, workspaceId: string) {
    if (!(await this.enabled(tenantId))) return;
    return this.queue.enqueueWorkspaceProvisioned(tenantId, workspaceId);
  }

  async enqueueManualSync(
    tenantId: string,
    syncType: MoodleSyncType = 'ALL',
    source: 'manual' | 'retry' = 'manual',
  ) {
    if (!(await this.enabled(tenantId))) {
      return {
        skipped: true,
        reason: 'Sync disabled or Moodle not configured',
      };
    }
    return this.queue.enqueueSyncRun(tenantId, syncType, source);
  }
}
