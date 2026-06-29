import { Module, forwardRef } from '@nestjs/common';
import { ImportModule } from '../../common/import/import.module';
import { AcademicLifecycleModule } from '../academic-lifecycle/academic-lifecycle.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { CourseDeliveryFeeService } from '../../common/services/course-delivery-fee.service';
import { AcademicEngineController } from './academic-engine.controller';
import { FyugpController } from './fyugp.controller';
import { SubjectSectionManagementController } from './subject-section-management.controller';
import { AcademicEngineService } from './academic-engine.service';
import { RegistrationImportController } from './import/registration-import.controller';
import { RegistrationImportHandler } from './import/registration-import.handler';
import { RegistrationImportService } from './import/registration-import.service';
import { AllocationService } from './services/allocation.service';
import { AnalyticsService } from './services/analytics.service';
import { ApprovalService } from './services/approval.service';
import { CreditLedgerService } from './services/credit-ledger.service';
import { OfferingsService } from './services/offerings.service';
import { AdminRegistrationService } from './services/admin-registration.service';
import { RegistrationWorkflowService } from './services/registration-workflow.service';
import { FyugpStructureTemplateService } from './services/fyugp-structure-template.service';
import { CategoryPoolService } from './services/category-pool.service';
import { AdmissionPoolsService } from './services/admission-pools.service';
import { MajorMinorEligibilityService } from './services/major-minor-eligibility.service';
import { SubjectRegistrationEngineService } from './services/subject-registration-engine.service';
import { PoolSectionProvisioningService } from './services/pool-section-provisioning.service';
import { SubjectSectionManagementService } from './services/subject-section-management.service';
import { SemesterRulesService } from './services/semester-rules.service';
import { HonoursTrackService } from './services/honours-track.service';
import { CurriculumCompletionService } from './services/curriculum-completion.service';
import { StudentMajorMinorTrackService } from './services/student-major-minor-track.service';
import { StudentVtcTrackService } from './services/student-vtc-track.service';
import { CourseEligibilityService } from './services/course-eligibility.service';
import { LmsModule } from '../lms/lms.module';
import { FeesModule } from '../fees/fees.module';

@Module({
  imports: [
    forwardRef(() => AcademicLifecycleModule),
    ShiftsModule,
    ImportModule,
    LmsModule,
    FeesModule,
  ],
  controllers: [
    AcademicEngineController,
    RegistrationImportController,
    FyugpController,
    SubjectSectionManagementController,
  ],
  providers: [
    AcademicEngineService,
    CourseDeliveryFeeService,
    FyugpStructureTemplateService,
    CategoryPoolService,
    OfferingsService,
    AllocationService,
    ApprovalService,
    CreditLedgerService,
    AnalyticsService,
    RegistrationWorkflowService,
    AdminRegistrationService,
    RegistrationImportHandler,
    RegistrationImportService,
    AdmissionPoolsService,
    MajorMinorEligibilityService,
    SubjectRegistrationEngineService,
    PoolSectionProvisioningService,
    SubjectSectionManagementService,
    SemesterRulesService,
    HonoursTrackService,
    CurriculumCompletionService,
    StudentMajorMinorTrackService,
    StudentVtcTrackService,
    CourseEligibilityService,
  ],
  exports: [
    AcademicEngineService,
    AnalyticsService,
    AdminRegistrationService,
    AdmissionPoolsService,
    MajorMinorEligibilityService,
    SubjectRegistrationEngineService,
    SemesterRulesService,
    HonoursTrackService,
    StudentMajorMinorTrackService,
    StudentVtcTrackService,
    OfferingsService,
    CourseEligibilityService,
    AllocationService,
  ],
})
export class AcademicEngineModule {}
