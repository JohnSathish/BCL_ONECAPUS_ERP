import { Module, forwardRef } from '@nestjs/common';
import { StorageModule } from '../../shared/storage/storage.module';
import { CommunicationModule } from '../communication/communication.module';
import { GovernanceModule } from '../governance/governance.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { NaacIqacController } from './naac-iqac.controller';
import { NaacIqacPortalController } from './naac-iqac-portal.controller';
import { FeedbackSurveyController } from './feedback-survey.controller';
import {
  NaacAchievementService,
  NaacMouService,
} from './services/naac-achievement.service';
import { NaacAggregatorService } from './services/naac-aggregator.service';
import { NaacAqarService } from './services/naac-aqar.service';
import {
  NaacCalendarService,
  NaacSettingsService,
} from './services/naac-calendar.service';
import { NaacCalendarNotifyService } from './services/naac-calendar-notify.service';
import { NaacCriteriaService } from './services/naac-criteria.service';
import { NaacDashboardService } from './services/naac-dashboard.service';
import { NaacDepartmentService } from './services/naac-department.service';
import { NaacDvvService } from './services/naac-dvv.service';
import { NaacEvidenceService } from './services/naac-evidence.service';
import { NaacIntegrationService } from './services/naac-integration.service';
import { NaacReportService } from './services/naac-report.service';
import { NaacVaultService } from './services/naac-vault.service';
import { FeedbackSurveyService } from './services/feedback-survey.service';
import { NaacMetricWorkspaceService } from './services/naac-metric-workspace.service';
import { NaacExtendedProfileService } from './services/naac-extended-profile.service';
import { NaacMetricTableService } from './services/naac-metric-table.service';

@Module({
  imports: [
    StorageModule,
    GovernanceModule,
    CommunicationModule,
    forwardRef(() => WorkflowEngineModule),
  ],
  controllers: [
    NaacIqacController,
    NaacIqacPortalController,
    FeedbackSurveyController,
  ],
  providers: [
    NaacDashboardService,
    NaacCriteriaService,
    NaacEvidenceService,
    NaacVaultService,
    NaacAggregatorService,
    NaacAqarService,
    NaacAchievementService,
    NaacMouService,
    NaacDepartmentService,
    NaacIntegrationService,
    NaacCalendarService,
    NaacCalendarNotifyService,
    NaacSettingsService,
    NaacDvvService,
    NaacReportService,
    FeedbackSurveyService,
    NaacMetricWorkspaceService,
    NaacExtendedProfileService,
    NaacMetricTableService,
  ],
  exports: [
    NaacEvidenceService,
    NaacDashboardService,
    FeedbackSurveyService,
    NaacMetricWorkspaceService,
    NaacExtendedProfileService,
    NaacMetricTableService,
  ],
})
export class NaacIqacModule {}
