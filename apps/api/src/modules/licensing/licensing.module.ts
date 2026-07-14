import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { LicenseController } from './controllers/license.controller';
import { ModuleEntitlementController } from './controllers/module-entitlement.controller';
import { PlatformLicenseController } from './controllers/platform-license.controller';
import { PlatformLicenseKeyController } from './controllers/platform-license-key.controller';
import { ModuleEntitlementGuard } from './guards/module-entitlement.guard';
import { LicenseActivationKeyService } from './services/license-activation-key.service';
import { LicenseAuditService } from './services/license-audit.service';
import { LicenseEnforcementService } from './services/license-enforcement.service';
import { LicenseSchedulerService } from './services/license-scheduler.service';
import { LicenseService } from './services/license.service';
import { LicenseStatusService } from './services/license-status.service';
import { LicenseUsageService } from './services/license-usage.service';
import { ModuleEntitlementService } from './services/module-entitlement.service';
import { PlatformLicenseService } from './services/platform-license.service';

@Module({
  imports: [CommunicationModule],
  controllers: [
    LicenseController,
    ModuleEntitlementController,
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
    ModuleEntitlementService,
    ModuleEntitlementGuard,
  ],
  exports: [
    LicenseEnforcementService,
    LicenseService,
    LicenseStatusService,
    ModuleEntitlementService,
    ModuleEntitlementGuard,
  ],
})
export class LicensingModule {}
