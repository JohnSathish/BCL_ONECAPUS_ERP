import { Module, forwardRef } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule } from '../../shared/cache/cache.module';
import { CommunicationModule } from '../communication/communication.module';
import { TenantsModule } from '../tenants/tenants.module';
import { StudentsModule } from '../students/students.module';
import { StaffModule } from '../staff/staff.module';
import { MobileAppController } from './mobile-app.controller';
import { MobileAppSettingsService } from './mobile-app-settings.service';
import { MobileDeviceService } from './mobile-device.service';
import { MobileAnalyticsService } from './mobile-analytics.service';
import { MobileHomeService } from './mobile-home.service';
import { MobileSessionService } from './mobile-session.service';
import { MobileAppGateInterceptor } from './mobile-app-gate.interceptor';
import { AppUpdateController } from './app-update.controller';
import { AppUpdatePolicyService } from './app-update-policy.service';

@Module({
  imports: [
    CacheModule,
    CommunicationModule,
    TenantsModule,
    forwardRef(() => StudentsModule),
    forwardRef(() => StaffModule),
  ],
  controllers: [MobileAppController, AppUpdateController],
  providers: [
    AppUpdatePolicyService,
    MobileAppSettingsService,
    MobileDeviceService,
    MobileAnalyticsService,
    MobileHomeService,
    MobileSessionService,
    MobileAppGateInterceptor,
    { provide: APP_INTERCEPTOR, useClass: MobileAppGateInterceptor },
  ],
  exports: [MobileAppSettingsService, MobileDeviceService],
})
export class MobileAppModule {}
