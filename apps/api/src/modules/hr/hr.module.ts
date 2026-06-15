import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { SubstituteStaffController } from './substitute-staff.controller';
import { LeaveService } from './services/leave.service';
import { RecruitmentService } from './services/recruitment.service';
import { PensionService } from './services/pension.service';
import { AppraisalService } from './services/appraisal.service';
import { SubstituteStaffService } from './services/substitute-staff.service';
import { ReplacementAssignmentService } from './services/replacement-assignment.service';
import { ReplacementTimetableOverlayService } from './services/replacement-timetable-overlay.service';

@Module({
  controllers: [HrController, SubstituteStaffController],
  providers: [
    LeaveService,
    RecruitmentService,
    PensionService,
    AppraisalService,
    SubstituteStaffService,
    ReplacementAssignmentService,
    ReplacementTimetableOverlayService,
  ],
  exports: [
    LeaveService,
    RecruitmentService,
    PensionService,
    AppraisalService,
    SubstituteStaffService,
    ReplacementAssignmentService,
    ReplacementTimetableOverlayService,
  ],
})
export class HrModule {}
