import { Module, forwardRef } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { CommunicationModule } from '../communication/communication.module';
import { NaacIqacModule } from '../naac-iqac/naac-iqac.module';
import { DepartmentActivitiesController } from './department-activities.controller';
import { DepartmentActivitiesPhase2Service } from './services/department-activities-phase2.service';
import { DepartmentActivitiesService } from './services/department-activities.service';

@Module({
  imports: [
    CertificatesModule,
    forwardRef(() => CommunicationModule),
    NaacIqacModule,
  ],
  controllers: [DepartmentActivitiesController],
  providers: [DepartmentActivitiesService, DepartmentActivitiesPhase2Service],
  exports: [DepartmentActivitiesService, DepartmentActivitiesPhase2Service],
})
export class DepartmentActivitiesModule {}
