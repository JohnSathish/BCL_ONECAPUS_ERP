import { Module } from '@nestjs/common';
import { StorageModule } from '../../shared/storage/storage.module';
import { AcademicCalendarModule } from '../academic-calendar/academic-calendar.module';
import { TenantsModule } from '../tenants/tenants.module';
import { WebsiteAdminController } from './website-admin.controller';
import { WebsiteAdminService } from './website-admin.service';
import { WebsiteAcademicService } from './website-academic.service';
import { WebsiteCmsEnterpriseService } from './website-cms-enterprise.service';
import { WebsiteManagementController } from './website-management.controller';
import { WebsitePublicController } from './website-public.controller';
import { WebsiteService } from './website.service';
import { WebsiteFyugInterestDocumentService } from './services/website-fyug-interest-document.service';
import { WebsiteAcademicPlannerService } from './website-academic-planner.service';

@Module({
  imports: [StorageModule, TenantsModule, AcademicCalendarModule],
  controllers: [
    WebsiteManagementController,
    WebsiteAdminController,
    WebsitePublicController,
  ],
  providers: [
    WebsiteService,
    WebsiteAdminService,
    WebsiteAcademicService,
    WebsiteCmsEnterpriseService,
    WebsiteFyugInterestDocumentService,
    WebsiteAcademicPlannerService,
  ],
  exports: [
    WebsiteService,
    WebsiteAcademicService,
    WebsiteCmsEnterpriseService,
    WebsiteFyugInterestDocumentService,
    WebsiteAcademicPlannerService,
  ],
})
export class WebsiteModule {}
