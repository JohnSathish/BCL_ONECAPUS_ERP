import { Module } from '@nestjs/common';
import { QueueModule } from '../../shared/queue/queue.module';
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
import { LmsSettingsService } from './services/lms-settings.service';
import { LmsWorkspaceService } from './services/lms-workspace.service';

@Module({
  imports: [QueueModule],
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
    LmsAuditService,
    LmsAttendanceBridgeService,
    LmsNotificationService,
  ],
  exports: [LmsWorkspaceService, LmsDashboardService],
})
export class LmsModule {}
