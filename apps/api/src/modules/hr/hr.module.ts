import { Module } from '@nestjs/common';
import { HrController } from './hr.controller';
import { LeaveService } from './services/leave.service';
import { RecruitmentService } from './services/recruitment.service';
import { PensionService } from './services/pension.service';
import { AppraisalService } from './services/appraisal.service';

@Module({
  controllers: [HrController],
  providers: [
    LeaveService,
    RecruitmentService,
    PensionService,
    AppraisalService,
  ],
  exports: [LeaveService, RecruitmentService, PensionService, AppraisalService],
})
export class HrModule {}
