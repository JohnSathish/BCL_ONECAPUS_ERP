import { Module } from '@nestjs/common';
import { FeesModule } from '../../modules/fees/fees.module';
import { ProgramsCoursesModule } from '../../modules/programs-courses/programs-courses.module';
import { StaffModule } from '../../modules/staff/staff.module';
import { StaffAttendanceModule } from '../../modules/staff-attendance/staff-attendance.module';
import { StudentsModule } from '../../modules/students/students.module';
import { ExportsQueueProcessor } from './exports-queue.processor';

@Module({
  imports: [
    StudentsModule,
    ProgramsCoursesModule,
    FeesModule,
    StaffModule,
    StaffAttendanceModule,
  ],
  providers: [ExportsQueueProcessor],
})
export class BackgroundExportsModule {}
