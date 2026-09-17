import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { AuthModule } from '../auth/auth.module';
import { SchoolSisModule } from '../school-sis/school-sis.module';
import { SchoolWebModule } from '../school-web/school-web.module';
import { TenantsModule } from '../tenants/tenants.module';
import { SchoolMobileAccessService } from './school-mobile-access.service';
import { SchoolMobileAuthService } from './school-mobile-auth.service';
import { SchoolMobileAccountAuthService } from './school-mobile-account-auth.service';
import { SchoolMobileDeviceService } from './school-mobile-device.service';
import { SchoolMobileHomeService } from './school-mobile-home.service';
import { SchoolMobileInboxService } from './school-mobile-inbox.service';
import { SchoolMobilePrayerService } from './school-mobile-prayer.service';
import { SchoolMobileSettingsService } from './school-mobile-settings.service';
import { SchoolMobileController } from './school-mobile.controller';

@Module({
  imports: [
    TenantsModule,
    AuthModule,
    SchoolSisModule,
    SchoolWebModule,
    CommunicationModule,
  ],
  controllers: [SchoolMobileController],
  providers: [
    SchoolMobileSettingsService,
    SchoolMobileAccessService,
    SchoolMobileAuthService,
    SchoolMobileAccountAuthService,
    SchoolMobileDeviceService,
    SchoolMobileInboxService,
    SchoolMobilePrayerService,
    SchoolMobileHomeService,
  ],
})
export class SchoolMobileModule {}
