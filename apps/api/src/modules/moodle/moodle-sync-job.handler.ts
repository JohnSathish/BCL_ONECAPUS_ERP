import { Injectable, Logger } from '@nestjs/common';
import { MoodleCourseSyncService } from './moodle-course-sync.service';
import { MoodleEnrolmentSyncService } from './moodle-enrolment-sync.service';
import { MoodleEventsService } from './moodle-events.service';
import { MoodleNotificationService } from './moodle-notification.service';
import {
  MOODLE_SYNC_JOB,
  type MoodleHookPromotionAppliedPayload,
  type MoodleHookRegistrationApprovedPayload,
  type MoodleHookStaffCreatedPayload,
  type MoodleHookStudentEnrolledPayload,
  type MoodleHookWorkspaceProvisionedPayload,
  type MoodleNotificationPollPayload,
  type MoodleSyncJobName,
  type MoodleSyncRunPayload,
} from './moodle-sync.jobs';
import { MoodleSyncService } from './moodle-sync.service';
import { MoodleUserSyncService } from './moodle-user-sync.service';

@Injectable()
export class MoodleSyncJobHandler {
  private readonly logger = new Logger(MoodleSyncJobHandler.name);

  constructor(
    private readonly events: MoodleEventsService,
    private readonly users: MoodleUserSyncService,
    private readonly courses: MoodleCourseSyncService,
    private readonly enrolments: MoodleEnrolmentSyncService,
    private readonly sync: MoodleSyncService,
    private readonly notifications: MoodleNotificationService,
  ) {}

  async handle(jobName: MoodleSyncJobName, data: Record<string, unknown>) {
    switch (jobName) {
      case MOODLE_SYNC_JOB.STUDENT_ENROLLED:
        return this.studentEnrolled(data as MoodleHookStudentEnrolledPayload);
      case MOODLE_SYNC_JOB.STAFF_CREATED:
        return this.staffCreated(data as MoodleHookStaffCreatedPayload);
      case MOODLE_SYNC_JOB.REGISTRATION_APPROVED:
        return this.registrationApproved(
          data as MoodleHookRegistrationApprovedPayload,
        );
      case MOODLE_SYNC_JOB.PROMOTION_APPLIED:
        return this.promotionApplied(data as MoodleHookPromotionAppliedPayload);
      case MOODLE_SYNC_JOB.WORKSPACE_PROVISIONED:
        return this.workspaceProvisioned(
          data as MoodleHookWorkspaceProvisionedPayload,
        );
      case MOODLE_SYNC_JOB.SYNC_RUN:
        return this.syncRun(data as MoodleSyncRunPayload);
      case MOODLE_SYNC_JOB.NOTIFICATION_POLL:
        return this.notifications.pollTenant(
          (data as MoodleNotificationPollPayload).tenantId,
        );
      default:
        this.logger.warn(`Unknown Moodle sync job: ${jobName}`);
        return null;
    }
  }

  private async studentEnrolled(payload: MoodleHookStudentEnrolledPayload) {
    const { tenantId, studentId, semesterSequence } = payload;
    await this.events.emit({
      tenantId,
      entityType: 'STUDENT',
      entityId: studentId,
      action: 'ENROLLED',
    });
    await this.users.syncStudent(tenantId, studentId);
    await this.enrolments.enrollStudentInSemester(
      tenantId,
      studentId,
      semesterSequence,
    );
  }

  private async staffCreated(payload: MoodleHookStaffCreatedPayload) {
    await this.users.syncStaff(payload.tenantId, payload.staffProfileId);
  }

  private async registrationApproved(
    payload: MoodleHookRegistrationApprovedPayload,
  ) {
    await this.enrolments.enrollStudentInSemester(
      payload.tenantId,
      payload.studentId,
      payload.semesterSequence,
    );
  }

  private async promotionApplied(payload: MoodleHookPromotionAppliedPayload) {
    await this.enrolments.enrollStudentInSemester(
      payload.tenantId,
      payload.studentId,
      payload.toSemesterSequence,
    );
  }

  private async workspaceProvisioned(
    payload: MoodleHookWorkspaceProvisionedPayload,
  ) {
    await this.courses.syncWorkspaceCourse(
      payload.tenantId,
      payload.workspaceId,
    );
  }

  private async syncRun(payload: MoodleSyncRunPayload) {
    return this.sync.runSync(payload.tenantId, payload.syncType ?? 'ALL');
  }
}
