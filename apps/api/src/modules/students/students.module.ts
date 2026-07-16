import { Module, forwardRef } from '@nestjs/common';
import { ImportModule } from '../../common/import/import.module';
import { QueueModule } from '../../shared/queue/queue.module';
import { AcademicEngineModule } from '../academic-engine/academic-engine.module';
import { AdministrationModule } from '../administration/administration.module';
import { OrganizationModule } from '../organization/organization.module';
import { CommunicationModule } from '../communication/communication.module';
import { LicensingModule } from '../licensing/licensing.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { ExaminationsModule } from '../examinations/examinations.module';
import { FeesModule } from '../fees/fees.module';
import { IdCardsModule } from '../id-cards/id-cards.module';
import { LibraryModule } from '../library/library.module';
import { LmsModule } from '../lms/lms.module';
import { StudentAttendanceModule } from '../student-attendance/student-attendance.module';
import { TimetableEngineModule } from '../timetable-engine/timetable-engine.module';
import { StudentBulkUpdateController } from './bulk-update/student-bulk-update.controller';
import { StudentBulkSectionWriterService } from './bulk-update/student-bulk-section-writer.service';
import { StudentBulkUpdateProcessor } from './bulk-update/student-bulk-update.processor';
import { StudentBulkUpdateService } from './bulk-update/student-bulk-update.service';
import { StudentImportHandler } from './import/student-import.handler';
import { StudentImportProfileWriterService } from './import/student-import-profile-writer.service';
import { StudentImportProcessor } from './import/student-import.processor';
import { StudentImportService } from './import/student-import.service';
import { Sem1ImportCurriculumService } from './import/sem1-import-curriculum.service';
import { Sem2ImportCurriculumService } from './import/sem2-import-curriculum.service';
import { Sem3ImportCurriculumService } from './import/sem3-import-curriculum.service';
import { Sem5ImportCurriculumService } from './import/sem5-import-curriculum.service';
import { Sem7ImportCurriculumService } from './import/sem7-import-curriculum.service';
import { MigrationStatusService } from './migration/migration-status.service';
import { StudentPhotoBulkController } from './photos/student-photo-bulk.controller';
import { StudentPhotoBulkProcessor } from './photos/student-photo-bulk.processor';
import { StudentPhotoBulkService } from './photos/student-photo-bulk.service';
import { StudentLifecycleService } from './services/student-lifecycle.service';
import { StudentProfileSectionsService } from './services/student-profile-sections.service';
import { StudentAssetsService } from './services/student-assets.service';
import { StudentDirectoryEnrichmentService } from './services/student-directory-enrichment.service';
import { StudentProfileService } from './services/student-profile.service';
import { StudentSemesterResolverService } from './services/student-semester-resolver.service';
import { RollNumberService } from './services/roll-number.service';
import { RollShiftRangeService } from './services/roll-shift-range.service';
import { StudentAbcService } from './services/student-abc.service';
import { StudentDepartmentBackfillService } from './services/student-department-backfill.service';
import { StudentsController } from './students.controller';
import { StudentPortalController } from './student-portal.controller';
import { StudentsService } from './students.service';
import { StudentPortalService } from './services/student-portal.service';
import { StudentPortalCalendarService } from './services/student-portal-calendar.service';
import { StudentPortalProfileService } from './services/student-portal-profile.service';
import { StudentLeaveService } from './services/student-leave.service';
import { AcademicChangeHistoryModule } from './academic-change-history/academic-change-history.module';
import { StudentProfileUpdatePolicyService } from './services/student-profile-update-policy.service';
import { StudentProfileChangeRequestService } from './services/student-profile-change-request.service';
import { StudentProfileVerificationController } from './student-profile-verification.controller';
import { Class12SubjectsController } from './controllers/class12-subjects.controller';
import { Class12SubjectsService } from './services/class12-subjects.service';

@Module({
  imports: [
    AcademicChangeHistoryModule,
    AcademicEngineModule,
    ShiftsModule,
    ImportModule,
    AdministrationModule,
    forwardRef(() => OrganizationModule),
    QueueModule,
    CommunicationModule,
    LicensingModule,
    StudentAttendanceModule,
    FeesModule,
    ExaminationsModule,
    LmsModule,
    TimetableEngineModule,
    LibraryModule,
    IdCardsModule,
  ],
  controllers: [
    StudentPortalController,
    StudentProfileVerificationController,
    StudentPhotoBulkController,
    StudentBulkUpdateController,
    StudentsController,
    Class12SubjectsController,
  ],
  providers: [
    StudentsService,
    StudentPortalService,
    StudentPortalCalendarService,
    StudentPortalProfileService,
    StudentProfileUpdatePolicyService,
    StudentProfileChangeRequestService,
    Class12SubjectsService,
    StudentLeaveService,
    StudentProfileService,
    StudentDirectoryEnrichmentService,
    StudentProfileSectionsService,
    StudentLifecycleService,
    StudentSemesterResolverService,
    RollNumberService,
    RollShiftRangeService,
    StudentAbcService,
    StudentDepartmentBackfillService,
    StudentAssetsService,
    StudentImportHandler,
    StudentImportProfileWriterService,
    StudentImportService,
    StudentImportProcessor,
    Sem3ImportCurriculumService,
    Sem1ImportCurriculumService,
    Sem2ImportCurriculumService,
    Sem5ImportCurriculumService,
    Sem7ImportCurriculumService,
    StudentBulkUpdateService,
    StudentBulkSectionWriterService,
    StudentBulkUpdateProcessor,
    StudentPhotoBulkService,
    StudentPhotoBulkProcessor,
    MigrationStatusService,
  ],
  exports: [
    StudentsService,
    StudentProfileService,
    StudentSemesterResolverService,
    RollNumberService,
    RollShiftRangeService,
    StudentAbcService,
    StudentPortalService,
    StudentLeaveService,
    StudentDirectoryEnrichmentService,
    StudentProfileChangeRequestService,
    StudentProfileUpdatePolicyService,
    StudentImportProcessor,
    StudentBulkUpdateProcessor,
    StudentPhotoBulkProcessor,
  ],
})
export class StudentsModule {}
