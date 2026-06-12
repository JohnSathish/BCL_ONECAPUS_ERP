import { Module } from '@nestjs/common';
import { StudentReportsController } from './student-reports.controller';
import { StudentReportsExportService } from './services/student-reports-export.service';
import { StudentReportsQueryService } from './services/student-reports-query.service';
import { StudentReportsService } from './services/student-reports.service';

@Module({
  controllers: [StudentReportsController],
  providers: [
    StudentReportsQueryService,
    StudentReportsService,
    StudentReportsExportService,
  ],
  exports: [StudentReportsService],
})
export class StudentReportsModule {}
