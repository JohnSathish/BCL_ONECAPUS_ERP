import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { FeesModule } from '../fees/fees.module';
import { LicensingModule } from '../licensing/licensing.module';
import { ExaminationsController } from './examinations.controller';
import { ExaminationsService } from './examinations.service';
import { IaController } from './ia/ia.controller';
import { IaAdmitCardService } from './ia/ia-admit-card.service';
import { IaAdmitEligibilityService } from './ia/ia-admit-eligibility.service';
import { IaAdmitPdfService } from './ia/ia-admit-pdf.service';
import { IaAuditService } from './ia/ia-audit.service';
import { IaConsolidationService } from './ia/ia-consolidation.service';
import { IaDashboardService } from './ia/ia-dashboard.service';
import { IaDefaulterService } from './ia/ia-defaulter.service';
import { IaMarkEntryService } from './ia/ia-mark-entry.service';
import { IaNehuExportService } from './ia/ia-nehu-export.service';
import { IaPortalService } from './ia/ia-portal.service';
import { IaSchemeService } from './ia/ia-scheme.service';
import { IaSessionService } from './ia/ia-session.service';
import { IaSettingsService } from './ia/ia-settings.service';
import { IaWorkflowService } from './ia/ia-workflow.service';

@Module({
  imports: [CommunicationModule, LicensingModule, FeesModule],
  controllers: [ExaminationsController, IaController],
  providers: [
    ExaminationsService,
    IaSettingsService,
    IaAuditService,
    IaSchemeService,
    IaSessionService,
    IaMarkEntryService,
    IaWorkflowService,
    IaConsolidationService,
    IaNehuExportService,
    IaDashboardService,
    IaDefaulterService,
    IaPortalService,
    IaAdmitEligibilityService,
    IaAdmitPdfService,
    IaAdmitCardService,
  ],
  exports: [ExaminationsService, IaSettingsService, IaDashboardService],
})
export class ExaminationsModule {}
