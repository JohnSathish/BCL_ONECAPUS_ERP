import { Module } from '@nestjs/common';
import { AcademicChangeHistoryService } from './academic-change-history.service';

@Module({
  providers: [AcademicChangeHistoryService],
  exports: [AcademicChangeHistoryService],
})
export class AcademicChangeHistoryModule {}
