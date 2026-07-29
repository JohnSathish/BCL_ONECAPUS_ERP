import { Module } from '@nestjs/common';
import { StorageModule } from '../../shared/storage/storage.module';
import { AcademicCalendarModule } from '../academic-calendar/academic-calendar.module';
import { AdministrationModule } from '../administration/administration.module';
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
import { WebsitePopupAdminController } from './website-popup-admin.controller';
import { WebsitePopupService } from './website-popup.service';

@Module({
  imports: [
    StorageModule,
    TenantsModule,
    AcademicCalendarModule,
    AdministrationModule,
  ],
  controllers: [
    WebsiteManagementController,
    WebsiteAdminController,
    WebsitePublicController,
    WebsitePopupAdminController,
  ],
  providers: [
    WebsiteService,
    WebsiteAdminService,
    WebsiteAcademicService,
    WebsiteCmsEnterpriseService,
    WebsiteFyugInterestDocumentService,
    WebsiteAcademicPlannerService,
    WebsitePopupService,
  ],
  exports: [
    WebsiteService,
    WebsiteAcademicService,
    WebsiteCmsEnterpriseService,
    WebsiteFyugInterestDocumentService,
    WebsiteAcademicPlannerService,
    WebsitePopupService,
  ],
})
export class WebsiteModule {}
