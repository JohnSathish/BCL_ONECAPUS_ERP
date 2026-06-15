import { Module, forwardRef } from '@nestjs/common';
import { AdministrationModule } from '../administration/administration.module';
import { AuthModule } from '../auth/auth.module';
import { CommunicationModule } from '../communication/communication.module';
import { LicensingModule } from '../licensing/licensing.module';
import { ProgramsCoursesModule } from '../programs-courses/programs-courses.module';
import { StudentsModule } from '../students/students.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AdmissionsAdminController } from './admissions-admin.controller';
import { AdmissionsPortalController } from './admissions-portal.controller';
import { AdmissionsAllocationService } from './admissions-allocation.service';
import { AdmissionsAnalyticsService } from './admissions-analytics.service';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsCycleService } from './admissions-cycle.service';
import { AdmissionsDocumentService } from './admissions-document.service';
import { AdmissionsEnrollmentService } from './admissions-enrollment.service';
import { AdmissionsFormService } from './admissions-form.service';
import { AdmissionsMeritService } from './admissions-merit.service';
import { AdmissionsPaymentService } from './admissions-payment.service';
import { AdmissionsApplicationDocumentService } from './admissions-application-document.service';
import { AdmissionsPortalPasswordService } from './admissions-portal-password.service';
import { AdmissionsPortalService } from './admissions-portal.service';
import { AdmissionsService } from './admissions.service';
import { AdmissionsValidationService } from './admissions-validation.service';

@Module({
  imports: [
    ProgramsCoursesModule,
    CommunicationModule,
    LicensingModule,
    AuthModule,
    AdministrationModule,
    TenantsModule,
    forwardRef(() => StudentsModule),
  ],
  controllers: [
    AdmissionsController,
    AdmissionsAdminController,
    AdmissionsPortalController,
  ],
  providers: [
    AdmissionsService,
    AdmissionsValidationService,
    AdmissionsCycleService,
    AdmissionsPortalService,
    AdmissionsPortalPasswordService,
    AdmissionsPaymentService,
    AdmissionsFormService,
    AdmissionsDocumentService,
    AdmissionsMeritService,
    AdmissionsAllocationService,
    AdmissionsEnrollmentService,
    AdmissionsAnalyticsService,
    AdmissionsApplicationDocumentService,
  ],
  exports: [AdmissionsService, AdmissionsCycleService],
})
export class AdmissionsModule {}
