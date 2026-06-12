import { Module } from '@nestjs/common';
import { FrontOfficeController } from './front-office.controller';
import { FrontOfficeAdmissionsLinkService } from './services/front-office-admissions-link.service';
import { FrontOfficeComplaintsService } from './services/front-office-complaints.service';
import { FrontOfficeDashboardService } from './services/front-office-dashboard.service';
import { FrontOfficeEnquiriesService } from './services/front-office-enquiries.service';
import { FrontOfficeGatePassesService } from './services/front-office-gate-passes.service';
import { FrontOfficeKioskService } from './services/front-office-kiosk.service';

@Module({
  controllers: [FrontOfficeController],
  providers: [
    FrontOfficeDashboardService,
    FrontOfficeEnquiriesService,
    FrontOfficeGatePassesService,
    FrontOfficeComplaintsService,
    FrontOfficeAdmissionsLinkService,
    FrontOfficeKioskService,
  ],
})
export class FrontOfficeModule {}
