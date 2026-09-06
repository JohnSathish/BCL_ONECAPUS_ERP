import { Module } from '@nestjs/common';
import { AdministrationModule } from '../administration/administration.module';
import { AdmissionsModule } from '../admissions/admissions.module';
import { AuthModule } from '../auth/auth.module';
import { TenantsModule } from '../tenants/tenants.module';
import { SchoolAdmissionsDocumentService } from './school-admissions-document.service';
import { SchoolAdmissionsFormService } from './school-admissions-form.service';
import { SchoolAdmissionsMailService } from './school-admissions-mail.service';
import { SchoolAdmissionsOfficeController } from './school-admissions-office.controller';
import { SchoolAdmissionsOfficeService } from './school-admissions-office.service';
import { SchoolAdmissionsPdfService } from './school-admissions-pdf.service';
import { SchoolAdmissionsPortalController } from './school-admissions-portal.controller';
import { SchoolAdmissionsPortalService } from './school-admissions-portal.service';
import { SchoolPortalPresenceService } from './school-portal-presence.service';

@Module({
  imports: [AuthModule, AdministrationModule, TenantsModule, AdmissionsModule],
  controllers: [
    SchoolAdmissionsPortalController,
    SchoolAdmissionsOfficeController,
  ],
  providers: [
    SchoolAdmissionsPortalService,
    SchoolPortalPresenceService,
    SchoolAdmissionsFormService,
    SchoolAdmissionsDocumentService,
    SchoolAdmissionsOfficeService,
    SchoolAdmissionsMailService,
    SchoolAdmissionsPdfService,
  ],
})
export class SchoolAdmissionsModule {}
