import { Module, forwardRef } from '@nestjs/common';
import { ImportModule } from '../../common/import/import.module';
import { QueueModule } from '../../shared/queue/queue.module';
import { LicensingModule } from '../licensing/licensing.module';
import { AcademicEngineModule } from '../academic-engine/academic-engine.module';
import { AcademicLifecycleModule } from '../academic-lifecycle/academic-lifecycle.module';
import { CommunicationModule } from '../communication/communication.module';
import { GovernanceModule } from '../governance/governance.module';
import { LmsModule } from '../lms/lms.module';
import { AdministrationModule } from '../administration/administration.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { StaffImportCommitService } from './import/staff-import-commit.service';
import { StaffImportHandler } from './import/staff-import.handler';
import { StaffImportService } from './import/staff-import.service';
import { StaffBulkSectionWriterService } from './bulk-update/staff-bulk-section-writer.service';
import { StaffBulkUpdateController } from './bulk-update/staff-bulk-update.controller';
import { StaffBulkUpdateProcessor } from './bulk-update/staff-bulk-update.processor';
import { StaffBulkUpdateService } from './bulk-update/staff-bulk-update.service';
import { StaffAdditionalRoleService } from './services/staff-additional-role.service';
import { EmployeeCodeService } from './services/employee-code.service';
import { StaffAssetsService } from './services/staff-assets.service';
import { StaffDocumentsService } from './services/staff-documents.service';
import { StaffAwardService } from './services/staff-award.service';
import { StaffEmploymentService } from './services/staff-employment.service';
import { StaffLifecycleService } from './services/staff-lifecycle.service';
import { StaffProfileService } from './services/staff-profile.service';
import { StaffProvisioningService } from './services/staff-provisioning.service';
import { StaffPublicationService } from './services/staff-publication.service';
import { StaffSubjectAssignmentService } from './services/staff-subject-assignment.service';
import { StaffSummaryService } from './services/staff-summary.service';
import { StaffPortalController } from './staff-portal.controller';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';
import { StaffPortalService } from './services/staff-portal.service';

@Module({
  imports: [
    forwardRef(() => AdministrationModule),
    forwardRef(() => ShiftsModule),
    forwardRef(() => AcademicEngineModule),
    AcademicLifecycleModule,
    CommunicationModule,
    forwardRef(() => GovernanceModule),
    LmsModule,
    ImportModule,
    QueueModule,
    LicensingModule,
  ],
  controllers: [
    StaffPortalController,
    StaffBulkUpdateController,
    StaffController,
  ],
  providers: [
    StaffPortalService,
    StaffService,
    StaffSummaryService,
    EmployeeCodeService,
    StaffProvisioningService,
    StaffProfileService,
    StaffSubjectAssignmentService,
    StaffAssetsService,
    StaffDocumentsService,
    StaffEmploymentService,
    StaffAdditionalRoleService,
    StaffLifecycleService,
    StaffPublicationService,
    StaffAwardService,
    StaffImportHandler,
    StaffImportService,
    StaffImportCommitService,
    StaffBulkUpdateService,
    StaffBulkSectionWriterService,
    StaffBulkUpdateProcessor,
  ],
  exports: [
    StaffService,
    StaffProfileService,
    StaffProvisioningService,
    StaffEmploymentService,
    EmployeeCodeService,
    StaffImportHandler,
    StaffImportService,
    StaffPortalService,
    StaffBulkUpdateProcessor,
  ],
})
export class StaffModule {}
