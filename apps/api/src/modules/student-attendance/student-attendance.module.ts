import { Module } from '@nestjs/common';
import { AcademicCalendarModule } from '../academic-calendar/academic-calendar.module';
import { LicensingModule } from '../licensing/licensing.module';
import { TeachingSubjectGroupModule } from '../timetable-engine/teaching-subject-group.module';
import { AttendancePolicyService } from './attendance-policy.service';
import { StudentAttendanceSchedulerService } from './student-attendance-scheduler.service';
import { StudentAttendanceController } from './student-attendance.controller';
import { StudentAttendanceService } from './student-attendance.service';

@Module({
  imports: [
    LicensingModule,
    TeachingSubjectGroupModule,
    AcademicCalendarModule,
  ],
  controllers: [StudentAttendanceController],
  providers: [
    StudentAttendanceService,
    AttendancePolicyService,
    StudentAttendanceSchedulerService,
  ],
  exports: [StudentAttendanceService, AttendancePolicyService],
})
export class StudentAttendanceModule {}
