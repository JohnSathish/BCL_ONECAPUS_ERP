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
import { StudentImportService } from './import/student-import.service';
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
import { StudentsController } from './students.controller';
import { StudentPortalController } from './student-portal.controller';
import { StudentsService } from './students.service';
import { StudentPortalService } from './services/student-portal.service';
import { StudentPortalCalendarService } from './services/student-portal-calendar.service';
import { StudentPortalProfileService } from './services/student-portal-profile.service';

@Module({
  imports: [
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
    StudentPhotoBulkController,
    StudentBulkUpdateController,
    StudentsController,
  ],
  providers: [
    StudentsService,
    StudentPortalService,
    StudentPortalCalendarService,
    StudentPortalProfileService,
    StudentProfileService,
    StudentDirectoryEnrichmentService,
    StudentProfileSectionsService,
    StudentLifecycleService,
    StudentSemesterResolverService,
    RollNumberService,
    StudentAssetsService,
    StudentImportHandler,
    StudentImportService,
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
    StudentPortalService,
  ],
})
export class StudentsModule {}
