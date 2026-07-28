import { Module } from '@nestjs/common';

import { QueueModule } from '../../shared/queue/queue.module';

import { MoodleModule } from '../moodle/moodle.module';

import { MoodleLmsAdapter } from './adapters/moodle-lms.adapter';

import { NativeLmsAdapter } from './adapters/native-lms.adapter';

import { LmsProviderRouterService } from './adapters/lms-provider-router.service';

import { LmsController } from './lms.controller';

import { LmsPortalController } from './lms-portal.controller';

import { LmsAccessService } from './services/lms-access.service';

import { LmsAnnouncementsService } from './services/lms-announcements.service';

import { LmsAttendanceBridgeService } from './services/lms-attendance-bridge.service';

import { LmsAuditService } from './services/lms-audit.service';

import { LmsDashboardService } from './services/lms-dashboard.service';

import { LmsLessonPlansService } from './services/lms-lesson-plans.service';

import { LmsAssignmentsService } from './services/lms-assignments.service';

import { LmsQuizzesService } from './services/lms-quizzes.service';

import { LmsDiscussionsService } from './services/lms-discussions.service';

import { LmsMaterialsService } from './services/lms-materials.service';

import { LmsNotificationService } from './services/lms-notification.service';

import { LmsOpenCoursesService } from './services/lms-open-courses.service';

import { LmsSettingsService } from './services/lms-settings.service';

import { LmsWorkspaceService } from './services/lms-workspace.service';

@Module({
  imports: [QueueModule, MoodleModule],

  controllers: [LmsController, LmsPortalController],

  providers: [
    LmsAccessService,

    LmsWorkspaceService,

    LmsMaterialsService,

    LmsAnnouncementsService,

    LmsLessonPlansService,

    LmsAssignmentsService,

    LmsQuizzesService,

    LmsDiscussionsService,

    LmsDashboardService,

    LmsSettingsService,

    LmsOpenCoursesService,

    LmsAuditService,

    LmsAttendanceBridgeService,

    LmsNotificationService,

    NativeLmsAdapter,

    MoodleLmsAdapter,

    LmsProviderRouterService,
  ],

  exports: [
    LmsWorkspaceService,
    LmsDashboardService,
    LmsProviderRouterService,
    LmsOpenCoursesService,
  ],
})
export class LmsModule {}
