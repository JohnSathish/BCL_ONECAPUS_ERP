import { Module } from '@nestjs/common';
import { ShiftsModule } from '../shifts/shifts.module';
import { StudentsModule } from '../students/students.module';
import { StudentReportsController } from './student-reports.controller';
import { CustomReportService } from './services/custom-report.service';
import { StudentMasterAssemblerService } from './services/student-master-assembler.service';
import { StudentReportsExportService } from './services/student-reports-export.service';
import { StudentReportsQueryService } from './services/student-reports-query.service';
import { StudentReportsService } from './services/student-reports.service';
import { StudentSubjectReportService } from './services/student-subject-report.service';
import { StudentSubjectStrengthReportService } from './services/student-subject-strength-report.service';
import { StudentDepartmentStrengthReportService } from './services/student-department-strength-report.service';
import { StudentTabularExportService } from './services/student-tabular-export.service';

@Module({
  imports: [StudentsModule, ShiftsModule],
  controllers: [StudentReportsController],
  providers: [
    StudentReportsQueryService,
    StudentReportsService,
    StudentReportsExportService,
    StudentMasterAssemblerService,
    StudentSubjectReportService,
    StudentSubjectStrengthReportService,
    StudentDepartmentStrengthReportService,
    StudentTabularExportService,
    CustomReportService,
  ],
  exports: [
    StudentReportsService,
    CustomReportService,
    StudentReportsQueryService,
    StudentSubjectStrengthReportService,
    StudentDepartmentStrengthReportService,
  ],
})
export class StudentReportsModule {}
