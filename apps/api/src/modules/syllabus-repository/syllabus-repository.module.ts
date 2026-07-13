import { Module } from '@nestjs/common';
import { SyllabusRepositoryController } from './syllabus-repository.controller';
import { SyllabusAnalyticsService } from './services/syllabus-analytics.service';
import { SyllabusAssetsService } from './services/syllabus-assets.service';
import { SyllabusBulkImportService } from './services/syllabus-bulk-import.service';
import { SyllabusDocumentsService } from './services/syllabus-documents.service';
import { SyllabusPublishHooksService } from './services/syllabus-publish-hooks.service';
import { SyllabusWorkflowService } from './services/syllabus-workflow.service';

@Module({
  controllers: [SyllabusRepositoryController],
  providers: [
    SyllabusDocumentsService,
    SyllabusAssetsService,
    SyllabusWorkflowService,
    SyllabusPublishHooksService,
    SyllabusBulkImportService,
    SyllabusAnalyticsService,
  ],
  exports: [SyllabusDocumentsService],
})
export class SyllabusRepositoryModule {}
