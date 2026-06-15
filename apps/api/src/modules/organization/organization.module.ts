import { Module, forwardRef } from '@nestjs/common';
import { AdmissionsModule } from '../admissions/admissions.module';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  imports: [forwardRef(() => AdmissionsModule)],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
