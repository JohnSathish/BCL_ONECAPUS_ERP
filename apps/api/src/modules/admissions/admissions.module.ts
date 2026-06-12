import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { LicensingModule } from '../licensing/licensing.module';
import { ProgramsCoursesModule } from '../programs-courses/programs-courses.module';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';
import { AdmissionsValidationService } from './admissions-validation.service';

@Module({
  imports: [ProgramsCoursesModule, CommunicationModule, LicensingModule],
  controllers: [AdmissionsController],
  providers: [AdmissionsService, AdmissionsValidationService],
  exports: [AdmissionsService],
})
export class AdmissionsModule {}
