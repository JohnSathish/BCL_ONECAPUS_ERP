import type { MoodleSyncType } from './moodle-sync.service';

/** Canonical job names for the dedicated `moodle-sync` BullMQ queue. */
export const MOODLE_SYNC_JOB = {
  STUDENT_ENROLLED: 'hook-student-enrolled',
  STAFF_CREATED: 'hook-staff-created',
  REGISTRATION_APPROVED: 'hook-registration-approved',
  PROMOTION_APPLIED: 'hook-promotion-applied',
  WORKSPACE_PROVISIONED: 'hook-workspace-provisioned',
  SYNC_RUN: 'sync-run',
  NOTIFICATION_POLL: 'notification-poll',
} as const;

export type MoodleSyncJobName =
  (typeof MOODLE_SYNC_JOB)[keyof typeof MOODLE_SYNC_JOB];

export type MoodleHookStudentEnrolledPayload = {
  tenantId: string;
  studentId: string;
  semesterSequence: number;
};

export type MoodleHookStaffCreatedPayload = {
  tenantId: string;
  staffProfileId: string;
};

export type MoodleHookRegistrationApprovedPayload = {
  tenantId: string;
  studentId: string;
  semesterSequence: number;
};

export type MoodleHookPromotionAppliedPayload = {
  tenantId: string;
  studentId: string;
  toSemesterSequence: number;
};

export type MoodleHookWorkspaceProvisionedPayload = {
  tenantId: string;
  workspaceId: string;
};

export type MoodleSyncRunPayload = {
  tenantId: string;
  syncType: MoodleSyncType;
  source?: 'manual' | 'cron' | 'retry';
};

export type MoodleNotificationPollPayload = {
  tenantId: string;
};

export type MoodleSyncJobPayload =
  | MoodleHookStudentEnrolledPayload
  | MoodleHookStaffCreatedPayload
  | MoodleHookRegistrationApprovedPayload
  | MoodleHookPromotionAppliedPayload
  | MoodleHookWorkspaceProvisionedPayload
  | MoodleSyncRunPayload
  | MoodleNotificationPollPayload;

export const MOODLE_SYNC_QUEUE_OPTS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: 200,
  removeOnFail: 500,
};
