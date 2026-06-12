import { Global, Module } from '@nestjs/common';
import { OfferingSectionStreamsService } from '../../common/services/offering-section-streams.service';
import { PrismaModule } from '../../database/prisma.module';
import { ShiftsModule } from '../shifts/shifts.module';
import { CurriculumResolutionService } from '../academic-engine/services/curriculum-resolution.service';
import { AcademicCatalogService } from '../programs-courses/academic-catalog.service';

/** Shared curriculum services — breaks AcademicEngine ↔ ProgramsCourses circular imports. */
@Global()
@Module({
  imports: [PrismaModule, ShiftsModule],
  providers: [
    CurriculumResolutionService,
    OfferingSectionStreamsService,
    AcademicCatalogService,
  ],
  exports: [
    CurriculumResolutionService,
    OfferingSectionStreamsService,
    AcademicCatalogService,
  ],
})
export class CurriculumCoreModule {}
