import { Module } from '@nestjs/common';
import { QuestionBankController } from './question-bank.controller';
import { QuestionBankAnalyticsService } from './services/question-bank-analytics.service';
import { QuestionBankAssetsService } from './services/question-bank-assets.service';
import { QuestionPaperBulkImportService } from './services/question-paper-bulk-import.service';
import { QuestionPaperWorkflowService } from './services/question-paper-workflow.service';
import { QuestionPapersService } from './services/question-papers.service';

@Module({
  controllers: [QuestionBankController],
  providers: [
    QuestionPapersService,
    QuestionBankAssetsService,
    QuestionPaperWorkflowService,
    QuestionBankAnalyticsService,
    QuestionPaperBulkImportService,
  ],
  exports: [QuestionPapersService],
})
export class QuestionBankModule {}
