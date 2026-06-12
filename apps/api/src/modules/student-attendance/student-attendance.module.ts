import { Module } from '@nestjs/common';
import { LicensingModule } from '../licensing/licensing.module';
import { StudentAttendanceController } from './student-attendance.controller';
import { StudentAttendanceService } from './student-attendance.service';

@Module({
  imports: [LicensingModule],
  controllers: [StudentAttendanceController],
  providers: [StudentAttendanceService],
  exports: [StudentAttendanceService],
})
export class StudentAttendanceModule {}
