import { Module } from '@nestjs/common';
import { StorageModule } from '../../shared/storage/storage.module';
import { GovernanceModule } from '../governance/governance.module';
import { NaacIqacController } from './naac-iqac.controller';
import { NaacIqacPortalController } from './naac-iqac-portal.controller';
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
import { NaacCriteriaService } from './services/naac-criteria.service';
import { NaacDashboardService } from './services/naac-dashboard.service';
import { NaacDepartmentService } from './services/naac-department.service';
import { NaacDvvService } from './services/naac-dvv.service';
import { NaacEvidenceService } from './services/naac-evidence.service';
import { NaacIntegrationService } from './services/naac-integration.service';
import { NaacReportService } from './services/naac-report.service';
import { NaacVaultService } from './services/naac-vault.service';

@Module({
  imports: [StorageModule, GovernanceModule],
  controllers: [NaacIqacController, NaacIqacPortalController],
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
    NaacSettingsService,
    NaacDvvService,
    NaacReportService,
  ],
  exports: [NaacEvidenceService, NaacDashboardService],
})
export class NaacIqacModule {}
// NIMS Phase 1 — NAAC & IQAC institutional compliance platform
