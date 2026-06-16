import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { TeachingSubjectGroupModule } from '../timetable-engine/teaching-subject-group.module';
import { StudentAttendanceController } from './student-attendance.controller';
import { StudentAttendanceService } from './student-attendance.service';

@Module({
  imports: [LicensingModule, TeachingSubjectGroupModule],
  controllers: [StudentAttendanceController],
  providers: [StudentAttendanceService],
  exports: [StudentAttendanceService],
})
export class StudentAttendanceModule {}
