import { Module } from '@nestjs/common';
import { AccommodationController } from './accommodation.controller';
import { QuarterMasterService } from './services/quarter-master.service';
import { QuarterAllotmentService } from './services/quarter-allotment.service';
import { QuarterChargesService } from './services/quarter-charges.service';
import { AccommodationDashboardService } from './services/accommodation-dashboard.service';
import { AccommodationReportsService } from './services/accommodation-reports.service';
import { AccommodationAuditService } from './services/accommodation-audit.service';
import { AccommodationPayrollBridgeService } from './services/accommodation-payroll-bridge.service';
import { AccommodationSetupService } from './services/accommodation-setup.service';

@Module({
  controllers: [AccommodationController],
  providers: [
    QuarterMasterService,
    QuarterAllotmentService,
    QuarterChargesService,
    AccommodationDashboardService,
    AccommodationReportsService,
    AccommodationAuditService,
    AccommodationPayrollBridgeService,
    AccommodationSetupService,
  ],
  exports: [AccommodationPayrollBridgeService, QuarterAllotmentService],
})
export class AccommodationModule {}
