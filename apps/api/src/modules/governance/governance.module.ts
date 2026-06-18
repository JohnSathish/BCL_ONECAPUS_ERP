import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { StorageModule } from '../../shared/storage/storage.module';
import { GovernanceController } from './governance.controller';
import { GovernancePortalController } from './governance-portal.controller';
import { GovernanceAnalyticsService } from './services/governance-analytics.service';
import { GovernanceAtrService } from './services/governance-atr.service';
import { GovernanceAttendanceService } from './services/governance-attendance.service';
import { GovernanceCommitteeService } from './services/governance-committee.service';
import { GovernanceDashboardService } from './services/governance-dashboard.service';
import { GovernanceDocumentService } from './services/governance-document.service';
import { GovernanceEventService } from './services/governance-event.service';
import { GovernanceImportService } from './services/governance-import.service';
import { GovernanceMeetingService } from './services/governance-meeting.service';
import { GovernanceMemberService } from './services/governance-member.service';
import { GovernanceMomService } from './services/governance-mom.service';
import { GovernanceNaacService } from './services/governance-naac.service';
import { GovernanceNoticeService } from './services/governance-notice.service';
import { GovernanceNotificationService } from './services/governance-notification.service';
import { GovernancePdfService } from './services/governance-pdf.service';
import { GovernancePerformanceService } from './services/governance-performance.service';
import { GovernanceReportService } from './services/governance-report.service';
import { GovernanceSettingsService } from './services/governance-settings.service';
import { GovernanceTaskService } from './services/governance-task.service';

@Module({
  imports: [CommunicationModule, StorageModule],
  controllers: [GovernanceController, GovernancePortalController],
  providers: [
    GovernanceDashboardService,
    GovernanceCommitteeService,
    GovernanceMemberService,
    GovernanceMeetingService,
    GovernanceAttendanceService,
    GovernanceMomService,
    GovernanceAtrService,
    GovernanceTaskService,
    GovernanceNoticeService,
    GovernanceDocumentService,
    GovernanceEventService,
    GovernanceNaacService,
    GovernanceReportService,
    GovernanceAnalyticsService,
    GovernancePerformanceService,
    GovernanceImportService,
    GovernanceNotificationService,
    GovernancePdfService,
    GovernanceSettingsService,
  ],
  exports: [
    GovernanceCommitteeService,
    GovernanceMemberService,
    GovernanceMeetingService,
    GovernanceNoticeService,
    GovernanceSettingsService,
    GovernanceNaacService,
    GovernanceAtrService,
    GovernancePerformanceService,
    GovernanceDashboardService,
  ],
})
export class GovernanceModule {}
