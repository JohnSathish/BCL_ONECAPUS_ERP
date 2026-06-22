import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { PayrollModule } from '../payroll/payroll.module';
import { StaffModule } from '../staff/staff.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AppointmentOrderController } from './appointment-order.controller';
import { AppointmentOrderVerifyController } from './appointment-order-verify.controller';
import { HrController } from './hr.controller';
import { JoiningReportController } from './joining-report.controller';
import { ProbationController } from './probation.controller';
import { SubstituteStaffController } from './substitute-staff.controller';
import { AppointmentOrderDocumentService } from './services/appointment-order-document.service';
import { AppointmentOrderService } from './services/appointment-order.service';
import { AppointmentOrderTemplateService } from './services/appointment-order-template.service';
import { HrSchedulerService } from './services/hr-scheduler.service';
import { JoiningReportService } from './services/joining-report.service';
import { LeaveService } from './services/leave.service';
import { ProbationService } from './services/probation.service';
import { RecruitmentService } from './services/recruitment.service';
import { RecruitmentInterviewDocumentService } from './services/recruitment-interview-document.service';
import { RecruitmentNotificationService } from './services/recruitment-notification.service';
import { CareersPortalService } from './services/careers-portal.service';
import { CareersPortalController } from './careers-portal.controller';
import { PensionService } from './services/pension.service';
import { AppraisalService } from './services/appraisal.service';
import { SubstituteStaffService } from './services/substitute-staff.service';
import { ReplacementAssignmentService } from './services/replacement-assignment.service';
import { ReplacementTimetableOverlayService } from './services/replacement-timetable-overlay.service';

@Module({
  imports: [PayrollModule, StaffModule, CommunicationModule, TenantsModule],
  controllers: [
    HrController,
    SubstituteStaffController,
    AppointmentOrderController,
    AppointmentOrderVerifyController,
    JoiningReportController,
    ProbationController,
    CareersPortalController,
  ],
  providers: [
    LeaveService,
    RecruitmentService,
    PensionService,
    AppraisalService,
    SubstituteStaffService,
    ReplacementAssignmentService,
    ReplacementTimetableOverlayService,
    AppointmentOrderService,
    AppointmentOrderDocumentService,
    AppointmentOrderTemplateService,
    JoiningReportService,
    ProbationService,
    HrSchedulerService,
    CareersPortalService,
    RecruitmentNotificationService,
    RecruitmentInterviewDocumentService,
  ],
  exports: [
    LeaveService,
    RecruitmentService,
    PensionService,
    AppraisalService,
    SubstituteStaffService,
    ReplacementAssignmentService,
    ReplacementTimetableOverlayService,
    AppointmentOrderService,
    JoiningReportService,
  ],
})
export class HrModule {}
