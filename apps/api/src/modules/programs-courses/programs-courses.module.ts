import { Module } from '@nestjs/common';
import { ImportModule } from '../../common/import/import.module';
import { CourseDeliveryFeeService } from '../../common/services/course-delivery-fee.service';
import { PrismaModule } from '../../database/prisma.module';
import { AcademicEngineModule } from '../academic-engine/academic-engine.module';
import { CourseImportController } from './course-import.controller';
import { CourseImportHandler } from './import/course-import.handler';
import { CourseImportProcessor } from './import/course-import.processor';
import { CourseImportService } from './import/course-import.service';
import { ProgramsCoursesController } from './programs-courses.controller';
import { ProgramDataCleanupService } from './program-data-cleanup.service';
import { ProgramVersionLifecycleService } from './program-version-lifecycle.service';
import { ProgramsCoursesService } from './programs-courses.service';
import { CurriculumOfferingListService } from './curriculum-offering-list.service';

@Module({
  imports: [PrismaModule, ImportModule, AcademicEngineModule],
  controllers: [ProgramsCoursesController, CourseImportController],
  providers: [
    CurriculumOfferingListService,
    ProgramVersionLifecycleService,
    ProgramDataCleanupService,
    ProgramsCoursesService,
    CourseDeliveryFeeService,
    CourseImportHandler,
    CourseImportService,
    CourseImportProcessor,
  ],
  exports: [
    ProgramsCoursesService,
    CourseDeliveryFeeService,
    CourseImportProcessor,
  ],
})
export class ProgramsCoursesModule {}
