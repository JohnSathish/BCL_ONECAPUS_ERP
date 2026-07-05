import { Module } from '@nestjs/common';
import { KnowledgeBaseController } from './knowledge-base.controller';
import { KnowledgeIngestService } from './knowledge-ingest.service';
import { KnowledgeQueryService } from './knowledge-query.service';

@Module({
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeIngestService, KnowledgeQueryService],
  exports: [KnowledgeIngestService, KnowledgeQueryService],
})
export class KnowledgeBaseModule {}
