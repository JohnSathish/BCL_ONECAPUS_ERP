import { Module } from '@nestjs/common';
import { QueueModule } from '../../shared/queue/queue.module';
import { MoodleController } from './moodle.controller';
import { MoodleApiService } from './moodle-api.service';
import { MoodleAssignmentSyncService } from './moodle-assignment-sync.service';
import { MoodleAttendanceSyncService } from './moodle-attendance-sync.service';
import { MoodleAuthService } from './moodle-auth.service';
import { MoodleCalendarService } from './moodle-calendar.service';
import { MoodleCourseSyncService } from './moodle-course-sync.service';
import { MoodleCronService } from './moodle-cron.service';
import { MoodleDeadLetterService } from './moodle-dead-letter.service';
import { MoodleEnrolmentSyncService } from './moodle-enrolment-sync.service';
import { MoodleEventsService } from './moodle-events.service';
import { MoodleGradeSyncService } from './moodle-grade-sync.service';
import { MoodleHookService } from './moodle-hook.service';
import { MoodleNotificationService } from './moodle-notification.service';
import { MoodleSettingsService } from './moodle-settings.service';
import { MoodleSyncJobHandler } from './moodle-sync-job.handler';
import { MoodleSyncProcessor } from './moodle-sync.processor';
import { MoodleSyncQueueService } from './moodle-sync-queue.service';
import { MoodleSyncService } from './moodle-sync.service';
import { MoodleUserSyncService } from './moodle-user-sync.service';

@Module({
  imports: [QueueModule],
  controllers: [MoodleController],
  providers: [
    MoodleSettingsService,
    MoodleApiService,
    MoodleAuthService,
    MoodleEventsService,
    MoodleCalendarService,
    MoodleNotificationService,
    MoodleUserSyncService,
    MoodleCourseSyncService,
    MoodleEnrolmentSyncService,
    MoodleAssignmentSyncService,
    MoodleGradeSyncService,
    MoodleAttendanceSyncService,
    MoodleSyncService,
    MoodleSyncJobHandler,
    MoodleSyncQueueService,
    MoodleDeadLetterService,
    MoodleSyncProcessor,
    MoodleHookService,
    MoodleCronService,
  ],
  exports: [
    MoodleHookService,
    MoodleAuthService,
    MoodleSettingsService,
    MoodleSyncService,
    MoodleSyncQueueService,
    MoodleEventsService,
    MoodleCalendarService,
    MoodleNotificationService,
  ],
})
export class MoodleModule {}
