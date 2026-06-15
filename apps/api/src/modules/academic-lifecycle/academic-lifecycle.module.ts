import { Module, forwardRef } from '@nestjs/common';
import { AdmissionsModule } from '../admissions/admissions.module';
import { FeesModule } from '../fees/fees.module';
import { AcademicLifecycleController } from './academic-lifecycle.controller';
import { AcademicLifecycleService } from './academic-lifecycle.service';
import { AcademicSessionService } from './services/academic-session.service';
import { ActiveSemesterService } from './services/active-semester.service';
import { AdmissionBatchService } from './services/admission-batch.service';
import { BatchSemesterMappingService } from './services/batch-semester-mapping.service';
import { CycleActivationService } from './services/cycle-activation.service';
import { CycleRolloverService } from './services/cycle-rollover.service';
import { InstitutionAcademicConfigService } from './services/institution-academic-config.service';
import { ProgrammeCompletionService } from './services/programme-completion.service';
import { PromotionEligibilityService } from './services/promotion-eligibility.service';
import { PromotionRunService } from './services/promotion-run.service';
import { SemesterLifecycleService } from './services/semester-lifecycle.service';

@Module({
  imports: [forwardRef(() => AdmissionsModule), FeesModule],
  controllers: [AcademicLifecycleController],
  providers: [
    AcademicLifecycleService,
    InstitutionAcademicConfigService,
    SemesterLifecycleService,
    ActiveSemesterService,
    AcademicSessionService,
    AdmissionBatchService,
    BatchSemesterMappingService,
    CycleActivationService,
    CycleRolloverService,
    PromotionEligibilityService,
    PromotionRunService,
    ProgrammeCompletionService,
  ],
  exports: [AcademicLifecycleService],
})
export class AcademicLifecycleModule {}
