import { Module } from '@nestjs/common';
import { DashboardAnalyticsModule } from '../dashboard-analytics/dashboard-analytics.module';
import { FeesModule } from '../fees/fees.module';
import { GovernanceModule } from '../governance/governance.module';
import { HrModule } from '../hr/hr.module';
import { LibraryModule } from '../library/library.module';
import { NaacIqacModule } from '../naac-iqac/naac-iqac.module';
import { StaffModule } from '../staff/staff.module';
import { StudentAttendanceModule } from '../student-attendance/student-attendance.module';
import { StudentsModule } from '../students/students.module';
import { PrincipalDeskController } from './principal-desk.controller';
import { PrincipalDeskDashboardService } from './services/principal-desk-dashboard.service';
import { PrincipalStaffCommandService } from './services/principal-staff-command.service';
import { PrincipalStudentCommandService } from './services/principal-student-command.service';
import { PrincipalAttendanceControlService } from './services/principal-attendance-control.service';
import { PrincipalFeeDefaulterService } from './services/principal-fee-defaulter.service';
import { PrincipalInstitutionalHealthService } from './services/principal-institutional-health.service';

@Module({
  imports: [
    DashboardAnalyticsModule,
    LibraryModule,
    FeesModule,
    StudentAttendanceModule,
    StaffModule,
    GovernanceModule,
    NaacIqacModule,
    HrModule,
    StudentsModule,
  ],
  controllers: [PrincipalDeskController],
  providers: [
    PrincipalDeskDashboardService,
    PrincipalStudentCommandService,
    PrincipalStaffCommandService,
    PrincipalAttendanceControlService,
    PrincipalFeeDefaulterService,
    PrincipalInstitutionalHealthService,
  ],
  exports: [
    PrincipalDeskDashboardService,
    PrincipalStudentCommandService,
    PrincipalStaffCommandService,
  ],
})
export class PrincipalDeskModule {}
