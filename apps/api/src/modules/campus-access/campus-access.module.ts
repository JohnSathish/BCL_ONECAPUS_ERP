import { Module } from '@nestjs/common';
import { LibraryModule } from '../library/library.module';
import { CampusAccessAdminController } from './controllers/campus-access-admin.controller';
import { CampusKioskPublicController } from './controllers/campus-kiosk-public.controller';
import { AccessPointService } from './services/access-point.service';
import { CampusAccessDashboardService } from './services/campus-access-dashboard.service';
import { CampusKioskService } from './services/campus-kiosk.service';

@Module({
  imports: [LibraryModule],
  controllers: [CampusKioskPublicController, CampusAccessAdminController],
  providers: [
    AccessPointService,
    CampusKioskService,
    CampusAccessDashboardService,
  ],
  exports: [
    AccessPointService,
    CampusKioskService,
    CampusAccessDashboardService,
  ],
})
export class CampusAccessModule {}
