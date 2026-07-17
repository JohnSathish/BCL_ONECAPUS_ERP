import { Module } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module';
import { DepartmentActivitiesController } from './department-activities.controller';
import { DepartmentActivitiesService } from './services/department-activities.service';

@Module({
  imports: [CertificatesModule],
  controllers: [DepartmentActivitiesController],
  providers: [DepartmentActivitiesService],
  exports: [DepartmentActivitiesService],
})
export class DepartmentActivitiesModule {}
