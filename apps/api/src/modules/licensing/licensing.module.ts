import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { LicenseController } from './controllers/license.controller';
import { PlatformLicenseController } from './controllers/platform-license.controller';
import { PlatformLicenseKeyController } from './controllers/platform-license-key.controller';
import { LicenseActivationKeyService } from './services/license-activation-key.service';
import { LicenseAuditService } from './services/license-audit.service';
import { LicenseEnforcementService } from './services/license-enforcement.service';
import { LicenseSchedulerService } from './services/license-scheduler.service';
import { LicenseService } from './services/license.service';
import { LicenseStatusService } from './services/license-status.service';
import { LicenseUsageService } from './services/license-usage.service';
import { PlatformLicenseService } from './services/platform-license.service';

@Module({
  imports: [CommunicationModule],
  controllers: [
    LicenseController,
    PlatformLicenseController,
    PlatformLicenseKeyController,
  ],
  providers: [
    LicenseStatusService,
    LicenseUsageService,
    LicenseAuditService,
    LicenseService,
    PlatformLicenseService,
    LicenseActivationKeyService,
    LicenseEnforcementService,
    LicenseSchedulerService,
  ],
  exports: [LicenseEnforcementService, LicenseService, LicenseStatusService],
})
export class LicensingModule {}
