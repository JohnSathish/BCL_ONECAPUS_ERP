import { Module, forwardRef } from '@nestjs/common';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { OfficialDocumentVerifyController } from './official-document-verify.controller';
import { OfficialDocumentsController } from './official-documents.controller';
import { OfficialDocumentsSeedService } from './official-documents.seed';
import { OfficialDocumentAssetsService } from './services/official-document-assets.service';
import { OfficialDocumentApprovalService } from './services/official-document-approval.service';
import { OfficialDocumentAuditService } from './services/official-document-audit.service';
import { OfficialDocumentDashboardService } from './services/official-document-dashboard.service';
import { OfficialDocumentPdfService } from './services/official-document-pdf.service';
import { OfficialDocumentSearchService } from './services/official-document-search.service';
import { OfficialDocumentSettingsService } from './services/official-document-settings.service';
import { OfficialDocumentService } from './services/official-document.service';
import { ReferenceNumberService } from './services/reference-number.service';

@Module({
  imports: [forwardRef(() => WorkflowEngineModule)],
  controllers: [OfficialDocumentsController, OfficialDocumentVerifyController],
  providers: [
    OfficialDocumentService,
    OfficialDocumentAssetsService,
    OfficialDocumentApprovalService,
    OfficialDocumentAuditService,
    OfficialDocumentDashboardService,
    OfficialDocumentPdfService,
    OfficialDocumentSearchService,
    OfficialDocumentSettingsService,
    ReferenceNumberService,
    OfficialDocumentsSeedService,
  ],
  exports: [OfficialDocumentService, OfficialDocumentsSeedService],
})
export class OfficialDocumentsModule {}
